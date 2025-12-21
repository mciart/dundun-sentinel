/**
 * 自动数据库迁移脚本
 * 解析 schema.sql，对比现有数据库结构，自动添加缺失的列
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_NAME = 'dundun-sentinel-db';

// 执行 wrangler 命令
function wranglerExec(command, silent = false) {
  try {
    const result = execSync(
      `npx wrangler d1 execute ${DB_NAME} --command "${command}" --remote --json`,
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
      `npx wrangler d1 execute ${DB_NAME} --command "PRAGMA table_info(${tableName});" --remote --json`,
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
  console.log('🔄 开始自动数据库迁移...\n');
  
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error('❌ 找不到 schema.sql');
    process.exit(1);
  }
  
  const schema = parseSchema(schemaPath);
  let migrationsRun = 0;
  
  for (const [tableName, columns] of Object.entries(schema)) {
    console.log(`📋 检查表: ${tableName}`);
    
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
            `npx wrangler d1 execute ${DB_NAME} --command "ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef};" --remote --yes`,
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
  
  // 创建索引（如果不存在）
  console.log('\n📋 检查索引...');
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_history_site_time ON history(site_id, timestamp DESC)',
    'CREATE INDEX IF NOT EXISTS idx_push_history_site_time ON push_history(site_id, timestamp DESC)',
    'CREATE INDEX IF NOT EXISTS idx_incidents_site ON incidents(site_id)',
    'CREATE INDEX IF NOT EXISTS idx_incidents_time ON incidents(created_at DESC)'
  ];
  
  for (const idx of indexes) {
    try {
      execSync(
        `npx wrangler d1 execute ${DB_NAME} --command "${idx};" --remote --yes`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
    } catch (e) {
      // 忽略已存在的索引错误
    }
  }
  
  console.log(`\n✅ 迁移完成！执行了 ${migrationsRun} 个列迁移`);
}

migrate().catch(console.error);
