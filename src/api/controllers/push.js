// Push/心跳监控 API 控制器 - D1 版本（直接写入数据库，无内存缓存）
import { getAllSites, getSite, updatePushHeartbeat } from '../../core/storage.js';
import { jsonResponse, errorResponse, corsHeaders } from '../../utils.js';
import { generatePushToken, isValidPushToken } from '../../monitors/push.js';

/**
 * 处理心跳上报 - 公开接口，通过 Token 验证
 * POST /api/push/:token
 * 
 * D1 版本：直接写入数据库，无需担心写入配额
 */
export async function handlePushReport(request, env, token) {
  try {
    // 验证 Token 格式
    if (!token || !isValidPushToken(token)) {
      return errorResponse('无效的 Token', 400);
    }

    const sites = await getAllSites(env);

    // 查找对应的站点
    const site = sites.find(s => s.pushToken === token && s.monitorType === 'push');

    if (!site) {
      return errorResponse('站点不存在或 Token 无效', 404);
    }

    // 获取上报数据
    let pushData = {};
    try {
      if (request.method === 'POST') {
        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          pushData = await request.json();
        }
      }
    } catch (e) {
      // 即使没有数据也允许心跳
      console.log('Push 数据解析失败，仅记录心跳:', e.message);
    }

    const now = Date.now();

    const heartbeatData = {
      pushData: {
        cpu: pushData.cpu ?? null,
        memory: pushData.memory ?? pushData.mem ?? pushData.ram ?? null,
        disk: pushData.disk ?? null,
        load: pushData.load ?? null,
        uptime: pushData.uptime ?? null,
        network: pushData.network ?? null,
        temperature: pushData.temperature ?? pushData.temp ?? null,
        latency: pushData.latency ?? 0,
        custom: pushData.custom ?? null,
        reportedAt: now
      },
      responseTime: pushData.latency || 0
    };

    // 直接写入 D1 数据库（包含站点状态和历史记录）
    await updatePushHeartbeat(env, site.id, heartbeatData);

    console.log(`📡 收到心跳: ${site.name} (已写入 D1)`);

    return jsonResponse({
      success: true,
      message: '心跳已记录',
      timestamp: now,
      siteId: site.id,
      siteName: site.name
    });
  } catch (error) {
    console.error('处理心跳上报失败:', error);
    return errorResponse('处理失败: ' + error.message, 500);
  }
}

/**
 * 生成新的 Push Token
 * POST /api/sites/:id/regenerate-token
 */
export async function regeneratePushToken(request, env, siteId) {
  try {
    const site = await getSite(env, siteId);

    if (!site) {
      return errorResponse('站点不存在', 404);
    }

    if (site.monitorType !== 'push') {
      return errorResponse('该站点不是 Push 监控类型', 400);
    }

    const newToken = generatePushToken();

    // 直接更新数据库中的 token
    const { updateSite } = await import('../../core/storage.js');
    await updateSite(env, siteId, { pushToken: newToken });

    return jsonResponse({
      success: true,
      token: newToken
    });
  } catch (error) {
    return errorResponse('生成 Token 失败: ' + error.message, 500);
  }
}

/**
 * 获取 Push 站点的配置信息（包含脚本示例）
 * GET /api/sites/:id/push-config
 */
export async function getPushConfig(request, env, siteId) {
  try {
    const site = await getSite(env, siteId);

    if (!site) {
      return errorResponse('站点不存在', 404);
    }

    if (site.monitorType !== 'push') {
      return errorResponse('该站点不是 Push 监控类型', 400);
    }

    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const pushEndpoint = `${baseUrl}/api/push/${site.pushToken}`;

    // 生成各种脚本示例
    const scripts = {
      curl: generateCurlScript(pushEndpoint),
      bash: generateBashScript(pushEndpoint),
      python: generatePythonScript(pushEndpoint),
      powershell: generatePowerShellScript(pushEndpoint),
      node: generateNodeScript(pushEndpoint)
    };

    return jsonResponse({
      success: true,
      config: {
        siteId: site.id,
        siteName: site.name,
        token: site.pushToken,
        endpoint: pushEndpoint,
        timeoutMinutes: site.pushTimeoutMinutes || 3,
        scripts
      }
    });
  } catch (error) {
    return errorResponse('获取配置失败: ' + error.message, 500);
  }
}

// 生成各种脚本示例
function generateCurlScript(endpoint) {
  return `# 简单心跳
curl -X POST "${endpoint}"

# 带系统信息的心跳
curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -d '{"cpu": 25.5, "memory": 60.2, "disk": 45.0}'`;
}

