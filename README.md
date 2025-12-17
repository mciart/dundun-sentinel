<div align="center">

# 炖炖守望（优化版）

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

| 更改 | 说明 |
|------|------|
| **Workers + Pages 合并** | 将 Cloudflare Workers 和 Pages 合二为一，简化部署流程 |
| **新增后台设置页面** | 你现在可以在后台设置页面直接修改密码和后台路径，不用再改变量了 |
| **新增DNS 监控类型** | 你现在可以填写域名添加 DNS 监控站点了，且能与（如有期望值）匹配做出判断 |
| **SSL 证书检测优化** | 每小时检测一次（手动触发"立即检查"时仍会检测）防止你不小心错误更换证书 |
| **DNS 查询优化** | 并行查询 A 和 AAAA 记录（最多 5 秒），DNS 解析时间减少 60%+ |
| **错误消息逻辑优化** | 错误提示更准确（域名不存在、无A记录、DNS服务器错误等） |
| **数据一致性优化** | 新增数据清理/维护功能，站点删除/修改后会自动清理相关历史数据和通知记录 |
| **密码安全性优化** | 管理员密码使用 SHA-256 哈希存储，不再明文保存！ |
| **主题开关修复** | 修复自动调整为深色模式时，开关显示在浅色模式位置的问题 |
| **Favicon 修复** | 修复 favicon.ico 图标不显示的问题 |
| **变更URL 修复** | 更新站点时处理 URL 变更，重置检测状态并清除历史记录 |
| **依赖更新** | 更新前端依赖包，提升性能和安全性 |
| **文档完善** | 补充更详细的部署和使用说明，新增常见问题解答 |


---

## 📸 预览截图

<div align="center">

| 主页 - 浅色模式 | 主页 - 深色模式 |
|:---:|:---:|
| <img src="docs/1.png" alt="主页浅色模式" width="400"> | <img src="docs/2.png" alt="主页深色模式" width="400"> |

| 后台首页 - 浅色模式 | 后台首页 - 深色模式 |
|:---:|:---:|
| <img src="docs/3.png" alt="后台首页浅色模式" width="400"> | <img src="docs/4.png" alt="后台首页深色模式" width="400"> |

| 后台设置 - 浅色模式 | 后台通知 - 深色模式 |
|:---:|:---:|
| <img src="docs/5.png" alt="后台设置浅色模式" width="400"> | <img src="docs/6.png" alt="后台通知深色模式" width="400"> |

</div>

---

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 🌐 网站监控 | 支持 HTTP/HTTPS，自动检测在线状态 |
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
| `CLOUDFLARE_ACCOUNT_ID` | 你的 Account ID | **必填** |

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

### 项目结构

```
dundun-watch/
├── src/                    # Worker 源代码
│   ├── index.js           # 主入口
│   ├── api.js             # API 接口
│   ├── monitor.js         # 监控逻辑
│   └── utils.js           # 工具函数
├── frontend/               # 前端项目 (React + Vite)
│   ├── src/               # 前端源码
│   └── dist/              # 构建产物
├── .github/workflows/      # GitHub Actions
│   └── deploy.yml         # 自动部署工作流
├── wrangler.toml          # Cloudflare Worker 配置
└── package.json           # 项目配置
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
