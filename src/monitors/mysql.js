// MySQL 数据库监控模块
// 使用 TCP Socket 验证 MySQL 服务可用性

import { connect } from 'cloudflare:sockets';
import { TIMEOUTS, RESPONSE_TIME } from '../config/index.js';

/**
 * 检测 MySQL 站点
 * @param {Object} site - 站点配置
 * @param {number} checkTime - 检测时间戳
 */
export async function checkMysqlSite(site, checkTime) {
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
    const port = parseInt(site.dbPort, 10) || 3306;

    if (!host) {
        return {
            timestamp: checkTime,
            status: 'offline',
            statusCode: 0,
            responseTime: 0,
            message: '未配置数据库主机'
        };
    }

    const timeoutMs = TIMEOUTS.mysqlTimeout || 15000;
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

            // MySQL: 服务器主动发送握手包
            const result = await readWithTimeout(reader, 5000);
            if (!result || result.length < 5) {
                throw new Error('无效的 MySQL 握手响应');
            }
            // 验证是否为 MySQL 协议（第 5 字节是协议版本，通常是 10）
            if (result[4] !== 10 && result[4] !== 9) {
                throw new Error('非 MySQL 协议');
            }
            // 提取服务器版本
            const versionEndIdx = result.indexOf(0, 5);
            const serverVersion = versionEndIdx > 5
                ? new TextDecoder().decode(result.slice(5, versionEndIdx))
                : 'unknown';

            reader.releaseLock();
            await socket.close();

            return { success: true, version: serverVersion };
        })();

        const result = await Promise.race([dbCheckPromise, timeoutPromise]);
        clearTimeout(timeoutId);

        const responseTime = Date.now() - startTime;

        // 确定状态
        let finalStatus = 'online';
        const thresholds = RESPONSE_TIME.mysql || { slow: 1000, verySlow: 3000 };

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
            message: `MySQL 服务正常` + (result.version !== 'unknown' ? ` (${result.version})` : '')
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
                message: `MySQL 连接超时 (${host}:${port})`
            };
        }

        // 连接被拒绝
        if (msgLower.includes('refused') || msgLower.includes('econnrefused') || msgLower.includes('reset')) {
            return {
                timestamp: checkTime,
                status: 'offline',
                statusCode: 0,
                responseTime,
                message: `MySQL 连接被拒绝 (${host}:${port})`
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
            message: `MySQL 检测失败: ${errMsg.substring(0, 50)}`
        };
    }
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