function generateBashScript(endpoint) {
  // 从 endpoint 提取域名
  const urlObj = new URL(endpoint);
  const targetHost = urlObj.hostname;

  return `#!/bin/bash
# 炖炖哨兵 - 主机心跳脚本
# 建议添加到 crontab: */1 * * * * /path/to/heartbeat.sh
# 调试模式: DEBUG=1 /path/to/heartbeat.sh

TARGET_HOST="${targetHost}"
DEBUG="\${DEBUG:-0}"

log() { [ "\$DEBUG" = "1" ] && echo "[DEBUG] \$1" >&2; }

# 获取 CPU 使用率 (使用 /proc/stat 两次采样)
get_cpu() {
  # 读取第一次采样
  local stat1=$(head -1 /proc/stat 2>/dev/null)
  if [ -z "\$stat1" ]; then
    log "CPU: 读取失败"
    echo "0"
    return
  fi
  local idle1=$(echo "\$stat1" | awk '{print \$5}')
  local total1=$(echo "\$stat1" | awk '{print \$2+\$3+\$4+\$5+\$6+\$7+\$8}')
  
  sleep 0.5
  
  # 读取第二次采样
  local stat2=$(head -1 /proc/stat 2>/dev/null)
  local idle2=$(echo "\$stat2" | awk '{print \$5}')
  local total2=$(echo "\$stat2" | awk '{print \$2+\$3+\$4+\$5+\$6+\$7+\$8}')
  
  # 计算使用率
  local idle_diff=\$((idle2 - idle1))
  local total_diff=\$((total2 - total1))
  
  if [ "\$total_diff" -gt 0 ] 2>/dev/null; then
    local usage=$(awk "BEGIN {printf \\"%.1f\\", (1 - \$idle_diff / \$total_diff) * 100}")
    log "CPU: \$usage%"
    echo "\$usage"
  else
    log "CPU: 计算失败"
    echo "0"
  fi
}

# 获取内存使用率
get_memory() {
  local mem=$(awk '/MemTotal/{t=\$2} /MemAvailable/{a=\$2} END{if(t>0) printf "%.1f", (t-a)/t*100}' /proc/meminfo 2>/dev/null)
  if [ -n "\$mem" ]; then
    log "内存: \$mem%"
    echo "\$mem"
  else
    log "内存: 获取失败"
    echo "0"
  fi
}

# 获取磁盘使用率
get_disk() {
  local disk=$(df -P / 2>/dev/null | awk 'NR==2 {gsub(/%/,""); print \$5}')
  if [ -n "\$disk" ] && [ "\$disk" -ge 0 ] 2>/dev/null; then
    log "磁盘: \$disk%"
    echo "\$disk"
  else
    log "磁盘: 获取失败"
    echo "0"
  fi
}

# 获取系统负载
get_load() {
  local load=$(awk '{print \$1}' /proc/loadavg 2>/dev/null)
  [ -n "\$load" ] && log "负载: \$load" && echo "\$load" || echo "0"
}

# 获取运行时间（秒）
get_uptime() {
  local up=$(awk '{print int(\$1)}' /proc/uptime 2>/dev/null)
  [ -n "\$up" ] && log "运行: \$up秒" && echo "\$up" || echo "0"
}

# 获取 CPU 温度
get_temperature() {
  if [ -f /sys/class/thermal/thermal_zone0/temp ]; then
    local temp=$(cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null)
    if [ -n "\$temp" ] && [ "\$temp" -gt 0 ] 2>/dev/null; then
      log "温度: \$((temp/1000))°C"
      echo \$((temp/1000))
      return
    fi
  fi
}

# 获取延迟
get_latency() {
  local latency=$(curl -o /dev/null -s -w '%{time_connect}' --connect-timeout 5 "https://\$TARGET_HOST" 2>/dev/null)
  if [ -n "\$latency" ] && [ "\$latency" != "0.000000" ]; then
    local ms=$(echo "\$latency" | awk '{printf "%.0f", \$1 * 1000}')
    log "延迟: \${ms}ms"
    echo "\$ms"
  else
    echo "0"
  fi
}

# 收集数据
log "=== 收集系统信息 ==="
CPU=\$(get_cpu)
MEM=\$(get_memory)
DISK=\$(get_disk)
LOAD=\$(get_load)
UPTIME=\$(get_uptime)
TEMP=\$(get_temperature)
LATENCY=\$(get_latency)

# 构建 JSON
JSON='{"cpu":'\$CPU',"memory":'\$MEM',"disk":'\$DISK',"load":'\$LOAD',"uptime":'\$UPTIME',"latency":'\$LATENCY
[ -n "\$TEMP" ] && JSON=\$JSON',"temperature":'\$TEMP'}' || JSON=\$JSON'}'

log "发送: \$JSON"

# 发送心跳
RESP=\$(curl -s -X POST "${endpoint}" -H "Content-Type: application/json" -d "\$JSON" 2>&1)
if [ \$? -eq 0 ]; then
  log "成功: \$RESP"
else
  echo "ERROR: 发送失败" >&2
  exit 1
fi`;
}

