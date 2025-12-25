// PostgreSQL 数据库监控模块
// 使用 TCP Socket 验证 PostgreSQL 服务可用性

import { connect } from 'cloudflare:sockets';
import { TIMEOUTS, RESPONSE_TIME } from '../config/index.js';

/**
 * 检测 PostgreSQL 站点
 * @param {Object} site - 站点配置
 * @param {number} checkTime - 检测时间戳
 */
export async function checkPostgresSite(site, checkTime) {
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
    const port = parseInt(site.dbPort, 10) || 5432;

    if (!host) {
        return {
            timestamp: checkTime,
            status: 'offline',
            statusCode: 0,
            responseTime: 0,
            message: '未配置数据库主机'
        };
    }

    const timeoutMs = TIMEOUTS.postgresTimeout || 15000;
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

            // PostgreSQL: 发送最小启动消息
            const startupMessage = buildPostgresStartupMessage();
            await writer.write(startupMessage);

            // 等待响应
            const result = await readWithTimeout(reader, 5000);
            if (!result || result.length < 1) {
                throw new Error('无效的 PostgreSQL 响应');
            }

            // 响应类型：R=认证请求, E=错误
            const responseType = String.fromCharCode(result[0]);
            if (responseType !== 'R' && responseType !== 'E') {
                throw new Error('非 PostgreSQL 协议');
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
        const thresholds = RESPONSE_TIME.postgres || { slow: 1000, verySlow: 3000 };

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
            message: 'PostgreSQL 服务正常'
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
                message: `PostgreSQL 连接超时 (${host}:${port})`
            };
        }

        // 连接被拒绝
        if (msgLower.includes('refused') || msgLower.includes('econnrefused') || msgLower.includes('reset')) {
            return {
                timestamp: checkTime,
                status: 'offline',
                statusCode: 0,
                responseTime,
                message: `PostgreSQL 连接被拒绝 (${host}:${port})`
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
            message: `PostgreSQL 检测失败: ${errMsg.substring(0, 50)}`
        };
    }
}

/**
 * 构建 PostgreSQL 启动消息
 * 格式: 4字节长度 + 4字节版本号(3.0) + "user\0postgres\0\0"
 */
function buildPostgresStartupMessage() {
    const user = 'postgres';

    // 计算消息长度
    const userKey = 'user';
    const msgLength = 4 + 4 + userKey.length + 1 + user.length + 1 + 1;

    const buffer = new ArrayBuffer(msgLength);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // 写入长度 (big-endian)
    view.setInt32(0, msgLength, false);

    // 写入协议版本 3.0 = 0x00030000
    view.setInt32(4, 0x00030000, false);

    // 写入 "user\0"
    let offset = 8;
    for (const char of userKey) {
        bytes[offset++] = char.charCodeAt(0);
    }
    bytes[offset++] = 0;

    // 写入 用户名 + \0
    for (const char of user) {
        bytes[offset++] = char.charCodeAt(0);
    }
    bytes[offset++] = 0;

    // 结束标记
    bytes[offset] = 0;

    return bytes;
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
