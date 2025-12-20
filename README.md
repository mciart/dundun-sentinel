<div align="center">

# 炖炖哨兵

**dundun-sentinel**

轻量级网站监控系统 | 基于 Vercel | 完全免费 | 一键部署

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vercel](https://img.shields.io/badge/Vercel-Serverless-black)](https://vercel.com/)
[![GitHub Stars](https://img.shields.io/github/stars/mciart/dundun-sentinel?style=social)](https://github.com/mciart/dundun-sentinel)

[演示站点](https://dundun-sentinel.vercel.app/) · [快速部署](#-快速部署) · [功能特性](#-功能特性) · [本地开发](#-本地开发)

---

*慢慢炖，网站不"糊锅"*

</div>

---

## 🔄 相对原项目的主要更改

<!-- 按日期折叠的更新记录：新增条目请在最前面添加一个新的 <details> 区块 -->

<details>
<summary>2025年12月20 更新（点击展开）</summary>

| 更改 | 说明 |
|------|------|
| **迁移至 Vercel** | 项目从 Cloudflare Workers 迁移至 Vercel，使用 Vercel KV 存储数据 |
| **定时任务优化** | 监控间隔调整为 15 分钟一次，适配 Vercel Cron 限制 |

</details>

<details>
<summary>2025年12月19 更新（点击展开）</summary>

| 更改 | 说明 |
|------|------|
| **架构优化与重构** | 为提升长期可维护性，项目正在逐步重构为模块化架构 |
| **新增TCP 监控类型** | 你现在可以填写主机名添加 TCP 监控站点了 |
| **保持UI 风格统一** | 为 HTTP(S) 设置添加绿色卡片背景，与 DNS/TCP 风格统一 |
| **修复部分UI 问题** | 修复了点击"刷新"按钮（或执行排序、删除等操作）时，页面会跳动的问题 |
| **修复弹窗闪烁问题** | 修复了在页面中点击"添加站点 / 添加分类 / 编辑站点"会闪烁的问题 |
| **修复站点管理加载缓慢问题** | 优化了部分动画和修复了大部分区域会闪烁的问题 |
| **实现分组与站点的拖拽排序功能** | 你现在可以通过拖拽来调整分组和站点的顺序，超级丝滑！ |

</details>

<details>
<summary>2025年12月18 更新（点击展开）</summary>

| 更改 | 说明 |
|------|------|
| **新增后台设置页面** | 你现在可以在后台设置页面直接修改密码和后台路径，不用再改变量了 |
| **新增保留路径检测** | 保留路径检测，防止用户改成保留路径导致路径冲突和误操作 |
| **新增DNS 监控类型** | 你现在可以填写域名添加 DNS 监控站点了，且能与（如有期望值）匹配做出判断 |
| **优化SSL 证书检测** | 每小时检测一次（手动触发"立即检查"时仍会检测） |
| **优化DNS 查询** | 并行查询 A 和 AAAA 记录（最多 5 秒），DNS 解析时间减少 60%+ |
| **优化错误消息逻辑** | 错误提示更准确（域名不存在、无A记录、DNS服务器错误等） |
| **优化数据一致性** | 新增数据清理/维护功能，站点删除/修改后会自动清理相关历史数据和通知记录 |
| **优化密码安全性** | 管理员密码使用 SHA-256 哈希存储，不再明文保存！ |

</details>

---

<details>
<summary><b>🏗️ 模块化架构重构说明（点击展开）</b></summary>

为提升系统的可扩展性与可维护性，本项目已完成深度模块化重构。新的架构将核心逻辑、业务实现与接口层进行了清晰的解耦：

#### 核心层 (Core & Utils)
- **统一存储抽象 (`src/core/storage.js`)**：集中管理 Vercel KV 操作，屏蔽底层细节。
- **状态管理中心 (`src/core/state.js`)**：标准化的状态读写流程，确保数据一致性。
- **通用工具库 (`src/utils.js`)**：收敛所有基础工具函数，消除重复定义。

#### 业务逻辑层 (Services)
- **多协议监控 (`src/monitors/`)**：采用工厂模式，支持 **HTTP/HTTPS**、**DNS** (DoH) 及 **TCP**。
- **分发式通知 (`src/notifications/`)**：标准化的通知接口，便于集成 Telegram、Webhook、邮件等多种渠道。

#### 接口与分发层 (API & Routing)
- **控制器模式 (`src/api/controllers/`)**：将 `api.js` 拆分为 `auth` (认证)、`sites` (站点)、`config` (配置)、`dashboard` (仪表盘) 等独立模块。

</details>

---

## 📸 预览截图

<div align="center">

| 主页 - 浅色模式 | 主页 - 深色模式 |
|:---:|:---:|
| <img src="docs/1.png" alt="主页浅色模式" width="400"> | <img src="docs/2.png" alt="主页深色模式" width="400"> |

| 后台站点管理 - 浅色模式 | 后台站点管理 - 深色模式 |
|:---:|:---:|
| <img src="docs/3.png" alt="后台站点管理浅色模式" width="400"> | <img src="docs/4.png" alt="后台站点管理深色模式" width="400"> |

| 后台设置 - 浅色模式 | 后台通知 - 深色模式 |
|:---:|:---:|
| <img src="docs/5.png" alt="后台设置浅色模式" width="400"> | <img src="docs/6.png" alt="后台通知深色模式" width="400"> |

</div>

---

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 🌐 网站监控 | 支持 HTTP/HTTPS、DNS、TCP，自动检测在线状态 |
| ⏱️ 响应统计 | 记录响应时间，计算平均响应 |
| 🔒 SSL 监控 | 自动检测证书到期时间，提前预警 |
| 📊 历史记录 | 保留 30 天监控数据，状态条可视化 |
| 📁 分组管理 | 自定义分组，支持图标和颜色 |
| 💬 企业微信 | 站点异常时推送通知 |
| 📧 邮件通知 | 支持 Resend 邮件通知 |
| 🌙 深色模式 | 支持明暗主题切换 |
| 📱 响应式 | 适配手机、平板、电脑 |
| ⚙️ 高级配置 | 自定义请求方式、请求头、状态码、关键词检测 |

---

## 🚀 快速部署

> 📌 **重要提示**：Vercel 已将 KV 数据库移至 **Marketplace**，不再在 Storage 页面直接显示。
> 
> 详细图文教程请查看：[VERCEL_DEPLOY.md](VERCEL_DEPLOY.md)

### 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmciart%2Fdundun-sentinel&env=CRON_SECRET&envDescription=Cron%20%E4%BB%BB%E5%8A%A1%E5%AF%86%E9%92%A5%EF%BC%8C%E7%94%A8%E4%BA%8E%E4%BF%9D%E6%8A%A4%E5%AE%9A%E6%97%B6%E4%BB%BB%E5%8A%A1&project-name=dundun-sentinel&repository-name=dundun-sentinel)

⚠️ **一键部署后还需要手动创建并连接 KV 数据库！** 请继续阅读下方步骤。

### 手动部署步骤

整个过程约 **5 分钟**，无需编程知识。

#### 第一步：Fork 项目

1. 打开 [dundun-sentinel](https://github.com/mciart/dundun-sentinel)
2. 点击右上角 **Fork** 按钮
3. 点击 **Create fork** 完成

#### 第二步：创建 Vercel KV 数据库

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击顶部导航栏的 **Marketplace**
3. 在搜索框搜索 **KV**，或直接访问 [Vercel KV 市场页面](https://vercel.com/marketplace/kv)
4. 点击 **Install** 或 **Add**
5. 选择你的团队/账户
6. 为数据库命名（如 `dundun-sentinel-kv`）
7. 点击 **Create** 完成创建

#### 第三步：导入项目到 Vercel

1. 在 [Vercel Dashboard](https://vercel.com/dashboard) 点击 **Add New** → **Project**
2. 选择你 Fork 的 `dundun-sentinel` 仓库
3. 点击 **Import**

#### 第四步：连接 KV 数据库到项目

1. 在项目页面，点击 **Settings** → **Storage**
2. 点击 **Connect Database**
3. 选择刚创建的 `dundun-sentinel-kv` 数据库
4. 点击 **Connect**

这会自动配置 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN` 环境变量。

#### 第五步：配置额外的环境变量

在项目 **Settings** → **Environment Variables** 中添加：

| Name | Value | 说明 |
|------|-------|------|
| `CRON_SECRET` | 随机字符串 | 保护定时任务，自己生成一个（如 `openssl rand -base64 32`） |

#### 第六步：部署

点击 **Deployments** → **Redeploy** 重新部署项目。

**默认后台地址：** `你的域名/admin`  
**默认密码：** `admin`

> ⚠️ **安全建议**：部署成功后，请立即登录后台修改默认密码！

---

## 🔄 更新与重新部署

### 同步最新版本

Fork 项目后，如果原项目有更新，你可以同步最新代码：

1. 打开你 Fork 的项目页面
2. 点击代码区域上方的 **Sync fork** 按钮
3. 点击 **Update branch** 同步最新代码
4. Vercel 会自动重新部署

---

## 🌐 自定义域名配置

1. 进入 Vercel 项目 → **Settings** → **Domains**
2. 点击 **Add Domain**
3. 输入你的域名（如 `status.example.com`）
4. 按照提示配置 DNS 记录
5. 等待 DNS 生效即可

---

## 📖 使用说明

### 添加监控站点

1. 登录后台（默认密码 `admin`）
2. 点击 **添加站点**
3. 填写名称和 URL
4. 可选：配置高级选项（请求方式、请求头等）
5. 保存

### 通知设置

1. 切换到 **通知设置** 标签
2. 开启通知 → 配置企业微信 Webhook 或 Resend 邮件
3. 点击 **发送测试** 验证

### 修改密码/后台路径

登录后台 → 切换到 **后台设置** 标签 → 修改密码或后台路径

> 💡 在后台修改的设置会存储到 KV 数据库，后续更新部署时不会被覆盖。

---

## 💻 本地开发

### 环境要求

- Node.js 18+
- npm 或 pnpm
- Vercel CLI

### 快速启动

```bash
# 克隆项目
git clone https://github.com/mciart/dundun-sentinel.git
cd dundun-sentinel

# 安装依赖
npm install
cd frontend && npm install && cd ..

# 启动开发服务器
npm run dev
```

访问：`http://localhost:3000`

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 本地开发（Vercel Dev） |
| `npm run dev:frontend` | 仅启动前端热重载 |
| `npm run build` | 构建前端 |
| `npm run deploy` | 部署到 Vercel |

### 项目结构

```
dundun-sentinel/
├── api/                           # Vercel Serverless Functions
│   ├── [...path].js               # API 路由入口
│   └── cron/
│       ├── monitor.js             # 定时监控任务（每15分钟）
│       └── cert-check.js          # SSL证书检测（每天凌晨4点）
├── src/                           # 业务逻辑
│   ├── api.js                     # API 处理
│   ├── monitor.js                 # 监控核心逻辑
│   ├── utils.js                   # 工具函数
│   ├── core/
│   │   ├── storage.js             # Vercel KV 存储抽象
│   │   └── state.js               # 状态管理
│   ├── monitors/                  # 监控协议实现
│   │   ├── index.js               # 监控工厂
│   │   ├── http.js                # HTTP/HTTPS 监控
│   │   ├── dns.js                 # DNS 监控
│   │   └── tcp.js                 # TCP 端口监控
│   ├── notifications/             # 通知渠道
│   │   ├── index.js
│   │   ├── wecom.js               # 企业微信
│   │   └── email.js               # 邮件通知
│   └── api/controllers/           # API 控制器
│       ├── auth.js
│       ├── sites.js
│       ├── config.js
│       └── dashboard.js
├── frontend/                      # 前端项目 (React + Vite)
│   ├── src/
│   ├── public/
│   └── dist/                      # 构建产物
├── vercel.json                    # Vercel 配置
├── package.json
└── README.md
```

---

## ❓ 常见问题

<details>
<summary><b>部署失败怎么办？</b></summary>

1. 检查 Vercel KV 是否已创建并连接到项目
2. 检查环境变量是否正确配置
3. 查看 Vercel 部署日志定位错误

</details>

<details>
<summary><b>监控间隔是多久？</b></summary>

默认每 **15 分钟** 检测一次所有站点。这是为了适配 Vercel Cron 免费版每天 100 次的限制。

</details>

<details>
<summary><b>数据保留多久？</b></summary>

默认保留 30 天历史数据。

</details>

<details>
<summary><b>有使用限制吗？</b></summary>

Vercel 免费版限制：
- Serverless Functions：每月 100GB-Hours
- Cron Jobs：每天 100 次调用
- KV：每天 3000 次读取，1000 次写入

个人使用完全够用。

</details>

---

## 🛠️ 技术栈

| 类型 | 技术 |
|------|------|
| 前端 | React + Vite + TailwindCSS |
| 后端 | Vercel Serverless Functions |
| 数据库 | Vercel KV |
| 部署 | Vercel |

---

## 📄 开源协议

本项目基于 [MIT](LICENSE) 协议开源。

---

<div align="center">

### ⭐ 如果觉得项目不错，欢迎点个 Star 支持一下！

</div>
