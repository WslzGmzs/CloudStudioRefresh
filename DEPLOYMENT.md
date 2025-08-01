# CloudStudio 监控系统部署指南

本文档提供了 CloudStudio 监控系统在不同环境下的部署方法和配置说明。系统采用前后端分离架构，支持多种部署方式。

## 📋 部署前准备

### 系统要求

- **Deno**: 1.37 或更高版本
- **环境**: 支持 Deno KV 的运行环境
- **内存**: 最少 128MB RAM
- **存储**: 最少 100MB 可用空间

### 文件结构检查

确保项目包含以下文件：

```
project/
├── server.ts                 # 主服务器文件
├── deno.json                 # Deno配置
├── config/                   # 配置文件
├── models/                   # 数据模型
├── services/                 # 业务服务
├── api/                      # API路由
├── utils/                    # 工具函数
└── public/                   # 前端文件
```

## 🚀 Deno Deploy 部署（推荐）

### 优势

- ✅ 无服务器架构，自动扩缩容
- ✅ 全球 CDN 分发
- ✅ 内置 Deno KV 数据库
- ✅ 免费计划支持
- ✅ 一键部署

### 部署步骤

#### 1. 准备 GitHub 仓库

```bash
# 初始化 Git 仓库
git init
git add .
git commit -m "Initial commit"

# 推送到 GitHub
git remote add origin https://github.com/username/cloudstudio-monitor.git
git push -u origin main
```

#### 2. 创建 Deno Deploy 项目

