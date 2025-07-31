# CloudStudio 监控管理系统

🚀 一个具备 Web 管理界面的 Deno Deploy 兼容应用，支持多站点监控配置、身份验证、数据持久化存储。

[![Deno](https://img.shields.io/badge/deno-v2.3.5+-black?logo=deno)](https://deno.land/)
[![Deploy](https://img.shields.io/badge/deploy-Deno%20Deploy-blue)](https://deno.com/deploy)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> 🎯 **从简单脚本到企业级监控平台的完整改造**

[中文文档](README_CN.md) | [English](README.md)

## ✨ 功能特性

- 🌐 **Web 管理界面** - 现代化响应式设计
- 📊 **多站点监控** - 支持多个网站同时监控
- 🔐 **身份验证** - 安全的会话管理系统
- 💾 **数据持久化** - 基于 Deno KV 的数据存储
- ⏰ **实时监控** - 自动定时监控任务
- 📈 **历史记录** - 完整的监控历史追踪
- 📱 **响应式设计** - 支持移动端访问
- 🚀 **单文件部署** - 零依赖，一键部署

## 🚀 快速开始

### 本地运行

```bash
# 克隆仓库
git clone https://github.com/WslzGmzs/CloudStudioRefresh.git
cd CloudStudioRefresh

# 运行应用程序
deno run --allow-net --allow-kv --unstable-kv cloudStudioRefresh.ts
```

### Deno Deploy 部署

#### 方法一：直接上传文件（推荐）
1. 访问 [Deno Deploy](https://dash.deno.com/)
2. 创建新项目
3. **上传 `cloudStudioRefresh.ts` 文件**
4. 设置环境变量（可选）
5. 部署完成

#### 方法二：GitHub 集成
1. Fork 此仓库到你的 GitHub 账户
2. 在 Deno Deploy 中连接 GitHub 仓库
3. **选择 `cloudStudioRefresh.ts` 作为入口文件**
4. 自动部署

## 📁 项目结构

```
CloudStudioRefresh/
├── cloudStudioRefresh.ts      # 主应用文件（单文件部署）
├── deno.json                  # Deno 配置文件
├── deploy.sh                  # 部署脚本
├── README.md                  # 英文文档
├── README_CN.md               # 中文文档
├── ARCHITECTURE.md            # 系统架构文档
├── API.md                     # 完整 API 文档
├── DEPLOYMENT.md              # 详细部署指南
├── CHANGELOG.md               # 版本更新日志
├── PROJECT_OVERVIEW.md        # 项目总览和导航
├── FEATURES_UPDATE.md         # 功能更新日志
├── HOTFIX.md                  # 热修复记录
└── data/                      # 数据存储目录（自动创建）
    └── kv-store/              # Deno KV 数据库文件
```

### 文件说明

- **`cloudStudioRefresh.ts`**: 完整应用程序，包含 Web 界面、监控系统和所有功能
- **`deno.json`**: Deno 配置文件，包含任务、权限和项目设置
- **`deploy.sh`**: 自动化部署脚本，包含兼容性检查
- **`data/`**: 本地数据存储目录（自动创建）

### 📚 文档导航

- 📖 **[项目总览](PROJECT_OVERVIEW.md)** - 完整的项目介绍和导航
- 🏗️ **[系统架构](ARCHITECTURE.md)** - 系统架构和技术栈说明
- 📡 **[API 文档](API.md)** - 完整的 API 参考和示例
- 🚀 **[部署指南](DEPLOYMENT.md)** - 详细的部署说明
- 📝 **[更新日志](CHANGELOG.md)** - 版本历史和更新记录
- 🎉 **[功能更新](FEATURES_UPDATE.md)** - 新功能和改进说明
- 🔧 **[热修复记录](HOTFIX.md)** - 常见问题和解决方案

## ⚙️ 配置说明

### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `ADMIN_PASSWORD` | `admin123` | 管理员登录密码 |
| `SESSION_EXPIRE_HOURS` | `24` | 会话过期时间（小时） |
| `DEFAULT_MONITOR_INTERVAL` | `1` | 默认监控间隔（分钟） |
| `MAX_MONITOR_INTERVAL` | `60` | 最大监控间隔（分钟） |
| `MIN_MONITOR_INTERVAL` | `1` | 最小监控间隔（分钟） |
| `HISTORY_RETENTION_DAYS` | `30` | 历史记录保留天数 |
| `MAX_CONCURRENT_MONITORS` | `10` | 最大并发监控数量 |
| `REQUEST_TIMEOUT` | `30000` | 请求超时时间（毫秒） |
| `LOGIN_LOCKOUT_MINUTES` | `15` | 登录失败锁定时间（分钟） |
| `MAX_LOGIN_ATTEMPTS` | `5` | 最大登录尝试次数 |
| `LOG_LEVEL` | `info` | 日志级别 |
| `PORT` | `8000` | 服务器端口 |

### 默认配置

- 🔑 **管理员密码**: `admin123`（建议修改）
- ⏱️ **会话过期**: 24 小时
- 📊 **监控间隔**: 1-60 分钟可配置
- 🔄 **并发监控**: 最多 10 个
- 📝 **历史保留**: 30 天

## 📚 API 文档

### 页面路由
- `GET /` - 登录页面
- `GET /dashboard` - 管理仪表板

### 认证 API
- `POST /api/login` - 用户登录
- `POST /api/logout` - 用户登出
- `GET /api/auth/check` - 认证状态检查

### 监控配置 API
- `GET /api/monitors` - 获取监控配置列表
- `POST /api/monitors` - 创建监控配置
- `PUT /api/monitors/:id` - 更新监控配置
- `DELETE /api/monitors/:id` - 删除监控配置
- `GET /api/monitors/status` - 获取监控状态

### 系统 API
- `GET /api/system/info` - 系统信息
- `GET /api/system/health` - 健康检查
- `GET /api/scheduler/status` - 调度器状态
- `POST /api/scheduler/restart` - 重启调度器

## 🔒 安全特性

- 🔐 **密码认证** - 硬编码密码保护
- 🍪 **会话管理** - 安全的 Cookie 会话
- 🚫 **频率限制** - 防止暴力破解
- 🛡️ **CSRF 防护** - 跨站请求伪造保护
- 🔒 **安全头部** - 完整的安全响应头

## 🔧 开发指南

### 本地开发

```bash
# 开发模式（自动重启）
deno run --allow-net --allow-kv --unstable-kv --watch cloudStudioRefresh.ts

# 代码检查
deno check cloudStudioRefresh.ts

# 代码格式化
deno fmt cloudStudioRefresh.ts

# 代码 Lint
deno lint cloudStudioRefresh.ts

# 运行测试
deno run --allow-net --allow-kv --unstable-kv cloudStudioRefresh.ts --test
```

### 部署准备

```bash
# 使用部署脚本
chmod +x deploy.sh
./deploy.sh

# 手动检查
deno check cloudStudioRefresh.ts
deno run --allow-net --allow-kv --unstable-kv cloudStudioRefresh.ts
```

## 💡 使用示例

### CloudStudio 监控配置

```json
{
  "name": "CloudStudio 项目A监控",
  "url": "https://cloudstudio.net/a/26783234094321664/edit",
  "cookie": "cloudstudio-editor-session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "method": "POST",
  "interval": 1,
  "enabled": true
}
```

**获取 Cookie 的方法：**

1. 在 CloudStudio 中打开开发者工具（F12）
2. 切换到 Network 选项卡
3. 刷新页面，找到任意请求
4. 在请求头中复制完整的 Cookie 值

### 通用网站监控

```json
{
  "name": "公司官网监控",
  "url": "https://company.com/health",
  "cookie": "",
  "method": "GET",
  "interval": 5,
  "enabled": true
}
```

## 🔍 故障排除

### 常见问题

#### 1. 部署问题
**常见问题**: 文件上传或 GitHub 集成问题
**解决方案**: 确保使用正确的文件并具有适当的权限

#### 2. 无法访问管理界面
**解决方案**:
```bash
# 检查应用是否正常启动
deno run --allow-net --allow-kv --unstable-kv cloudStudioRefresh.ts

# 检查端口是否被占用
netstat -an | grep 8000
```

#### 3. 登录失败
**解决方案**:
- 确认密码为 `admin123`（或自定义的 ADMIN_PASSWORD）
- 清除浏览器 Cookie 和缓存

#### 4. 监控不工作
**解决方案**:
```bash
# 检查调度器状态
curl http://localhost:8000/api/scheduler/status

# 检查系统健康状态
curl http://localhost:8000/api/system/health
```

## 🔄 更新日志

### v1.0.1 (2025-01-31) - 文档和部署优化

#### 🚀 重大改进
- **完整技术文档**: 新增全面的技术文档体系
- **部署流程简化**: 简化为单文件部署流程
- **文档一致性**: 修正项目文档中的所有不一致问题

#### ✨ 新增功能
- **技术文档**: 架构文档、API 文档和部署指南
- **TypeScript 优化**: 修复所有类型错误，确保类型安全
- **配置优化**: 完善 deno.json 配置，消除警告

#### 🛠️ 技术改进
- **代码精简**: 移除测试代码和开发工具，保留核心功能
- **性能优化**: 优化代码结构，提升运行效率
- **文档完善**: 详细的部署指南和故障排除

### v1.0.0 (2025-01-31) - 首次发布
- 完整的监控管理系统
- Web 管理界面
- 多站点监控支持
- 身份验证和会话管理
- 数据持久化存储

## 📄 许可证

MIT License

## 🤝 贡献指南

我们欢迎所有形式的贡献！

- 🐛 **报告问题**: 使用 GitHub Issues
- 💡 **功能建议**: 在 Issues 中提出
- 🔧 **代码贡献**: Fork 项目并提交 PR
- 📝 **文档改进**: 改进现有文档

## 📞 联系我们

- **项目仓库**: https://github.com/WslzGmzs/CloudStudioRefresh.git
- **问题反馈**: GitHub Issues
- **功能建议**: GitHub Discussions

---

⭐ 如果这个项目对您有帮助，请给我们一个 Star!
