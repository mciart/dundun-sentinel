/**
 * 自动数据库迁移脚本
 * 解析 schema.sql，对比现有数据库结构：
 * - 自动添加缺失的列
 * - 自动删除废弃的表（schema.sql 中不存在的表）
 * 
 * 用法:
 *   node scripts/migrate.js          # 本地数据库（默认）
 *   node scripts/migrate.js --local  # 本地数据库
 *   node scripts/migrate.js --remote # 远程数据库
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_NAME = 'dundun-sentinel-db';

// 解析命令行参数，默认使用本地数据库
const args = process.argv.slice(2);
const isRemote = args.includes('--remote');
const TARGET = isRemote ? '--remote' : '--local';
const TARGET_NAME = isRemote ? '远程' : '本地';

// 获取数据库中所有表名
function getExistingTables() {
  try {
    const result = execSync(
      `npx wrangler d1 execute ${DB_NAME} --command "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%';" ${TARGET} --json`,
      { encoding: 'utf-8' }
    );
    const data = JSON.parse(result);
    if (data && data[0] && data[0].results) {
      return data[0].results.map(row => row.name);
    }
    return [];
  } catch (e) {
    console.error('获取数据库表列表失败:', e.message);
    return [];
  }
}

// 执行 wrangler 命令
function wranglerExec(command, silent = false) {
  try {
    const result = execSync(
      `npx wrangler d1 execute ${DB_NAME} --command "${command}" ${TARGET} --json`,
      { encoding: 'utf-8', stdio: silent ? 'pipe' : 'inherit' }
    );
    return JSON.parse(result);
  } catch (e) {
    if (!silent) console.error('命令执行失败:', e.message);
    return null;
  }
}

// 获取表的现有列
function getExistingColumns(tableName) {
  try {
    const result = execSync(
      `npx wrangler d1 execute ${DB_NAME} --command "PRAGMA table_info(${tableName});" ${TARGET} --json`,
      { encoding: 'utf-8' }
    );
    const data = JSON.parse(result);
    if (data && data[0] && data[0].results) {
      return data[0].results.map(row => row.name);
    }
    return [];
  } catch (e) {
    console.error(`获取 ${tableName} 表结构失败:`, e.message);
    return [];
  }
}

// 解析 schema.sql 获取表定义
function parseSchema(schemaPath) {
  const content = fs.readFileSync(schemaPath, 'utf-8');
  const tables = {};
  
  // 匹配 CREATE TABLE 语句
  const tableRegex = /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\);/g;
  let match;
  
  while ((match = tableRegex.exec(content)) !== null) {
    const tableName = match[1];
    const columnsBlock = match[2];
    
    // 解析列定义
    const columns = {};
    const lines = columnsBlock.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      // 跳过空行、注释、约束
      if (!trimmed || trimmed.startsWith('--') || trimmed.startsWith('FOREIGN') || 
          trimmed.startsWith('PRIMARY') || trimmed.startsWith('UNIQUE') ||
          trimmed.startsWith('CREATE INDEX')) {
        continue;
      }
      
      // 匹配列定义: column_name TYPE [DEFAULT xxx]
      const colMatch = trimmed.match(/^(\w+)\s+(TEXT|INTEGER|REAL)(.*)$/i);
      if (colMatch) {
        const colName = colMatch[1];
        const colType = colMatch[2].toUpperCase();
        let defaultVal = '';
        
        // 提取 DEFAULT 值
        const defaultMatch = colMatch[3].match(/DEFAULT\s+([^,]+)/i);
        if (defaultMatch) {
          defaultVal = ` DEFAULT ${defaultMatch[1].trim().replace(/,$/, '')}`;
        }
        
        columns[colName] = `${colType}${defaultVal}`;
      }
    }
    
    tables[tableName] = columns;
  }
  
  return tables;
}

// 主迁移逻辑
async function migrate() {
  console.log(`🔄 开始自动数据库迁移（${TARGET_NAME}数据库）...\n`);
  
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error('❌ 找不到 schema.sql');
    process.exit(1);
  }
  
  const schema = parseSchema(schemaPath);
  let migrationsRun = 0;
  
  // 第一步：检查并删除废弃的表（schema.sql 中不存在的表）
  console.log('🗑️ 检查废弃表...');
  const existingTables = getExistingTables();
  const schemaTables = Object.keys(schema);
  
  for (const tableName of existingTables) {
    if (!schemaTables.includes(tableName)) {
      console.log(`   🗑️ 删除废弃表: ${tableName}`);
      try {
        execSync(
          `npx wrangler d1 execute ${DB_NAME} --command "DROP TABLE IF EXISTS ${tableName};" ${TARGET} --yes`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
        migrationsRun++;
        console.log(`   ✅ 已删除`);
      } catch (e) {
        console.log(`   ⚠️ 删除失败: ${e.message}`);
      }
    }
  }
  
  // 第二步：检查并添加缺失的列
  console.log('\n📋 检查表结构...');
  for (const [tableName, columns] of Object.entries(schema)) {
    console.log(`   检查表: ${tableName}`);
    
    // 检查表是否存在，如果不存在则创建
    const existingCols = getExistingColumns(tableName);
    
    if (existingCols.length === 0) {
      console.log(`   ⚠️ 表不存在，将通过 schema.sql 创建`);
      continue;
    }
    
    // 检查缺失的列
    for (const [colName, colDef] of Object.entries(columns)) {
      if (!existingCols.includes(colName)) {
        console.log(`   ➕ 添加列: ${colName} (${colDef})`);
        try {
          execSync(
            `npx wrangler d1 execute ${DB_NAME} --command "ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef};" ${TARGET} --yes`,
            { encoding: 'utf-8', stdio: 'pipe' }
          );
          migrationsRun++;
          console.log(`   ✅ 成功`);
        } catch (e) {
          // 可能列已存在但 PRAGMA 没返回（极少情况）
          console.log(`   ⚠️ 跳过（可能已存在）`);
        }
      }
    }
  }
  
  // 第三步：创建索引（如果不存在）
  console.log('\n📋 检查索引...');
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_history_site_time ON history(site_id, timestamp DESC)',
    'CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history(timestamp)',
    'CREATE INDEX IF NOT EXISTS idx_push_history_site_time ON push_history(site_id, timestamp DESC)',
    'CREATE INDEX IF NOT EXISTS idx_push_history_timestamp ON push_history(timestamp)',
    'CREATE INDEX IF NOT EXISTS idx_incidents_site ON incidents(site_id)',
    'CREATE INDEX IF NOT EXISTS idx_incidents_time ON incidents(created_at DESC)'
  ];
  
  for (const idx of indexes) {
    try {
      execSync(
        `npx wrangler d1 execute ${DB_NAME} --command "${idx};" ${TARGET} --yes`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
    } catch (e) {
      // 忽略已存在的索引错误
    }
  }

  // 第四步：创建聚合历史表（如果不存在）
  console.log('\n📋 检查聚合历史表...');
  try {
    execSync(
      `npx wrangler d1 execute ${DB_NAME} --command "CREATE TABLE IF NOT EXISTS history_aggregated (site_id TEXT PRIMARY KEY, data TEXT NOT NULL DEFAULT '[]', updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000));" ${TARGET} --yes`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    console.log('   ✅ 聚合历史表已就绪');
  } catch (e) {
    console.log('   ⚠️ 聚合历史表创建失败:', e.message);
  }
  
  console.log(`\n✅ 迁移完成！执行了 ${migrationsRun} 个迁移操作`);
}

migrate().catch(console.error);