1. 访问 [Deno Deploy](https://dash.deno.com/)
2. 点击 "New Project"
3. 选择 "Deploy from GitHub repository"
4. 授权 GitHub 访问
5. 选择项目仓库

#### 3. 配置部署设置

- **Entry Point**: `server.ts`
- **Environment Variables**: 设置环境变量
- **Build Command**: 无需设置（Deno 原生支持）

#### 4. 环境变量配置

在 Deno Deploy 控制台设置以下环境变量：

| 变量名 | 示例值 | 说明 |
|--------|--------|------|
| `ADMIN_PASSWORD` | `your-secure-password` | 管理员密码 |
| `SESSION_EXPIRE_HOURS` | `24` | 会话过期时间 |
| `DEFAULT_MONITOR_INTERVAL` | `5` | 默认监控间隔 |

#### 5. 部署验证

部署完成后：

1. 访问分配的 URL
2. 使用设置的密码登录
3. 检查系统功能是否正常
4. 查看 `/api/system/health` 健康检查

### 部署优化

#### 文件大小优化

系统已优化为模块化架构：

- ✅ 每个文件都小于 128KB
- ✅ 符合 Deno Deploy 限制
- ✅ 快速部署和启动

#### 性能优化

- ✅ 内存缓存减少 KV 读取
- ✅ 智能查询限制
- ✅ 前端资源优化

## 💻 本地开发部署

### 开发环境设置

```bash
# 克隆项目
git clone https://github.com/username/cloudstudio-monitor.git
cd cloudstudio-monitor

# 启动开发服务器
deno task dev

# 或直接运行
deno run --allow-net --allow-kv --allow-read --allow-write --watch server.ts
```

### 环境变量配置

创建 `.env` 文件（可选）：

```bash
ADMIN_PASSWORD=admin123
SESSION_EXPIRE_HOURS=24
DEFAULT_MONITOR_INTERVAL=5
PORT=8000
```

### 开发工具

```bash
# 代码检查
deno task check

# 代码格式化
deno task fmt

# 代码检查
deno task lint

# 运行测试
deno test
```

## 🐳 Docker 部署

### Dockerfile

```dockerfile
FROM denoland/deno:1.37.0

WORKDIR /app

# 复制依赖文件
COPY deno.json .
COPY server.ts .
COPY config/ ./config/
COPY models/ ./models/
COPY services/ ./services/
COPY api/ ./api/
COPY utils/ ./utils/
COPY public/ ./public/

# 缓存依赖
RUN deno cache server.ts

# 暴露端口
EXPOSE 8000

# 启动应用
CMD ["run", "--allow-net", "--allow-kv", "--allow-read", "--allow-write", "server.ts"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  cloudstudio-monitor:
    build: .
    ports:
      - "8000:8000"
    environment:
      - ADMIN_PASSWORD=your-secure-password
      - SESSION_EXPIRE_HOURS=24
      - DEFAULT_MONITOR_INTERVAL=5
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

### 部署命令

```bash
# 构建镜像
docker build -t cloudstudio-monitor .

# 运行容器
docker run -d \
  --name cloudstudio-monitor \
  -p 8000:8000 \
  -e ADMIN_PASSWORD=your-secure-password \
  cloudstudio-monitor

# 使用 Docker Compose
docker-compose up -d
```

## ☁️ 云服务器部署

### VPS/云服务器部署

#### 1. 安装 Deno

```bash
# 安装 Deno
curl -fsSL https://deno.land/x/install/install.sh | sh

# 添加到 PATH
echo 'export PATH="$HOME/.deno/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

#### 2. 部署应用

```bash
# 克隆项目
git clone https://github.com/username/cloudstudio-monitor.git
cd cloudstudio-monitor

# 设置环境变量
export ADMIN_PASSWORD=your-secure-password
export SESSION_EXPIRE_HOURS=24

# 启动应用
deno task start
```

#### 3. 使用 PM2 管理进程

```bash
# 安装 PM2
npm install -g pm2

# 创建 ecosystem.config.js
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'cloudstudio-monitor',
    script: 'deno',
    args: 'run --allow-net --allow-kv --allow-read --allow-write server.ts',
    env: {
      ADMIN_PASSWORD: 'your-secure-password',
      SESSION_EXPIRE_HOURS: '24',
      PORT: '8000'
    }
  }]
}
EOF

# 启动应用
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 4. 配置 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔧 配置说明

### 环境变量详解

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `ADMIN_PASSWORD` | string | `admin123` | 管理员登录密码 |
| `SESSION_EXPIRE_HOURS` | number | `24` | 会话过期时间（小时） |
| `DEFAULT_MONITOR_INTERVAL` | number | `1` | 默认监控间隔（分钟） |
| `MAX_MONITOR_INTERVAL` | number | `60` | 最大监控间隔（分钟） |
| `MIN_MONITOR_INTERVAL` | number | `1` | 最小监控间隔（分钟） |
| `PORT` | number | `8000` | 服务器端口 |
| `LOG_LEVEL` | string | `info` | 日志级别 |

### 性能调优

#### 缓存配置

系统内置缓存优化，可通过以下方式调整：

- 监控配置缓存：2分钟 TTL
- 历史记录缓存：5分钟 TTL
- 系统日志缓存：3分钟 TTL

#### 监控优化

- 最大并发监控数：10个
- 查询结果限制：1000条
- 自动刷新间隔：2分钟

## 🔍 故障排除

### 常见问题

#### 1. 部署失败

**问题**: 文件大小超过限制
**解决**: 确保使用新的模块化架构，每个文件都小于128KB

#### 2. 认证失败

**问题**: 无法登录系统
**解决**: 检查 `ADMIN_PASSWORD` 环境变量设置

#### 3. 监控不执行

**问题**: 监控任务不运行
**解决**: 检查调度器状态 `/api/system/scheduler`

#### 4. 性能问题

**问题**: 响应缓慢
**解决**: 检查缓存状态 `/api/system/cache`

### 日志查看

```bash
# Deno Deploy 日志
# 在控制台查看实时日志

# 本地部署日志
# 查看控制台输出

# Docker 部署日志
docker logs cloudstudio-monitor

# PM2 部署日志
pm2 logs cloudstudio-monitor
```

## 📊 监控和维护

### 健康检查

定期检查系统状态：

```bash
# 健康检查
curl https://your-domain.com/api/system/health

# 系统信息
curl https://your-domain.com/api/system/info

# 缓存状态
curl https://your-domain.com/api/system/cache
```

### 备份策略

Deno KV 数据自动备份，建议：

1. 定期导出监控配置
2. 备份重要的历史数据
3. 记录系统配置信息

### 更新升级

```bash
# 拉取最新代码
git pull origin main

# 重启服务
# Deno Deploy: 自动重新部署
# 本地/VPS: 重启应用
# Docker: 重新构建和部署
```

## 🔐 安全建议

1. **强密码**: 使用复杂的管理员密码
2. **HTTPS**: 生产环境启用 HTTPS
3. **防火墙**: 配置适当的防火墙规则
4. **更新**: 定期更新 Deno 和依赖
5. **监控**: 启用访问日志和监控

## 📞 技术支持

如遇到部署问题，请：

1. 检查系统日志
2. 查看健康检查状态
3. 参考故障排除指南
4. 提交 GitHub Issue
