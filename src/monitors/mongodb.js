// MongoDB 数据库监控模块
// 使用 TCP Socket 验证 MongoDB 服务可用性

import { connect } from 'cloudflare:sockets';
import { TIMEOUTS, RESPONSE_TIME } from '../config/index.js';

/**
 * 检测 MongoDB 站点
 * @param {Object} site - 站点配置
 * @param {number} checkTime - 检测时间戳
 */
export async function checkMongodbSite(site, checkTime) {
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

    const host = site.dbHost || '';
    const port = parseInt(site.dbPort, 10) || 27017;

    if (!host) {
        return {
            timestamp: checkTime,
            status: 'offline',
            statusCode: 0,
            responseTime: 0,
            message: '未配置数据库主机'
        };
    }

    const timeoutMs = TIMEOUTS.mongodbTimeout || 15000;
    let socket = null;
    let timeoutId;

    try {
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('DB_TIMEOUT')), timeoutMs);
        });

        const dbCheckPromise = (async () => {
            socket = connect({ hostname: host, port });
            await socket.opened;

            const reader = socket.readable.getReader();
            const writer = socket.writable.getWriter();

            // 发送 MongoDB isMaster 命令
            // 这是一个简化的 OP_MSG 消息
            const isMasterCmd = buildIsMasterCommand();
            await writer.write(isMasterCmd);

            // 读取响应
            const result = await readWithTimeout(reader, 5000);
            if (!result || result.length < 16) {
                throw new Error('无效的 MongoDB 响应');
            }

            // 验证是否为 MongoDB 协议
            // MongoDB 响应的前 4 字节是消息长度（小端序）
            const messageLength = result[0] | (result[1] << 8) | (result[2] << 16) | (result[3] << 24);
            if (messageLength < 16 || messageLength > 48000000) {
                throw new Error('非 MongoDB 协议');
            }

            reader.releaseLock();
            writer.releaseLock();
            await socket.close();

            return { success: true };
        })();

        const result = await Promise.race([dbCheckPromise, timeoutPromise]);
        clearTimeout(timeoutId);

        const responseTime = Date.now() - startTime;

        // 确定状态
        let finalStatus = 'online';
        const thresholds = RESPONSE_TIME.mongodb || { slow: 1000, verySlow: 3000 };

        if (responseTime > thresholds.verySlow) {
            finalStatus = 'slow';
        } else if (responseTime > thresholds.slow) {
            finalStatus = 'slow';
        }

        return {
            timestamp: checkTime,
            status: finalStatus,
            statusCode: 0,
            responseTime,
            message: 'MongoDB 服务正常'
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
        if (errMsg === 'DB_TIMEOUT' || msgLower.includes('timeout')) {
            return {
                timestamp: checkTime,
                status: 'offline',
                statusCode: 0,
                responseTime,
                message: `MongoDB 连接超时 (${host}:${port})`
            };
        }

        // 连接被拒绝
        if (msgLower.includes('refused') || msgLower.includes('econnrefused') || msgLower.includes('reset')) {
            return {
                timestamp: checkTime,
                status: 'offline',
                statusCode: 0,
                responseTime,
                message: `MongoDB 连接被拒绝 (${host}:${port})`
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
            message: `MongoDB 检测失败: ${errMsg.substring(0, 50)}`
        };
    }
}

/**
 * 构建 MongoDB isMaster 命令
 * 使用 OP_MSG 格式（MongoDB 3.6+）
 */
function buildIsMasterCommand() {
    // isMaster 命令的 BSON 文档: { isMaster: 1 }
    const bsonDoc = new Uint8Array([
        // BSON 文档长度 (16 字节)
        0x10, 0x00, 0x00, 0x00,
        // 类型: int32 (0x10)
        0x10,
        // 字段名: "isMaster\0"
        0x69, 0x73, 0x4d, 0x61, 0x73, 0x74, 0x65, 0x72, 0x00,
        // 值: 1 (int32, 小端序)
        0x01, 0x00, 0x00, 0x00,
        // 文档结束符
        0x00
    ]);

    // OP_MSG 头部
    const messageLength = 16 + 4 + 1 + bsonDoc.length; // header + flagBits + sectionKind + body
    const requestId = Math.floor(Math.random() * 0x7FFFFFFF);
    const responseTo = 0;
    const opCode = 2013; // OP_MSG

    const header = new Uint8Array(16);
    const view = new DataView(header.buffer);
    view.setInt32(0, messageLength, true);  // messageLength
    view.setInt32(4, requestId, true);      // requestID
    view.setInt32(8, responseTo, true);     // responseTo
    view.setInt32(12, opCode, true);        // opCode

    // flagBits (4 字节) + sectionKind (1 字节)
    const flagsAndSection = new Uint8Array([
        0x00, 0x00, 0x00, 0x00, // flagBits
        0x00                     // sectionKind (body)
    ]);

    // 组合完整消息
    const message = new Uint8Array(messageLength);
    message.set(header, 0);
    message.set(flagsAndSection, 16);
    message.set(bsonDoc, 21);

    return message;
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
