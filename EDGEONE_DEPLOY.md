# EdgeOne 部署快速指南

## 📌 前置要求

- 腾讯云账号
- 已开通 EdgeOne 服务
- 已有域名（需要在 EdgeOne 中接入）

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
4. 命名空间名称：`dundun-sentinel-kv`
5. 点击 **确定** 创建
6. 记录命名空间 ID（后续绑定需要）

---

### 4️⃣ 创建边缘函数

#### 4.1 创建 API 函数

1. 进入 **边缘函数** → **函数管理**
2. 点击 **新建函数**
3. 函数名称：`dundun-sentinel-api`
4. 将 `functions/api.js` 和 `src/` 目录的代码上传或粘贴
5. 在 **KV 绑定** 中，添加绑定：
   - 变量名：`MONITOR_DATA`
   - 选择刚创建的 KV 命名空间
6. 保存函数

#### 4.2 创建监控 Cron 函数

1. 新建函数：`dundun-sentinel-cron-monitor`
2. 上传 `functions/cron-monitor.js` 代码
3. 绑定相同的 KV 命名空间
4. 保存函数

#### 4.3 创建证书检测 Cron 函数

1. 新建函数：`dundun-sentinel-cron-cert-check`
2. 上传 `functions/cron-cert-check.js` 代码
3. 绑定相同的 KV 命名空间
4. 保存函数

---

### 5️⃣ 配置函数触发规则

#### 5.1 配置 API 路由

1. 进入 **边缘函数** → **触发规则**
2. 点击 **新建规则**
3. 配置：
   - 规则名称：`api-route`
   - 触发条件：URL 路径匹配 `/api/*`
   - 执行函数：`dundun-sentinel-api`
4. 保存规则

#### 5.2 配置定时触发器

1. 点击 **新建规则**
2. 配置监控定时任务：
   - 规则名称：`monitor-cron`
   - 触发类型：**定时触发**
   - Cron 表达式：`*/15 * * * *`（每15分钟）
   - 执行函数：`dundun-sentinel-cron-monitor`
3. 保存

4. 再新建一个规则，配置证书检测定时任务：
   - 规则名称：`cert-check-cron`
   - 触发类型：**定时触发**
   - Cron 表达式：`0 4 * * *`（每天凌晨4点）
   - 执行函数：`dundun-sentinel-cron-cert-check`
5. 保存

---

### 6️⃣ 部署前端静态资源

#### 方式一：使用 EdgeOne 静态托管

1. 本地构建前端：
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. 在 EdgeOne 控制台，进入 **站点加速** → **规则引擎**
3. 配置静态资源回源规则，或使用 EdgeOne 的静态托管功能
4. 上传 `frontend/dist` 目录的内容

#### 方式二：使用腾讯云 COS

1. 创建 COS 存储桶
2. 上传 `frontend/dist` 目录内容
3. 在 EdgeOne 配置回源到 COS

---

### 7️⃣ 配置环境变量（可选）

如果需要保护 Cron 接口：

1. 在函数配置中添加环境变量
2. 变量名：`CRON_SECRET`
3. 值：自己生成的随机字符串

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
