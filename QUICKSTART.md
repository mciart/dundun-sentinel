# 快速开始 - 本地测试

## 一、最简单的方式（推荐新手）

```bash
# 1. 安装依赖
npm install

# 2. 启动本地开发（自动构建前端）
npm run dev
```

访问：`http://localhost:8787`

默认账号：`admin123456`

**注意：** 使用模拟 KV，数据重启后会丢失。

## 二、完整测试（需要真实 KV）

### 步骤 1：登录 Cloudflare

```bash
npx wrangler login
```

浏览器会自动打开，授权后即可。

### 步骤 2：创建 KV 命名空间

```bash
npx wrangler kv:namespace create MONITOR_DATA
```

**输出示例：**
```
🌀 Creating namespace with title "dundun-watch-MONITOR_DATA"
✨ Success!
Add the following to your wrangler.toml:
{ binding = "MONITOR_DATA", id = "abc123..." }
```

### 步骤 3：更新配置

编辑 `wrangler.toml`，取消注释并填入 KV ID：

```toml
kv_namespaces = [
  { binding = "MONITOR_DATA", id = "你的KV_ID" }
]
```

### 步骤 4：启动

```bash
npm run dev
```

访问：`http://localhost:8787`

## 三、前端独立开发（修改界面时）

```bash
# 终端 1：启动 Worker
npm run dev

# 终端 2：启动前端热重载
npm run dev:frontend
```

前端地址：`http://localhost:5173`

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 本地开发（完整模式） |
| `npm run dev:frontend` | 仅前端热重载 |
| `npm run build` | 构建前端 |
| `npm run deploy` | 部署到 Cloudflare |
| `npm run tail` | 查看线上日志 |

## 测试 API

### 登录
```bash
curl http://localhost:8787/api/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"password":"admin123456"}'
```

### 查看状态
```bash
curl http://localhost:8787/api/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 手动触发监控
```bash
curl http://localhost:8787/api/monitor/trigger \
  -X POST \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 遇到问题？

查看 [本地开发指南.md](./本地开发指南.md) 了解详细说明。
