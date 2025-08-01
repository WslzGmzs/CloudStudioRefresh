# CloudStudio 监控管理系统

一个基于 Deno 的网站监控管理系统，采用前后端分离架构，支持多站点监控、实时状态检查、历史数据统计和可视化图表展示。

## ✨ 主要功能

- 🔍 **多站点监控**: 支持添加多个网站进行监控
- ⏰ **智能调度**: 可配置监控间隔（1-60分钟），智能间隔检查
- 📊 **数据统计**: 提供24小时和7天的监控数据统计
- 📈 **可视化图表**: 直观的成功率和响应时间图表
- 🔐 **安全认证**: 基于会话的用户认证系统
- 💾 **数据持久化**: 使用 Deno KV 存储监控数据
- 🎨 **响应式界面**: 现代化的 Web 界面，支持移动端
- ⚡ **性能优化**: 内存缓存系统，减少90% KV读取量
- 🏗️ **模块化架构**: 前后端分离，易于维护和扩展

## 🚀 快速开始

### 环境要求

- Deno 1.37+ 
- 支持 Deno KV 的环境

### 本地运行

```bash
# 克隆项目
git clone <repository-url>
cd cloudstudio-monitor

# 启动服务（新架构）
deno task start

# 开发模式（支持热重载）
deno task dev

# 代码检查
deno task check
```

### 访问系统

1. 打开浏览器访问 `http://localhost:8000`
2. 使用默认密码 `admin123` 登录（可通过环境变量修改）
3. 开始添加和管理监控配置

## 🏗️ 项目架构（前后端分离）

```
project/
├── server.ts                 # 主服务器入口文件
├── config/                   # 配置文件
│   ├── app.ts                # 应用配置
│   └── constants.ts          # 常量定义
├── models/                   # 数据模型
│   ├── monitor.ts            # 监控相关接口
│   ├── auth.ts               # 认证相关接口
│   └── system.ts             # 系统相关接口
├── services/                 # 业务逻辑服务
│   ├── cache.ts              # 内存缓存服务
│   ├── monitor.ts            # 监控执行服务
│   ├── scheduler.ts          # 任务调度服务
│   └── kv.ts                 # KV数据库服务
├── api/                      # API路由处理
│   ├── auth.ts               # 认证API
│   ├── monitors.ts           # 监控配置API
│   ├── stats.ts              # 统计数据API
│   └── system.ts             # 系统API
├── utils/                    # 工具函数
│   ├── response.ts           # 响应工具
│   └── helpers.ts            # 通用工具
├── public/                   # 前端文件
│   ├── index.html            # 主页面
│   ├── css/styles.css        # 样式文件
│   └── js/                   # JavaScript文件
└── deno.json                 # Deno配置文件
```

## 📋 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `ADMIN_PASSWORD` | `admin123` | 管理员登录密码 |
| `SESSION_EXPIRE_HOURS` | `24` | 会话过期时间（小时） |
| `DEFAULT_MONITOR_INTERVAL` | `1` | 默认监控间隔（分钟） |
| `MAX_MONITOR_INTERVAL` | `60` | 最大监控间隔（分钟） |
| `MIN_MONITOR_INTERVAL` | `1` | 最小监控间隔（分钟） |
| `PORT` | `8000` | 服务器端口 |

## ⚡ 性能优化

### KV读取优化
- **监控配置缓存**: 2分钟TTL，减少重复查询
- **历史记录缓存**: 5分钟TTL，限制查询数量
- **系统日志缓存**: 3分钟TTL，分页查询
- **前端刷新优化**: 30秒→2分钟，减少75%调用

### 预期效果
- KV读取量减少90% (从每小时420次→48次)
- 响应速度显著提升
- 符合Deno Deploy免费计划限制

## 📖 API 接口

### 认证相关
- `POST /api/login` - 用户登录
- `POST /api/logout` - 用户登出
- `GET /api/auth/status` - 检查认证状态

### 监控配置
- `GET /api/monitors` - 获取所有监控配置
- `POST /api/monitors` - 创建监控配置
- `PUT /api/monitors/:id` - 更新监控配置
- `DELETE /api/monitors/:id` - 删除监控配置
- `GET /api/monitors/status` - 获取监控状态

### 统计数据
- `GET /api/stats` - 获取监控统计
- `GET /api/stats/overview` - 获取概览统计

### 系统管理
- `GET /api/system/info` - 获取系统信息
- `GET /api/system/health` - 健康检查
- `GET /api/system/cache` - 缓存统计
- `POST /api/system/cache/clear` - 清除缓存

## 🔧 开发指南

### 开发命令

```bash
# 启动开发服务器
deno task dev

# 生产环境启动
deno task start

# 代码检查
deno task check

# 代码格式化
deno task fmt

# 代码检查
deno task lint
```

### 添加新功能

1. **数据模型**: 在 `models/` 中定义接口
2. **业务逻辑**: 在 `services/` 中实现服务
3. **API接口**: 在 `api/` 中添加路由处理
4. **前端界面**: 在 `public/` 中更新UI

## 📦 部署

### Deno Deploy

1. 推送代码到 GitHub
2. 在 Deno Deploy 中创建新项目
3. 连接 GitHub 仓库
4. 设置入口文件为 `server.ts`
5. 配置环境变量
6. 部署

### 部署优势
- ✅ 所有文件都小于128KB，符合Deno Deploy限制
- ✅ 模块化架构，易于维护
- ✅ 前后端分离，独立开发
- ✅ 性能优化，减少资源消耗

## 🔄 从旧版本迁移

### 兼容性
- ✅ 数据格式完全兼容
- ✅ KV数据库结构不变
- ✅ 环境变量保持一致
- ✅ 功能无缺失

### 迁移步骤
1. 备份现有数据
2. 部署新版本
3. 验证功能正常
4. 删除旧版本文件

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
