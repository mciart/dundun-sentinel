/**
 * 历史数据迁移脚本
 * 将 history 表中的数据迁移到 history_aggregated 聚合表
 * 
 * 用法:
 *   node scripts/migrate-history.js          # 本地数据库（默认）
 *   node scripts/migrate-history.js --local  # 本地数据库
 *   node scripts/migrate-history.js --remote # 远程数据库
 */

import { execSync } from 'child_process';

const DB_NAME = 'dundun-sentinel-db';

// 解析命令行参数，默认使用本地数据库
const args = process.argv.slice(2);
const isRemote = args.includes('--remote');
const TARGET = isRemote ? '--remote' : '--local';
const TARGET_NAME = isRemote ? '远程' : '本地';

// 执行 SQL 并返回结果
function execSQL(sql, silent = false) {
  try {
    const result = execSync(
      `npx wrangler d1 execute ${DB_NAME} --command "${sql.replace(/"/g, '\\"')}" ${TARGET} --json`,
      { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 } // 50MB buffer
    );
    return JSON.parse(result);
  } catch (e) {
    if (!silent) console.error('SQL 执行失败:', e.message);
    return null;
  }
}

// 执行 SQL（无返回值）
function execSQLNoReturn(sql) {
  try {
    execSync(
      `npx wrangler d1 execute ${DB_NAME} --command "${sql.replace(/"/g, '\\"')}" ${TARGET} --yes`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    return true;
  } catch (e) {
    console.error('SQL 执行失败:', e.message);
    return false;
  }
}

async function migrate() {
  console.log(`🔄 开始迁移历史数据到聚合表（${TARGET_NAME}数据库）...\n`);

  // 1. 确保聚合表存在
  console.log('📋 检查聚合表...');
  execSQLNoReturn(`
    CREATE TABLE IF NOT EXISTS history_aggregated (
      site_id TEXT PRIMARY KEY,
      data TEXT NOT NULL DEFAULT '[]',
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);
  console.log('   ✅ 聚合表已就绪\n');

  // 2. 获取所有站点 ID
  console.log('📋 获取站点列表...');
  const sitesResult = execSQL('SELECT DISTINCT site_id FROM history');
  if (!sitesResult || !sitesResult[0] || !sitesResult[0].results) {
    console.log('   ⚠️ 没有找到历史记录，迁移完成');
    return;
  }
  
  const siteIds = sitesResult[0].results.map(r => r.site_id);
  console.log(`   找到 ${siteIds.length} 个站点\n`);

  // 3. 逐站点迁移
  let migratedCount = 0;
  let totalRecords = 0;

  for (const siteId of siteIds) {
    process.stdout.write(`   迁移站点 ${siteId}... `);
    
    // 获取该站点的所有历史记录
    const historyResult = execSQL(
      `SELECT timestamp, status, status_code, response_time, message FROM history WHERE site_id = '${siteId}' ORDER BY timestamp DESC LIMIT 4320`,
      true
    );
    
    if (!historyResult || !historyResult[0] || !historyResult[0].results) {
      console.log('无数据');
      continue;
    }
    
    const records = historyResult[0].results;
    totalRecords += records.length;
    
    // 转换为压缩格式
    const aggregated = records.map(r => ({
      t: r.timestamp,
      s: r.status,
      c: r.status_code || 0,
      r: r.response_time || 0,
      m: r.message || null
    }));
    
    // 写入聚合表
    const dataStr = JSON.stringify(aggregated).replace(/'/g, "''");
    const now = Date.now();
    const success = execSQLNoReturn(
      `INSERT INTO history_aggregated (site_id, data, updated_at) VALUES ('${siteId}', '${dataStr}', ${now}) ON CONFLICT(site_id) DO UPDATE SET data = '${dataStr}', updated_at = ${now}`
    );
    
    if (success) {
      console.log(`${records.length} 条记录`);
      migratedCount++;
    } else {
      console.log('失败');
    }
  }

  console.log(`\n✅ 迁移完成！`);
  console.log(`   - 站点数: ${migratedCount}/${siteIds.length}`);
  console.log(`   - 总记录数: ${totalRecords}`);
  console.log(`\n💡 提示: 迁移后旧 history 表数据仍保留，可通过以下命令清空（可选）:`);
  console.log(`   npx wrangler d1 execute ${DB_NAME} --command "DELETE FROM history;" ${TARGET} --yes`);
}

migrate().catch(console.error);