function generatePythonScript(endpoint) {
  return `#!/usr/bin/env python3
# 炖炖哨兵 - 主机心跳脚本 (Python)
# 使用: python3 heartbeat.py
# 定时: crontab -e 添加 */1 * * * * /usr/bin/python3 /path/to/heartbeat.py

import urllib.request
import json
import subprocess
import os

def get_cpu():
    try:
        load = os.getloadavg()[0]
        cpu_count = os.cpu_count() or 1
        return round(load / cpu_count * 100, 1)
    except:
        return 0

def get_memory():
    try:
        with open('/proc/meminfo', 'r') as f:
            lines = f.readlines()
        total = int([l for l in lines if 'MemTotal' in l][0].split()[1])
        available = int([l for l in lines if 'MemAvailable' in l][0].split()[1])
        return round((total - available) / total * 100, 1)
    except:
        return 0

def get_disk():
    try:
        stat = os.statvfs('/')
        total = stat.f_blocks * stat.f_frsize
        free = stat.f_bfree * stat.f_frsize
        return round((total - free) / total * 100, 1)
    except:
        return 0

def get_uptime():
    try:
        with open('/proc/uptime', 'r') as f:
            return int(float(f.read().split()[0]))
    except:
        return 0

def get_load():
    try:
        return os.getloadavg()[0]
    except:
        return 0

def get_temperature():
    # 方式1: thermal_zone
    try:
        with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
            return round(int(f.read().strip()) / 1000, 1)
    except:
        pass
    # 方式2: hwmon
    import glob
    for path in glob.glob('/sys/class/hwmon/hwmon*/temp1_input'):
        try:
            with open(path, 'r') as f:
                return round(int(f.read().strip()) / 1000, 1)
        except:
            pass
    return None

def send_heartbeat():
    data = {
        'cpu': get_cpu(),
        'memory': get_memory(),
        'disk': get_disk(),
        'load': get_load(),
        'uptime': get_uptime()
    }
    
    temp = get_temperature()
    if temp is not None:
        data['temperature'] = temp
    
    req = urllib.request.Request(
        '${endpoint}',
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"心跳发送成功: {resp.read().decode()}")
    except Exception as e:
        print(f"心跳发送失败: {e}")

if __name__ == '__main__':
    send_heartbeat()`;
}

function generatePowerShellScript(endpoint) {
  return `# 炖炖哨兵 - 主机心跳脚本 (PowerShell)
# Windows 定时任务设置方法:
# 1. 打开 任务计划程序
# 2. 创建基本任务 -> 每天/触发器选择"重复任务"间隔1分钟

$endpoint = "${endpoint}"

# 获取 CPU 使用率
$cpu = (Get-Counter '\\Processor(_Total)\\% Processor Time' -ErrorAction SilentlyContinue).CounterSamples[0].CookedValue
if (-not $cpu) { $cpu = 0 }

# 获取内存使用率
$os = Get-CimInstance Win32_OperatingSystem
$memory = [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / $os.TotalVisibleMemorySize * 100, 1)

# 获取磁盘使用率
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
$diskUsage = [math]::Round(($disk.Size - $disk.FreeSpace) / $disk.Size * 100, 1)

# 获取运行时间
$uptime = (Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime
$uptimeSeconds = [int]$uptime.TotalSeconds

$body = @{
    cpu = [math]::Round($cpu, 1)
    memory = $memory
    disk = $diskUsage
    uptime = $uptimeSeconds
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri $endpoint -Method Post -Body $body -ContentType 'application/json'
    Write-Host "心跳发送成功"
} catch {
    Write-Host "心跳发送失败: $_"
}`;
}

function generateNodeScript(endpoint) {
  return `#!/usr/bin/env node
// 炖炖哨兵 - 主机心跳脚本 (Node.js)
// 使用: node heartbeat.js
// 定时: crontab -e 添加 */1 * * * * /usr/bin/node /path/to/heartbeat.js

const https = require('https');
const http = require('http');
const os = require('os');
const fs = require('fs');

function getCpuUsage() {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  cpus.forEach(cpu => {
    for (let type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });
  return Math.round((1 - totalIdle / totalTick) * 100 * 10) / 10;
}

function getMemoryUsage() {
  const total = os.totalmem();
  const free = os.freemem();
  return Math.round((total - free) / total * 100 * 10) / 10;
}

function getDiskUsage() {
  try {
    const stat = fs.statfsSync('/');
    const total = stat.blocks * stat.bsize;
    const free = stat.bfree * stat.bsize;
    return Math.round((total - free) / total * 100 * 10) / 10;
  } catch {
    return 0;
  }
}

const data = JSON.stringify({
  cpu: getCpuUsage(),
  memory: getMemoryUsage(),
  disk: getDiskUsage(),
  uptime: Math.floor(os.uptime()),
  load: os.loadavg()[0]
});

const url = new URL('${endpoint}');
const client = url.protocol === 'https:' ? https : http;

const req = client.request({
  hostname: url.hostname,
  port: url.port || (url.protocol === 'https:' ? 443 : 80),
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('心跳发送成功:', body));
});

req.on('error', (e) => console.error('心跳发送失败:', e.message));
req.write(data);
req.end();`;
}
