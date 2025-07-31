# 🚀 CloudStudio 监控管理系统部署指南

## 部署概览

CloudStudio 监控管理系统支持多种部署方式，从本地开发到生产环境部署，提供灵活的配置选项和完整的部署流程。

## 📋 部署前准备

### 系统要求

#### 本地开发环境
- **Deno**: 2.3.5 或更高版本
- **操作系统**: Windows、macOS、Linux
- **内存**: 最低 512MB，推荐 1GB+
- **存储**: 最低 100MB 可用空间

#### 生产环境
- **平台**: Deno Deploy（推荐）
- **备选**: Docker、VPS、云服务器
- **网络**: 支持 HTTPS 的域名（可选）

### 环境变量配置

| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `PORT` | `8000` | HTTP 服务器端口 |
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

## 🌐 Deno Deploy 部署（推荐）

### 方法一：GitHub 集成部署

#### 步骤 1: 准备代码仓库
```bash
# 克隆或 Fork 项目
git clone https://github.com/your-username/CloudStudioRefresh.git
cd CloudStudioRefresh

# 确保代码是最新的
git pull origin main
```

#### 步骤 2: 连接 Deno Deploy
1. 访问 [Deno Deploy](https://dash.deno.com/)
2. 使用 GitHub 账户登录
3. 点击 "New Project"
4. 选择 "Deploy from GitHub repository"
5. 选择你的 CloudStudioRefresh 仓库
6. 配置部署设置：
   - **Entry Point**: `cloudStudioRefresh.ts`
   - **Branch**: `main`
   - **Auto Deploy**: 启用

#### 步骤 3: 环境变量配置
在 Deno Deploy 项目设置中添加环境变量：
```
ADMIN_PASSWORD=your-secure-password
SESSION_EXPIRE_HOURS=24
DEFAULT_MONITOR_INTERVAL=1
```

#### 步骤 4: 部署验证
1. 等待自动部署完成
2. 访问分配的 URL（如：`https://your-project.deno.dev`）
3. 使用配置的密码登录
4. 验证所有功能正常工作

### 方法二：直接文件上传

#### 步骤 1: 准备文件
```bash
# 下载主文件
curl -O https://raw.githubusercontent.com/your-username/CloudStudioRefresh/main/cloudStudioRefresh.ts
```

#### 步骤 2: 创建项目
1. 访问 [Deno Deploy](https://dash.deno.com/)
2. 点击 "New Project"
3. 选择 "Deploy from local file"
4. 上传 `cloudStudioRefresh.ts` 文件

#### 步骤 3: 配置和部署
1. 设置环境变量
2. 点击 "Deploy"
3. 等待部署完成

## 💻 本地开发部署

### 安装 Deno

#### Windows (PowerShell)
```powershell
irm https://deno.land/install.ps1 | iex
```

#### macOS/Linux
```bash
curl -fsSL https://deno.land/install.sh | sh
```

#### 验证安装
```bash
deno --version
```

### 运行应用

#### 开发模式
```bash
# 克隆项目
git clone https://github.com/your-username/CloudStudioRefresh.git
cd CloudStudioRefresh

# 运行开发服务器（自动重启）
deno run --allow-net --allow-kv --unstable-kv --watch cloudStudioRefresh.ts

# 或使用 deno.json 任务
deno task dev
```

#### 生产模式
```bash
# 运行生产服务器
deno run --allow-net --allow-kv --unstable-kv cloudStudioRefresh.ts

# 或使用 deno.json 任务
deno task start
```

#### 环境变量设置
```bash
# Linux/macOS
export ADMIN_PASSWORD=your-secure-password
export PORT=8000
deno task start

# Windows
set ADMIN_PASSWORD=your-secure-password
set PORT=8000
deno task start
```

### 使用部署脚本

```bash
# 给脚本执行权限
chmod +x deploy.sh

# 运行部署脚本
./deploy.sh
```

部署脚本会自动执行：
- 代码检查和格式化
- Lint 检查
- 集成测试
- 部署准备

## 🐳 Docker 部署

### Dockerfile
```dockerfile
FROM denoland/deno:1.40.0

WORKDIR /app

# 复制应用文件
COPY cloudStudioRefresh.ts .
COPY deno.json .

# 缓存依赖
RUN deno cache cloudStudioRefresh.ts

# 暴露端口
EXPOSE 8000

# 运行应用
CMD ["deno", "run", "--allow-net", "--allow-kv", "--unstable-kv", "cloudStudioRefresh.ts"]
```

### 构建和运行
```bash
# 构建镜像
docker build -t cloudstudio-monitor .

# 运行容器
docker run -d \
  --name cloudstudio-monitor \
  -p 8000:8000 \
  -e ADMIN_PASSWORD=your-secure-password \
  -e SESSION_EXPIRE_HOURS=24 \
  -v cloudstudio-data:/app/data \
  cloudstudio-monitor
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
      - DEFAULT_MONITOR_INTERVAL=1
    volumes:
      - cloudstudio-data:/app/data
    restart: unless-stopped

volumes:
  cloudstudio-data:
```

## 🔧 配置管理

### 配置文件示例

#### .env 文件
```bash
# 基本配置
PORT=8000
ADMIN_PASSWORD=your-secure-password

# 会话配置
SESSION_EXPIRE_HOURS=24

# 监控配置
DEFAULT_MONITOR_INTERVAL=1
MAX_MONITOR_INTERVAL=60
MIN_MONITOR_INTERVAL=1
MAX_CONCURRENT_MONITORS=10

# 数据配置
HISTORY_RETENTION_DAYS=30

# 安全配置
LOGIN_LOCKOUT_MINUTES=15
MAX_LOGIN_ATTEMPTS=5
REQUEST_TIMEOUT=30000

# 日志配置
LOG_LEVEL=info
```

### 配置验证

```bash
# 检查配置
deno run --allow-net --allow-kv --unstable-kv cloudStudioRefresh.ts --test

# 验证环境变量
deno eval "console.log(Deno.env.toObject())"
```

## 🔍 部署验证

### 健康检查

```bash
# 检查应用状态
curl http://localhost:8000/api/system/health

# 检查系统信息
curl http://localhost:8000/api/system/info
```

### 功能测试

1. **访问登录页面**: `http://localhost:8000`
2. **登录验证**: 使用配置的密码登录
3. **创建监控**: 添加一个测试监控配置
4. **查看状态**: 验证监控状态显示正常
5. **查看历史**: 检查监控历史记录

### 性能测试

```bash
# 简单压力测试
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8000/api/system/health

# 使用 ab 工具
ab -n 100 -c 10 http://localhost:8000/api/system/health
```

## 🛡️ 安全配置

### HTTPS 配置

#### Deno Deploy
- 自动提供 HTTPS
- 支持自定义域名
- 自动 SSL 证书管理

#### 自托管 HTTPS
```bash
# 使用 Caddy 反向代理
# Caddyfile
your-domain.com {
    reverse_proxy localhost:8000
}

# 使用 Nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 防火墙配置

```bash
# Ubuntu/Debian
sudo ufw allow 8000/tcp
sudo ufw enable

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --reload
```

## 📊 监控和维护

### 日志管理

```bash
# 查看应用日志
deno run --allow-net --allow-kv --unstable-kv cloudStudioRefresh.ts 2>&1 | tee app.log

# 日志轮转（使用 logrotate）
/var/log/cloudstudio/*.log {
    daily
    missingok
    rotate 7
    compress
    notifempty
    create 644 deno deno
}
```

### 备份策略

```bash
# 备份 KV 数据库
cp -r data/kv-store backup/kv-store-$(date +%Y%m%d)

# 自动备份脚本
#!/bin/bash
BACKUP_DIR="/backup/cloudstudio"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
cp -r data/kv-store $BACKUP_DIR/kv-store-$DATE
find $BACKUP_DIR -name "kv-store-*" -mtime +7 -delete
```

### 更新部署

```bash
# 拉取最新代码
git pull origin main

# 重启应用
pkill -f cloudStudioRefresh.ts
deno run --allow-net --allow-kv --unstable-kv cloudStudioRefresh.ts &
```

## 🔧 故障排除

### 常见问题

#### 1. 端口被占用
```bash
# 查找占用端口的进程
lsof -i :8000
netstat -tulpn | grep :8000

# 终止进程
kill -9 <PID>
```

#### 2. 权限问题
```bash
# 检查文件权限
ls -la cloudStudioRefresh.ts

# 修复权限
chmod +x cloudStudioRefresh.ts
```

#### 3. KV 数据库问题
```bash
# 清理 KV 数据库
rm -rf data/kv-store

# 重新初始化
deno run --allow-net --allow-kv --unstable-kv cloudStudioRefresh.ts
```

#### 4. 内存不足
```bash
# 检查内存使用
free -h
ps aux | grep deno

# 增加交换空间
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 调试模式

```bash
# 启用详细日志
LOG_LEVEL=debug deno run --allow-net --allow-kv --unstable-kv cloudStudioRefresh.ts

# 使用调试器
deno run --inspect --allow-net --allow-kv --unstable-kv cloudStudioRefresh.ts
```

这个部署指南涵盖了从开发到生产的完整部署流程，确保用户能够在各种环境中成功部署和运行 CloudStudio 监控管理系统。
