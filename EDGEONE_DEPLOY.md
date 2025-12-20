# EdgeOne 部署快速指南

## 📌 前置要求

- 腾讯云账号
- 已开通 EdgeOne 服务
- 已有域名（需要在 EdgeOne 中接入）

## ✨ 使用 Node Functions

本项目使用 **EdgeOne Node Functions**（完整 Node.js 环境），支持：
- ✅ **原生 TCP 端口监控**（使用 `net` 模块）
- ✅ 完整的 NPM 生态
- ✅ 更宽松的运行时限制

---

## 🚀 快速部署步骤

### 1️⃣ Fork 项目

访问 [dundun-sentinel](https://github.com/mciart/dundun-sentinel) 并 Fork 到你的 GitHub 账户。

---

### 2️⃣ 在 EdgeOne 创建站点

1. 登录 [腾讯云 EdgeOne 控制台](https://console.cloud.tencent.com/edgeone)
2. 点击 **添加站点**
3. 输入你的域名
4. 按照提示完成 DNS 配置或 CNAME 接入
5. 等待站点生效

---

### 3️⃣ 创建 KV 命名空间

1. 进入你的站点管理页面
2. 点击左侧菜单 **边缘函数** → **KV 存储**
3. 点击 **创建命名空间**
4. 命名空间名称：`dundun_sentinel_kv`（⚠️ 只支持字母、数字和下划线）
5. 点击 **确定** 创建
6. 记录命名空间 ID（后续绑定需要）

---

### 4️⃣ 部署到 EdgeOne Pages

#### 通过 GitHub 自动部署（推荐）

1. 在 EdgeOne 控制台，进入 **边缘函数** → **Pages**
2. 点击 **创建项目**
3. 连接你的 GitHub 仓库（选择 `edgeone` 分支）
4. EdgeOne 会自动识别 `node-functions` 目录
5. 配置构建设置（通常自动检测）：
   - 构建命令：`npm run build`
   - 输出目录：`dist`
6. 点击 **部署**

#### 配置 KV 绑定

1. 在项目设置中，找到 **环境变量**
2. 添加 KV 绑定：
   - 变量名：`MONITOR_DATA`
   - 类型：KV 命名空间
   - 选择之前创建的 KV 命名空间
3. 保存并重新部署

---

### 5️⃣ 配置定时任务

使用 EdgeOne 的定时触发器，通过 HTTP 请求触发监控：

#### 配置监控定时任务

1. 在 EdgeOne 控制台，进入 **边缘函数** → **触发器**
2. 点击 **新建触发器**
3. 配置：
   - 触发器名称：`monitor_cron`
   - 触发类型：**定时触发**
   - Cron 表达式：`*/15 * * * *`（每15分钟）
   - 请求 URL：`https://你的域名/api/trigger-check`
   - 请求方法：POST
   - 请求头：添加管理员认证（在后台登录后获取 token）
4. 保存

> 💡 **提示**：你也可以在后台手动点击"立即检查"来触发监控

---

### 6️⃣ 静态资源部署

使用 EdgeOne Pages 时，静态资源会自动部署：
1. EdgeOne 自动构建前端（执行 `npm run build`）
2. 将 `dist` 目录作为静态资源托管
3. 将 `/api/*` 路由到 `node-functions`

无需手动配置！

---

### 7️⃣ 配置环境变量

在 EdgeOne Pages 项目设置中添加环境变量：

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `MONITOR_DATA` | KV 命名空间绑定 | ✅ 是 |
| `NODE_ENV` | 运行环境 | ❌ 否 |

---

## ✅ 部署完成

访问你的域名，例如：
- 首页：`https://你的域名/`
- 后台：`https://你的域名/admin`
- 默认密码：`admin`

⚠️ **立即修改密码！** 登录后台 → 后台设置 → 修改密码

---

## ❓ 常见问题

### Q: 边缘函数如何调试？
A: 在 EdgeOne 控制台的函数管理中，可以查看函数的执行日志。

### Q: KV 存储有什么限制？
A: EdgeOne KV 存储有一定的免费额度，具体请参考 [EdgeOne 计费说明](https://cloud.tencent.com/document/product/1552/77380)。

### Q: 定时任务没有执行？
A: 检查触发规则配置是否正确，确保 Cron 表达式格式正确。

### Q: 如何查看监控日志？
A: 在 EdgeOne 控制台 → 边缘函数 → 日志查询中可以查看函数执行日志。

---

## 📚 相关文档

- [EdgeOne 边缘函数文档](https://cloud.tencent.com/document/product/1552/84023)
- [EdgeOne KV 存储文档](https://cloud.tencent.com/document/product/1552/83932)
- [EdgeOne 定时触发器文档](https://cloud.tencent.com/document/product/1552/84024)
