<div align="center">

# 炖炖守望（增强版）

**dundun-watch**

轻量级网站监控系统 | 基于 Cloudflare Workers | 完全免费 | 一键部署

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)
[![GitHub Stars](https://img.shields.io/github/stars/mciart/dundun-watch?style=social)](https://github.com/mciart/dundun-watch)

[演示站点](https://dundun-watch.mciart.workers.dev/) · [快速部署](#-快速部署) · [功能介绍](#-功能特性) · [本地开发](#-本地开发)

---

*慢慢炖，网站不"糊锅"*

</div>

---

## 🔄 相对原项目的主要更改

<!-- 按日期折叠的更新记录：新增条目请在最前面添加一个新的 <details> 区块 -->

<details>
<summary>2025年12月19 更新（点击展开）</summary>

| 更改 | 说明 |
|------|------|
| **架构优化与重构** | 为提升长期可维护性，项目正在逐步重构为模块化架构 |
| **新增TCP 监控类型** | 你现在可以填写主机名添加 TCP 监控站点了 |
| **保持UI 风格统一** | 为 HTTP(S) 设置添加绿色卡片背景，与 DNS/TCP 风格统一 |
| **修复部分UI 问题** | 修复了点击“刷新”按钮（或执行排序、删除等操作）时，页面会跳动的问题 |
| **修复弹窗闪烁问题** | 修复了在页面中点击“添加站点 / 添加分类 / 编辑站点”会闪烁的问题 |
| **修复站点管理加载缓慢问题** | 优化了部分动画和修复了大部分区域会闪烁的问题 |
| **实现分组与站点的拖拽排序功能** | 你现在可以通过拖拽来调整分组和站点的顺序，超级丝滑！ |

</details>

<details>
<summary>2025年12月18 更新（点击展开）</summary>

| 更改 | 说明 |
|------|------|
| **Workers + Pages 合并** | 将 Cloudflare Workers 和 Pages 合二为一，简化部署流程 |
| **新增后台设置页面** | 你现在可以在后台设置页面直接修改密码和后台路径，不用再改变量了 |
| **新增保留路径检测** | 保留路径检测，防止用户改成保留路径导致路径冲突和误操作，同时你也能改成login了 |
| **新增DNS 监控类型** | 你现在可以填写域名添加 DNS 监控站点了，且能与（如有期望值）匹配做出判断 |
| **优化SSL 证书检测** | 每小时检测一次（手动触发"立即检查"时仍会检测）防止你不小心错误更换证书 |
| **优化DNS 查询** | 并行查询 A 和 AAAA 记录（最多 5 秒），DNS 解析时间减少 60%+ |
| **优化错误消息逻辑** | 错误提示更准确（域名不存在、无A记录、DNS服务器错误等） |
| **优化数据一致性** | 新增数据清理/维护功能，站点删除/修改后会自动清理相关历史数据和通知记录 |
| **优化密码安全性** | 管理员密码使用 SHA-256 哈希存储，不再明文保存！ |
| **优化本地开发测试** | 提升本地开发体验：支持更多调试功能，KV 数据存储在内存中重启服务后数据会丢失 |
| **修复主题开关错误** | 修复自动调整为深色模式时，开关显示在浅色模式位置的问题 |
| **修复Favicon 不显示** | 修复 favicon.ico 图标不显示的问题 |
| **修复URL 变更数据错误** | 现在更新站点时处理 URL 变更，重置检测状态并清除历史记录 |
| **依赖更新** | 更新前端依赖包，提升性能和安全性 |
| **文档完善** | 补充更详细的部署和使用说明，新增常见问题解答 |

</details>

---

<details>
<summary><b>🏗️ 模块化重构与迁移指南（点击展开）</b></summary>

为提升长期可维护性，项目正在逐步重构为模块化架构（监控器、通知器、存储层、API 控制器等）。目前已完成的改动：

- 抽取监控协议实现至 `src/monitors/`（支持 HTTP/DNS/TCP，便于扩展 MySQL/Redis/SSH 等）
- 抽取通知渠道至 `src/notifications/`，分发器模式初步成型，便于后续集成短信/Webhook/Telegram
- 增加 `src/core/storage.js`，初步实现存储层抽象
- API 路由与控制器分离，部分接口已迁移，提升可维护性
- 支持 mock 调试模式，便于本地开发与单元测试

迁移（分阶段）：
1. 抽取监控实现（已完成）→ 2. 抽取通知实现（已完成）→ 3. 拆分 API 为 `router + controllers`（进行中）→ 4. 重构存储层并编写迁移脚本（计划）→ 5. 添加单元测试、CI 校验与文档完善（计划）。

本次重构的好处：
- 新增一种监控（如 MySQL、SSH）只需新增 `src/monitors/mysql.js` 并在工厂中注册；无需修改主调度逻辑。
- 新增通知渠道只需在 `src/notifications/` 下实现 `send()` 并在分发器配置里注册。
- 存储分层后便于将历史与配置分离，避免单一大 JSON 导致的 KV 性能问题。

> 💡 本地调试提示：在站点配置中添加 `mock` 字段（例如 `{ mock: { forceStatus: 'offline', message: '模拟故障' } }`）以便测试告警与防抖流程。

</details>

## 📋 计划更新

以下功能正在计划中，欢迎提交 Issue 或 PR：

| 检测类别         | 实现方式(不依赖第三方)        | 备注                                                         | 状态 |
|------------------|----------------------------------|--------------------------------------------------------------|------|
| HTTP(S) 全类 | 原生 fetch()                     | 包含关键字、JSON 路径、Header 校验。                         | 完成 |
| TCP Port     | cloudflare:sockets                | 直接进行 TCP 三次握手。                                       | 完成 |
| DNS          | 1.1.1.1 DoH API                   | 虽是 API，但属于 Cloudflare 自家原生服务。                   | 完成 |
| MySQL/PSQL   | 官方驱动 + connect()              | 直接从 Worker 连数据库握手（只要数据库公网可达）。            | 计划 |
| Redis        | connect() + Redis 协议            | 可以实现简单的 PING/PONG 握手。                               | 计划 |
| SMTP         | connect()                         | 模拟 SMTP 握手（HELO/EHLO）。                                 | 计划 |
| Browser Engine | Browser Rendering                | Cloudflare 自家的渲染引擎（需在后台开启）。                   | 计划 |
| MQTT/Kafka   | connect()                         | 只要在代码里集成对应的 JS 版客户端协议库。                    | 计划 |
| gRPC         | 原生 fetch (HTTP/2)               | Worker 原生支持 H2，可做 gRPC 探测。                          | 计划 |
| Push/手动    | Worker URL 路由                   | 直接给监控 Worker 挂个 Endpoint。                            | 计划 |

其他功能：

- [ ] **SSL 证书检测开关** - 可选择是否启用 SSL 证书检测
- [ ] **忽略SSL 错误开关** - 在检测时忽略 TLS/SSL 证书错误
- [ ] **自定义请求超时** - 在后台设置中自定义请求超时时间
- [ ] **自定义检测间隔** - 在后台设置中自定义网站/DNS 检测间隔，KV每天免费1000次写入，（在后台修改时，然后进行估算，如果估计会超出会有弹窗）
- [ ] **自定义响应延迟** - 为每个站点单独设置响应时间阈值
- [ ] **短信通知支持** - 集成 Twilio 等短信服务，发送短信通知
- [ ] **通用 Webhook 支持** - 支持自定义 Webhook，可接入钉钉、飞书、Telegram 等
- [ ] **计划维护模式** - 设置站点维护时间段，维护期间不发送通知
- [ ] **批量导入导出** - 站点配置的 JSON 导入导出，方便迁移备份
- [ ] **自定义状态页** - 自定义 Logo、主题色、公告信息
- [ ] **加入自定义检测IPv4或IPv6** - 可选择仅检测 IPv4 或 IPv6 地址，（使用 Happy Eyeballs 算法 判断 IP 协议）
- [ ] **加入更多自定义条件判定** - 比如通过正则表达式匹配响应内容
- [ ] **加入自定义域名解析DOH** - 支持自定义 DNS-over-HTTPS 解析服务
- [ ] **加入反转模式** - 反转监控状态。如果服务可访问，则认为是故障

未来发展：
- [ ] **加入主机深度检测板块** - 使用SSH协议对主机运行简单命令进行深度探测，1. 通过 connect() 建立 TCP 连接。 2. 使用库进行密钥交换（Key Exchange）和身份验证。 3. 执行一个简单的命令（如 whoami 或 uptime）。

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
| 🌐 网站监控 | 支持 HTTP/HTTPS，DNS，自动检测在线状态 |
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

整个过程约 **5 分钟**，无需编程知识。

### 第一步：Fork 项目

1. 打开 [dundun-watch](https://github.com/mciart/dundun-watch)
2. 点击右上角 **Fork** 按钮
3. 点击 **Create fork** 完成

### 第二步：获取 Cloudflare 凭据

#### 2.1 获取 API Token

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击右上角头像 → **My Profile** → **API Tokens**
3. 点击 **Create Token**
4. 选择 **Edit Cloudflare Workers** 模板
5. Account Resources 选择 **Include - All accounts**
6. Zone Resources 选择 **Include - All zones**
7. 点击 **Continue to summary** → **Create Token**
8. **复制 Token**（只显示一次！）

#### 2.2 获取 Account ID

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages**
3. 在右侧栏找到 **Account ID**
4. 复制该 ID

### 第三步：配置 GitHub Secrets

打开你 Fork 的项目 → **Settings** → **Secrets and variables** → **Actions**

点击 **New repository secret**，添加以下密钥：

#### 必填配置

| Name | Value | 说明 |
|------|-------|------|
| `CLOUDFLARE_API_TOKEN` | 你的 API Token | **必填** |

#### 可选配置

| Name | Value | 说明 |
|------|-------|------|
| `KV_NAMESPACE_ID` | 你的 KV Namespace ID | 可选，首次部署自动创建 |

> 💡 **提示**：KV 命名空间会在首次部署时自动创建，无需手动配置！
> 
> 🔒 **安全建议**：部署成功后，请立即登录后台修改默认密码和后台路径。在后台修改的设置不会被后续更新部署覆盖。

### 第四步：运行部署

1. 进入项目 → **Actions** 标签
2. 如有提示，点击 **I understand my workflows, go ahead and enable them**
3. 左侧选择 **Deploy to Cloudflare Workers**
4. 点击 **Run workflow** → 再点击绿色 **Run workflow**
5. 等待完成，看到绿色勾 ✅ 即部署成功

### 第五步：访问网站

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages**
3. 找到 **dundun-watch** 项目
4. 点击访问地址即可

**默认后台地址：** `你的域名/admin`  
**默认密码：** `admin123456`

---

## 🔄 更新与重新部署

### 同步最新版本

Fork 项目后，如果原项目有更新，你可以同步最新代码：

1. 打开你 Fork 的项目页面
2. 点击代码区域上方的 **Sync fork** 按钮
3. 点击 **Update branch** 同步最新代码
4. 同步后会自动触发 GitHub Actions 重新部署

### 重新部署

如果修改了 GitHub Secrets 配置（如密码、后台路径等），需要手动触发重新部署：

1. 进入项目 → **Actions** 标签
2. 左侧选择 **Deploy to Cloudflare Workers**
3. 点击 **Run workflow** 下拉菜单
4. 选择分支（默认 main 或 master）
5. 点击绿色 **Run workflow** 按钮
6. 等待部署完成，新配置即生效

---

## 🌐 自定义域名配置

Cloudflare Workers 支持多种域名绑定方式：

### 方式一：Custom Domains（推荐）

最简单的方式，适合绑定独立域名或子域名：

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages** → 找到 **dundun-watch** 项目
3. 点击 **Settings** → **Domains & Routes**
4. 点击 **Add** → **Custom Domain**
5. 输入域名（如 `status.example.com`）
6. 点击 **Add Custom Domain**
7. Cloudflare 会自动配置 DNS 记录

> 注意：域名必须已添加到你的 Cloudflare 账户中

### 方式二：Routes（路由规则）

适合更灵活的路径匹配：

1. 进入 **Workers & Pages** → **dundun-watch** 项目
2. 点击 **Settings** → **Domains & Routes**
3. 点击 **Add** → **Route**
4. 选择 Zone（你的域名）
5. 输入路由规则，例如：
   - `status.example.com/*` - 匹配子域名所有路径
   - `example.com/status/*` - 匹配主域名的特定路径
6. 点击 **Add Route**

### 方式三：workers.dev 子域名

无需配置，部署后自动获得：

`dundun-watch.<你的账户>.workers.dev`

可在 **Settings** → **Domains & Routes** 中查看或禁用。

---

## 📖 使用说明

### 添加监控站点

1. 登录后台（默认密码 `admin123456`）
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

### 快速启动

```bash
# 克隆项目
git clone https://github.com/mciart/dundun-watch.git
cd dundun-watch

# 安装依赖
npm install
cd frontend && npm install && cd ..

# 构建前端并启动开发服务器
npm run dev
```

访问：`http://localhost:8787`

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 本地开发（构建前端 + 启动服务） |
| `npm run dev:frontend` | 仅启动前端热重载 |
| `npm run build` | 构建前端 |
| `npm run deploy` | 手动部署到 Cloudflare |
| `npm run tail` | 查看线上日志 |

### 项目结构（已模块化）

```
dundun-watch/
├── src/                          # Worker 源代码（模块化）
│   ├── index.js                  # 主入口
│   ├── core/
│   │   ├── storage.js            # 存储抽象（KV / D1 适配）
│   │   └── utils.js              # 通用工具函数
│   ├── monitors/                 # 各协议监控实现与工厂
│   │   ├── index.js              # 监控工厂
│   │   ├── http.js
│   │   ├── dns.js
│   │   ├── tcp.js
│   │   └── mock.js               # 本地调试/单元测试 mock 支持
│   ├── notifications/            # 通知渠道实现与分发器
│   │   ├── index.js
│   │   ├── wecom.js
│   │   └── email.js
│   └── api/                      # 路由 + 控制器
│       ├── router.js
│       └── controllers/
│           ├── auth.js
│           └── sites.js
├── frontend/                      # 前端项目 (React + Vite)
│   ├── src/                       # 前端源码
│   ├── public/
│   └── dist/                      # 构建产物
├── docs/                          # 截图与文档
├── tests/                         # 单元测试（含 monitors 的 mock 测试）
├── .github/workflows/
│   └── deploy.yml                 # 自动部署工作流
├── wrangler.toml                  # Cloudflare Worker 配置
├── package.json
└── README.md
```

---

## ❓ 常见问题

<details>
<summary><b>部署失败怎么办？</b></summary>

1. 检查 GitHub Secrets 是否正确配置（三个都要填）
2. 检查 API Token 权限是否完整
3. 查看 Actions 日志定位错误

</details>

<details>
<summary><b>监控间隔是多久？</b></summary>

默认每分钟检测一次所有站点。

</details>

<details>
<summary><b>数据保留多久？</b></summary>

默认保留 30 天历史数据。

</details>

<details>
<summary><b>有使用限制吗？</b></summary>

Cloudflare Workers 免费版每天 10 万次请求，个人使用完全够用。

</details>

<details>
<summary><b>如何绑定自定义域名？</b></summary>

请参考上方 [自定义域名配置](#-自定义域名配置) 章节。

</details>

---

## 🛠️ 技术栈

| 类型 | 技术 |
|------|------|
| 前端 | React + Vite + TailwindCSS |
| 后端 | Cloudflare Workers |
| 数据库 | Cloudflare KV |
| 部署 | GitHub Actions + Cloudflare |

---

## 📄 开源协议

本项目基于 [MIT](LICENSE) 协议开源。

---

<div align="center">

### ⭐ 如果觉得项目不错，欢迎点个 Star 支持一下！

</div>