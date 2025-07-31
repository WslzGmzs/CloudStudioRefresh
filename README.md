# CloudStudio Monitor Management System

🚀 A Deno Deploy compatible application with Web management interface, supporting multi-site monitoring configuration, authentication, and persistent data storage.

[![Deno](https://img.shields.io/badge/deno-v2.3.5+-black?logo=deno)](https://deno.land/)
[![Deploy](https://img.shields.io/badge/deploy-Deno%20Deploy-blue)](https://deno.com/deploy)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> 🎯 **Complete transformation from simple script to enterprise-level monitoring platform**

[中文文档](README_CN.md) | [English](README.md)

## ✨ Features

- 🌐 **Web Management Interface** - Modern responsive design
- 📊 **Multi-site Monitoring** - Support multiple website monitoring simultaneously
- 🔐 **Authentication** - Secure session management system
- 💾 **Data Persistence** - Deno KV based data storage
- ⏰ **Real-time Monitoring** - Automatic scheduled monitoring tasks
- 📈 **History Records** - Complete monitoring history tracking
- 📱 **Responsive Design** - Mobile device support
- 🚀 **Single File Deployment** - Zero dependencies, one-click deployment

## 🚀 Quick Start

### Local Development

```bash
# Clone repository
git clone https://github.com/WslzGmzs/CloudStudioRefresh.git
cd CloudStudioRefresh

# Run development version (includes testing features)
deno run --allow-net --allow-kv --unstable-kv cloudStudioRefresh.ts

# Run production version (recommended)
deno run --allow-net --allow-kv --unstable-kv cloudStudioRefresh.prod.ts
```

### Deno Deploy Deployment

#### ⚠️ Important: File Size Limit Solution

**Issue**: Original file `cloudStudioRefresh.ts` (139KB) exceeds Deno Deploy's 128KB limit
**Solution**: Use optimized production version `cloudStudioRefresh.prod.ts` (39KB)

#### Method 1: Direct File Upload (Recommended)
1. Visit [Deno Deploy](https://dash.deno.com/)
2. Create new project
3. **Upload `cloudStudioRefresh.prod.ts` file** (Important: use production version)
4. Set environment variables (optional)
5. Deploy complete

#### Method 2: GitHub Integration
1. Fork this repository to your GitHub account
2. Connect GitHub repository in Deno Deploy
3. **Select `cloudStudioRefresh.prod.ts` as entry file**
4. Automatic deployment

## 📁 Project Structure

```
CloudStudioRefresh/
├── cloudStudioRefresh.ts      # Development version (139KB, includes testing)
├── cloudStudioRefresh.prod.ts # Production version (39KB, recommended for deploy) ⭐
├── deno.json                  # Deno configuration file
├── deploy.sh                  # Deployment script
├── README.md                  # English documentation
├── README_CN.md               # Chinese documentation
├── FEATURES_UPDATE.md         # Feature update log
└── HOTFIX.md                  # Hotfix records
```

### File Description

- **`cloudStudioRefresh.ts`**: Complete development version with integration tests, deployment tools, etc.
- **`cloudStudioRefresh.prod.ts`**: Production optimized version, removed test code, file size optimized (39KB vs 139KB)

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_PASSWORD` | `admin123` | Administrator login password |
| `SESSION_EXPIRE_HOURS` | `24` | Session expiration time (hours) |
| `DEFAULT_MONITOR_INTERVAL` | `1` | Default monitoring interval (minutes) |
| `MAX_MONITOR_INTERVAL` | `60` | Maximum monitoring interval (minutes) |
| `MIN_MONITOR_INTERVAL` | `1` | Minimum monitoring interval (minutes) |
| `HISTORY_RETENTION_DAYS` | `30` | History record retention days |
| `MAX_CONCURRENT_MONITORS` | `10` | Maximum concurrent monitoring count |
| `REQUEST_TIMEOUT` | `30000` | Request timeout (milliseconds) |
| `LOGIN_LOCKOUT_MINUTES` | `15` | Login failure lockout time (minutes) |
| `MAX_LOGIN_ATTEMPTS` | `5` | Maximum login attempts |
| `LOG_LEVEL` | `info` | Log level |
| `PORT` | `8000` | Server port |

### Default Configuration

- 🔑 **Admin Password**: `admin123` (recommended to change)
- ⏱️ **Session Expiry**: 24 hours
- 📊 **Monitor Interval**: 1-60 minutes configurable
- 🔄 **Concurrent Monitors**: Maximum 10
- 📝 **History Retention**: 30 days

## 📚 API Documentation

### Page Routes
- `GET /` - Login page
- `GET /dashboard` - Management dashboard

### Authentication API
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/auth/check` - Authentication status check

### Monitor Configuration API
- `GET /api/monitors` - Get monitor configuration list
- `POST /api/monitors` - Create monitor configuration
- `PUT /api/monitors/:id` - Update monitor configuration
- `DELETE /api/monitors/:id` - Delete monitor configuration
- `GET /api/monitors/status` - Get monitor status

### System API
- `GET /api/system/info` - System information
- `GET /api/system/health` - Health check
- `GET /api/scheduler/status` - Scheduler status
- `POST /api/scheduler/restart` - Restart scheduler

## 🔒 Security Features

- 🔐 **Password Authentication** - Hard-coded password protection
- 🍪 **Session Management** - Secure Cookie sessions
- 🚫 **Rate Limiting** - Brute force attack prevention
- 🛡️ **CSRF Protection** - Cross-site request forgery protection
- 🔒 **Security Headers** - Complete security response headers

## 🔧 Development Guide

### Local Development

```bash
# Development mode (auto-restart)
deno run --allow-net --allow-kv --unstable-kv --watch cloudStudioRefresh.ts

# Code check
deno check cloudStudioRefresh.ts

# Code formatting
deno fmt cloudStudioRefresh.ts

# Code linting
deno lint cloudStudioRefresh.ts

# Run tests
deno run --allow-net --allow-kv --unstable-kv cloudStudioRefresh.ts --test
```

### Deployment Preparation

```bash
# Use deployment script
chmod +x deploy.sh
./deploy.sh

# Manual check
deno check cloudStudioRefresh.prod.ts
deno run --allow-net --allow-kv --unstable-kv cloudStudioRefresh.prod.ts
```

## 💡 Usage Examples

### CloudStudio Monitor Configuration

```json
{
  "name": "CloudStudio Project A Monitor",
  "url": "https://cloudstudio.net/a/26783234094321664/edit",
  "cookie": "cloudstudio-editor-session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "method": "POST",
  "interval": 1,
  "enabled": true
}
```

**How to get Cookie:**

1. Open Developer Tools (F12) in CloudStudio
2. Switch to Network tab
3. Refresh page and find any request
4. Copy complete Cookie value from request headers

### General Website Monitoring

```json
{
  "name": "Company Website Monitor",
  "url": "https://company.com/health",
  "cookie": "",
  "method": "GET",
  "interval": 5,
  "enabled": true
}
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Deployment Failed: File Size Exceeds Limit
**Error**: "A playground snippet can not be larger than 128kb"
**Solution**: Use `cloudStudioRefresh.prod.ts` file for deployment

#### 2. Cannot Access Management Interface
**Solution**:
```bash
# Check if application started normally
deno run --allow-net --allow-kv --unstable-kv cloudStudioRefresh.prod.ts

# Check if port is occupied
netstat -an | grep 8000
```

#### 3. Login Failed
**Solution**:
- Confirm password is `admin123` (or custom ADMIN_PASSWORD)
- Clear browser cookies and cache

#### 4. Monitoring Not Working
**Solution**:
```bash
# Check scheduler status
curl http://localhost:8000/api/scheduler/status

# Check system health
curl http://localhost:8000/api/system/health
```

## 🔄 Changelog

### v1.0.1 (2025-01-31) - Deployment Optimization

#### 🚀 Major Improvements
- **Production Version Optimization**: Created `cloudStudioRefresh.prod.ts` to solve Deno Deploy 128KB limit
- **File Size Optimization**: Reduced from 139KB to 39KB (72% reduction)
- **Deployment Compatibility**: Perfect support for Deno Deploy requirements

#### ✨ New Features
- **Dual Version Support**: Development version (full features) + Production version (optimized deployment)
- **TypeScript Optimization**: Fixed all type errors, ensuring type safety
- **Configuration Optimization**: Improved deno.json configuration, eliminated warnings

#### 🛠️ Technical Improvements
- **Code Streamlining**: Removed test code and development tools, retained core functionality
- **Performance Optimization**: Optimized code structure, improved runtime efficiency
- **Documentation Enhancement**: Detailed deployment guide and troubleshooting

### v1.0.0 (2025-01-31) - Initial Release
- Complete monitoring management system
- Web management interface
- Multi-site monitoring support
- Authentication and session management
- Persistent data storage

## 📄 License

MIT License

## 🤝 Contributing

We welcome all forms of contributions!

- 🐛 **Report Issues**: Use GitHub Issues
- 💡 **Feature Suggestions**: Submit in Issues
- 🔧 **Code Contributions**: Fork project and submit PR
- 📝 **Documentation Improvements**: Improve existing documentation

## 📞 Contact Us

- **Project Repository**: https://github.com/WslzGmzs/CloudStudioRefresh.git
- **Issue Reports**: GitHub Issues
- **Feature Suggestions**: GitHub Discussions

---

⭐ If this project helps you, please give us a Star!
