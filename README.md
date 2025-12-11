<div align="center">

# 炖炖守望

**dundun-watch**

轻量级网站监控系统 | 基于 Cloudflare Workers | 完全免费 | 一键部署

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)
[![GitHub Stars](https://img.shields.io/github/stars/hjp5211314/dundun-watch?style=social)](https://github.com/hjp5211314/dundun-watch)

[演示站点](https://wzjk.de5.net/) · [快速部署](#快速部署) · [功能介绍](#功能特性) · [常见问题](#常见问题)

---

*慢慢炖，网站不"糊锅"*

</div>

## 预览截图

<div align="center">

**首页**

<img src="docs/shouye.png" alt="首页" width="800">

**后台**

<img src="docs/houtai.png" alt="后台" width="800">

</div>

---

## 功能特性

| 功能 | 说明 |
|------|------|
| 网站监控 | 支持 HTTP/HTTPS，自动检测在线状态 |
| 响应统计 | 记录响应时间，计算平均响应 |
| SSL 监控 | 自动检测证书到期时间，提前预警 |
| 历史记录 | 保留 30 天监控数据，状态条可视化 |
| 分组管理 | 自定义分组，支持图标和颜色 |
| 企业微信 | 站点异常时推送通知 |
| 邮件通知 | 支持 Resend 邮件通知，站点异常/恢复/证书到期提醒 |
| 深色模式 | 支持明暗主题切换 |
| 响应式 | 适配手机、平板、电脑 |
| 高级配置 | 自定义请求方式、请求头、状态码、关键词检测 |

---

## 快速部署

整个过程约 10 分钟，无需编程知识。

### 第一步：Fork 项目

1. 打开 [dundun-watch](https://github.com/hjp5211314/dundun-watch)
2. 点击右上角 **Fork** 按钮
3. 点击 **Create fork** 完成

### 第二步：获取 Cloudflare API Token

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)（没账号先注册，免费）
2. 点击右上角头像 → **My Profile**
3. 左侧选择 **API Tokens** → **Create Token**
4. 找到 **Edit Cloudflare Workers**，点击 **Use template**
5. Account Resources 选择 **Include - All accounts**
6. Zone Resources 选择 **Include - All accounts**
7. 点击 **Continue to summary** → **Create Token**
8. **复制 Token**（只显示一次！）

### 第三步：配置 GitHub Secrets

1. 打开你 Fork 的项目 → **Settings** → **Secrets and variables** → **Actions**
2. 点击 **New repository secret**
3. 添加密钥：

| Name | Value | 必填 |
|------|-------|------|
| `CLOUDFLARE_API_TOKEN` | 你的 Cloudflare Token | 是 |
| `ADMIN_PASSWORD` | 自定义登录密码 | 否 |

> 不设置 `ADMIN_PASSWORD` 则使用默认密码：`admin123456`

### 第四步：运行部署

1. 进入项目 → **Actions** 标签
2. 如有提示，点击 **I understand my workflows, go ahead and enable them**
3. 左侧选择 **部署（Cloudflare Worker + Pages）**
4. 点击 **Run workflow** → 再点击绿色 **Run workflow**
5. 等待完成，看到绿色勾即部署成功

### 第五步：访问网站

部署成功后，有两种方式查看网站地址：

**方式一：GitHub Actions 日志**
1. 点击刚才运行的 Actions
2.  **部署成功** 摘要中可以看到访问地址

**方式二：Cloudflare Dashboard**
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages**
3. 找到 **dundun-watch** 项目，点击进入
4. 在 **Domains** 处可以看到网站地址

---

## 使用说明

### 添加监控站点

1. 登录后台 后台地址/admin（默认密码 `admin123456`）
2. 点击 **添加站点**
3. 填写名称和 URL
4. 可选：配置高级选项（请求方式、请求头等）
5. 保存

### 通知设置

1. 切换到 **通知设置** 标签
2. 开启通知 → 配置企业微信 Webhook
3. 点击 **发送测试** 验证

---

## 常见问题

<details>
<summary><b>部署失败怎么办？</b></summary>

1. 检查 `CLOUDFLARE_API_TOKEN` 是否正确
2. 检查 Token 权限是否完整（需要 4 个权限）
3. 查看 Actions 日志定位错误

</details>

<details>
<summary><b>忘记登录密码？</b></summary>

**方式一：直接修改（推荐，立即生效）**

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers KV**
3. 找到命名空间 `dundun-watch_MONITOR_DATA`
4. 点击进入
5. 添加或编辑键值：
   - Key：`admin_password`
   - Value：`你的新密码`
6. 保存后立即生效，无需重新部署

**方式二：重新部署**

1. GitHub 项目 → Settings → Secrets → Actions
2. 删除 `ADMIN_PASSWORD`，重新添加新密码
3. 重新运行 Actions

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

---

## 技术栈

| 类型 | 技术 |
|------|------|
| 前端 | React + Vite + TailwindCSS |
| 后端 | Cloudflare Workers |
| 数据库 | Cloudflare KV |
| 部署 | Cloudflare Pages + Workers |
| CI/CD | GitHub Actions |

---

## 开源协议

本项目基于 [MIT](LICENSE) 协议开源。

---

<div align="center">

### 如果觉得项目不错，欢迎点个 Star 支持一下

</div>

</div>
