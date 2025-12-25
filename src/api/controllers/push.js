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
# 炖炖哨兵 - 主机心跳脚本 (增强版)
# 建议添加到 crontab: */1 * * * * /path/to/heartbeat.sh
# 调试模式: DEBUG=1 /path/to/heartbeat.sh

# 目标服务器（用于延迟检测）
TARGET_HOST="${targetHost}"

# 是否启用调试输出
DEBUG=\${DEBUG:-0}

log() {
  [ "$DEBUG" = "1" ] && echo "[DEBUG] $1" >&2
}

# 获取 CPU 使用率（需要两次采样）
get_cpu() {
  # 第一次采样
  read cpu1 nice1 system1 idle1 rest1 < /proc/stat 2>/dev/null
  if [ -z "$idle1" ]; then
    log "CPU: /proc/stat 读取失败"
    echo "0"
    return
  fi
  
  # 等待 0.5 秒
  sleep 0.5
  
  # 第二次采样
  read cpu2 nice2 system2 idle2 rest2 < /proc/stat 2>/dev/null
  
  # 计算差值
  idle_diff=$((idle2 - idle1))
  total_diff=$(( (cpu2 + nice2 + system2 + idle2) - (cpu1 + nice1 + system1 + idle1) ))
  
  if [ "$total_diff" -gt 0 ]; then
    usage=$(awk "BEGIN {printf \\"%.1f\\", (1 - $idle_diff / $total_diff) * 100}")
    log "CPU: $usage%"
    echo "$usage"
  else
    log "CPU: 计算失败 (total_diff=0)"
    echo "0"
  fi
}

# 获取内存使用率
get_memory() {
  mem=$(awk '/MemTotal/{t=$2} /MemAvailable/{a=$2} END{if(t>0) printf "%.1f", (t-a)/t*100}' /proc/meminfo 2>/dev/null)
  if [ -n "$mem" ]; then
    log "内存: $mem%"
    echo "$mem"
    return
  fi
  # 备用: 使用 free 命令
  mem=$(free 2>/dev/null | awk '/Mem:/ {printf "%.1f", $3/$2 * 100}')
  if [ -n "$mem" ]; then
    log "内存 (free): $mem%"
    echo "$mem"
    return
  fi
  log "内存: 获取失败"
  echo "0"
}

# 获取磁盘使用率
get_disk() {
  # 尝试使用 df 命令获取根分区使用率
  disk=$(df -P / 2>/dev/null | awk 'NR==2 {gsub(/%/,""); print $5}')
  if [ -n "$disk" ] && [ "$disk" -ge 0 ] 2>/dev/null; then
    log "磁盘: $disk%"
    echo "$disk"
    return
  fi
  # 备用方法：直接解析
  disk=$(df / 2>/dev/null | tail -1 | awk '{gsub(/%/,""); print $(NF-1)}')
  if [ -n "$disk" ] && [ "$disk" -ge 0 ] 2>/dev/null; then
    log "磁盘 (备用): $disk%"
    echo "$disk"
    return
  fi
  log "磁盘: 获取失败"
  echo "0"
}

# 获取系统负载
get_load() {
  load=$(awk '{print $1}' /proc/loadavg 2>/dev/null)
  if [ -n "$load" ]; then
    log "负载: $load"
    echo "$load"
    return
  fi
  log "负载: 获取失败"
  echo "0"
}

# 获取运行时间（秒）
get_uptime() {
  up=$(awk '{print int($1)}' /proc/uptime 2>/dev/null)
  if [ -n "$up" ]; then
    log "运行时间: $up 秒"
    echo "$up"
    return
  fi
  log "运行时间: 获取失败"
  echo "0"
}

# 获取 CPU 温度
get_temperature() {
  if [ -f /sys/class/thermal/thermal_zone0/temp ]; then
    temp=$(cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null)
    if [ -n "$temp" ] && [ "$temp" -gt 0 ] 2>/dev/null; then
      result=$((temp / 1000))
      log "温度: $result°C"
      echo "$result"
      return
    fi
  fi
  for f in /sys/class/hwmon/hwmon*/temp1_input; do
    if [ -f "$f" ]; then
      temp=$(cat "$f" 2>/dev/null)
      if [ -n "$temp" ]; then
        result=$((temp / 1000))
        log "温度 (hwmon): $result°C"
        echo "$result"
        return
      fi
    fi
  done 2>/dev/null
  log "温度: 无法获取"
}

# 获取到目标服务器的延迟
get_latency() {
  # 使用 curl 测量 HTTPS 连接时间
  latency=$(curl -o /dev/null -s -w '%{time_connect}' --connect-timeout 5 "https://$TARGET_HOST" 2>/dev/null)
  if [ -n "$latency" ] && [ "$latency" != "0.000000" ]; then
    result=$(echo "$latency" | awk '{printf "%.0f", $1 * 1000}')
    log "延迟: \${result}ms"
    echo "$result"
    return
  fi
  # 备用: 使用 ping
  latency=$(ping -c 1 -W 5 "$TARGET_HOST" 2>/dev/null | grep -oP 'time=\\K[0-9.]+')
  if [ -n "$latency" ]; then
    result=\${latency%.*}
    log "延迟 (ping): \${result}ms"
    echo "$result"
    return
  fi
  log "延迟: 无法获取"
  echo "0"
}

# 收集数据
log "=== 开始收集系统信息 ==="
CPU=$(get_cpu)
MEM=$(get_memory)
DISK=$(get_disk)
LOAD=$(get_load)
UPTIME=$(get_uptime)
TEMP=$(get_temperature)
LATENCY=$(get_latency)

# 构建 JSON
JSON='{"cpu":'$CPU',"memory":'$MEM',"disk":'$DISK',"load":'$LOAD',"uptime":'$UPTIME',"latency":'$LATENCY
if [ -n "$TEMP" ]; then
  JSON=$JSON',"temperature":'$TEMP'}'
else
  JSON=$JSON'}'
fi

log "发送数据: $JSON"

# 发送心跳
RESPONSE=$(curl -s -X POST "${endpoint}" -H "Content-Type: application/json" -d "$JSON" 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  log "发送成功"
  [ "$DEBUG" = "1" ] && echo "$RESPONSE" >&2
else
  log "发送失败: 退出码 $EXIT_CODE"
  echo "ERROR: 心跳发送失败" >&2
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
