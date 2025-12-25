// MQTT 消息队列监控模块
// 使用 TCP Socket 验证 MQTT Broker 可用性
// 通过发送 MQTT CONNECT 包并验证 CONNACK 响应

import { connect } from 'cloudflare:sockets';
import { TIMEOUTS, RESPONSE_TIME } from '../config/index.js';

/**
 * 检测 MQTT 站点
 * @param {Object} site - 站点配置
 * @param {number} checkTime - 检测时间戳
 */
export async function checkMqttSite(site, checkTime) {
    const startTime = Date.now();

    // Mock 模式
    if (site?.mock?.forceStatus) {
        return {
            timestamp: checkTime,
            status: site.mock.forceStatus,
            statusCode: site.mock.statusCode || 0,
            responseTime: site.mock.responseTime || 0,
            message: site.mock.message || '模拟'
        };
    }

    const host = site.mqttHost || '';
    const port = parseInt(site.mqttPort, 10) || 1883;

    if (!host) {
        return {
            timestamp: checkTime,
            status: 'offline',
            statusCode: 0,
            responseTime: 0,
            message: '未配置 MQTT 主机'
        };
    }

    const timeoutMs = TIMEOUTS.mqttTimeout || 15000;
    let socket = null;
    let timeoutId;

    try {
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('MQTT_TIMEOUT')), timeoutMs);
        });

        const mqttCheckPromise = (async () => {
            socket = connect({ hostname: host, port });
            await socket.opened;

            const reader = socket.readable.getReader();
            const writer = socket.writable.getWriter();

            // 构建 MQTT CONNECT 包
            const connectPacket = buildMqttConnectPacket();
            await writer.write(connectPacket);

            // 读取 CONNACK 响应
            const result = await readWithTimeout(reader, 5000);
            if (!result || result.length < 4) {
                throw new Error('无效的 MQTT 响应');
            }

            // 验证 CONNACK 响应
            // CONNACK 固定头: 0x20 (CONNACK 类型)
            // 第二字节: 剩余长度 (通常是 2)
            // 第三字节: 连接确认标志
            // 第四字节: 返回码 (0=成功, 其他=各种错误)
            const packetType = result[0] >> 4;
            if (packetType !== 2) { // 2 = CONNACK
                throw new Error('非 MQTT 协议');
            }

            const returnCode = result[3];

            reader.releaseLock();
            writer.releaseLock();
            await socket.close();

            return { success: true, returnCode };
        })();

        const result = await Promise.race([mqttCheckPromise, timeoutPromise]);
        clearTimeout(timeoutId);

        const responseTime = Date.now() - startTime;

        // 确定状态
        let finalStatus = 'online';
        const thresholds = RESPONSE_TIME.mqtt || { slow: 1000, verySlow: 3000 };

        if (responseTime > thresholds.verySlow) {
            finalStatus = 'slow';
        } else if (responseTime > thresholds.slow) {
            finalStatus = 'slow';
        }

        // 构建消息
        let message = 'MQTT Broker 正常';
        if (result.returnCode !== 0) {
            // MQTT 返回码说明
            const codes = {
                1: '协议版本不支持',
                2: '客户端标识符被拒绝',
                3: '服务不可用',
                4: '用户名或密码错误',
                5: '未授权'
            };
            message = `MQTT Broker 正常 (${codes[result.returnCode] || `code:${result.returnCode}`})`;
        }

        return {
            timestamp: checkTime,
            status: finalStatus,
            statusCode: result.returnCode,
            responseTime,
            message
        };

    } catch (error) {
        clearTimeout(timeoutId);

        if (socket) {
            try { await socket.close(); } catch (e) { /* ignore */ }
        }

        const responseTime = Date.now() - startTime;
        const errMsg = error?.message || String(error);
        const msgLower = errMsg.toLowerCase();

        // 超时
        if (errMsg === 'MQTT_TIMEOUT' || msgLower.includes('timeout')) {
            return {
                timestamp: checkTime,
                status: 'offline',
                statusCode: 0,
                responseTime,
                message: `MQTT 连接超时 (${host}:${port})`
            };
        }

        // 连接被拒绝
        if (msgLower.includes('refused') || msgLower.includes('econnrefused') || msgLower.includes('reset')) {
            return {
                timestamp: checkTime,
                status: 'offline',
                statusCode: 0,
                responseTime,
                message: `MQTT 连接被拒绝 (${host}:${port})`
            };
        }

        // DNS 解析失败
        if (msgLower.includes('getaddrinfo') || msgLower.includes('enotfound') || msgLower.includes('dns')) {
            return {
                timestamp: checkTime,
                status: 'offline',
                statusCode: 0,
                responseTime,
                message: `主机 ${host} DNS解析失败`
            };
        }

        // 其他错误
        return {
            timestamp: checkTime,
            status: 'offline',
            statusCode: 0,
            responseTime,
            message: `MQTT 检测失败: ${errMsg.substring(0, 50)}`
        };
    }
}

/**
 * 构建 MQTT CONNECT 包
 * MQTT 3.1.1 协议
 */
function buildMqttConnectPacket() {
    // 协议名称 "MQTT"
    const protocolName = new TextEncoder().encode('MQTT');

    // 客户端 ID (随机生成)
    const clientId = `sentinel_${Date.now().toString(36)}`;
    const clientIdBytes = new TextEncoder().encode(clientId);

    // 可变头
    const variableHeader = new Uint8Array([
        0x00, 0x04, // 协议名称长度
        ...protocolName,
        0x04,       // 协议级别 (4 = MQTT 3.1.1)
        0x02,       // 连接标志 (Clean Session)
        0x00, 0x3C  // Keep Alive (60秒)
    ]);

    // 有效载荷 (Client ID)
    const payloadLength = 2 + clientIdBytes.length;
    const payload = new Uint8Array(payloadLength);
    payload[0] = (clientIdBytes.length >> 8) & 0xFF;
    payload[1] = clientIdBytes.length & 0xFF;
    payload.set(clientIdBytes, 2);

    // 剩余长度
    const remainingLength = variableHeader.length + payload.length;

    // 固定头
    const fixedHeader = new Uint8Array([
        0x10, // CONNECT 包类型
        remainingLength
    ]);

    // 组合完整包
    const packet = new Uint8Array(fixedHeader.length + variableHeader.length + payload.length);
    packet.set(fixedHeader, 0);
    packet.set(variableHeader, fixedHeader.length);
    packet.set(payload, fixedHeader.length + variableHeader.length);

    return packet;
}

/**
 * 带超时的读取
 */
async function readWithTimeout(reader, timeoutMs) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('读取超时'));
        }, timeoutMs);

        reader.read().then(({ value, done }) => {
            clearTimeout(timer);
            if (done) {
                resolve(null);
            } else {
                resolve(value);
            }
        }).catch(err => {
            clearTimeout(timer);
            reject(err);
        });
    });
}
