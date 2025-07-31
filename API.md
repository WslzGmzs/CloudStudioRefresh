# 📡 CloudStudio 监控管理系统 API 文档

## API 概览

CloudStudio 监控管理系统提供完整的 RESTful API，支持监控配置管理、系统状态查询、用户认证等功能。所有 API 都基于 JSON 格式进行数据交换。

## 🔐 认证机制

### 会话认证
所有需要认证的 API 都使用基于 Cookie 的会话认证：

```http
Cookie: session=your-session-id
```

### 认证流程
1. 通过 `/api/login` 登录获取会话
2. 后续请求自动携带会话 Cookie
3. 会话过期后需要重新登录

## 📋 API 端点列表

### 页面路由

#### GET /
登录页面
- **响应**: HTML 登录页面

#### GET /dashboard
管理仪表板页面
- **响应**: HTML 仪表板页面
- **认证**: 需要登录

---

### 认证 API

#### POST /api/login
用户登录

**请求体**:
```json
{
  "password": "admin123"
}
```

**成功响应**:
```json
{
  "success": true,
  "data": {
    "sessionId": "session-uuid",
    "expires": "2025-02-01T12:00:00.000Z"
  },
  "message": "登录成功"
}
```

**错误响应**:
```json
{
  "success": false,
  "data": null,
  "message": "密码错误",
  "code": "AUTH_FAILED"
}
```

#### POST /api/logout
用户登出

**响应**:
```json
{
  "success": true,
  "data": null,
  "message": "登出成功"
}
```

#### GET /api/auth/check
检查认证状态

**响应**:
```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "sessionId": "session-uuid",
    "expires": "2025-02-01T12:00:00.000Z"
  }
}
```

---

### 监控配置 API

#### GET /api/monitors
获取监控配置列表
- **认证**: 需要登录

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "monitor-uuid",
      "name": "网站监控",
      "url": "https://example.com",
      "method": "GET",
      "interval": 5,
      "enabled": true,
      "timeout": 30000,
      "createdAt": "2025-01-31T10:00:00.000Z",
      "updatedAt": "2025-01-31T10:00:00.000Z"
    }
  ]
}
```

#### POST /api/monitors
创建监控配置
- **认证**: 需要登录

**请求体**:
```json
{
  "name": "新监控",
  "url": "https://example.com",
  "method": "GET",
  "interval": 5,
  "enabled": true,
  "cookie": "optional-cookie",
  "headers": {
    "User-Agent": "CloudStudio Monitor"
  }
}
```

#### PUT /api/monitors/:id
更新监控配置
- **认证**: 需要登录
- **路径参数**: `id` - 监控配置 ID

#### DELETE /api/monitors/:id
删除监控配置
- **认证**: 需要登录
- **路径参数**: `id` - 监控配置 ID

#### GET /api/monitors/status
获取所有监控状态
- **认证**: 需要登录

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "monitorId": "monitor-uuid",
      "name": "网站监控",
      "status": "online",
      "lastCheck": "2025-01-31T12:00:00.000Z",
      "responseTime": 150,
      "uptime": 99.5
    }
  ]
}
```

---

### 系统 API

#### GET /api/system/info
获取系统信息
- **认证**: 需要登录

**响应**:
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "totalMonitors": 5,
    "enabledMonitors": 3,
    "uptime": 86400000,
    "platform": "Deno Deploy",
    "scheduler": {
      "isRunning": true,
      "executionCount": 1440,
      "lastExecutionTime": "2025-01-31T12:00:00.000Z"
    }
  }
}
```

#### GET /api/system/health
系统健康检查

**响应**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "checks": {
      "database": true,
      "scheduler": true,
      "monitorConfigs": true
    },
    "errors": []
  }
}
```

---

## 📊 数据格式

### 标准响应格式
```json
{
  "success": boolean,
  "data": any | null,
  "message": string,
  "code": string
}
```

### 错误码列表

| 错误码 | 描述 | HTTP 状态码 |
|--------|------|-------------|
| `AUTH_FAILED` | 认证失败 | 401 |
| `SESSION_EXPIRED` | 会话过期 | 401 |
| `PERMISSION_DENIED` | 权限不足 | 403 |
| `NOT_FOUND` | 资源不存在 | 404 |
| `VALIDATION_ERROR` | 数据验证错误 | 400 |
| `DATABASE_ERROR` | 数据库错误 | 500 |
| `NETWORK_ERROR` | 网络错误 | 500 |
| `RATE_LIMITED` | 请求频率限制 | 429 |

## 🔧 使用示例

### JavaScript 示例

```javascript
// 登录
const loginResponse = await fetch('/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: 'admin123' })
});

// 获取监控列表
const monitorsResponse = await fetch('/api/monitors', {
  credentials: 'include'
});

// 创建监控
const createResponse = await fetch('/api/monitors', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    name: '新监控',
    url: 'https://example.com',
    method: 'GET',
    interval: 5,
    enabled: true
  })
});
```

### cURL 示例

```bash
# 登录
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"password":"admin123"}' \
  -c cookies.txt

# 获取监控列表
curl -X GET http://localhost:8000/api/monitors \
  -b cookies.txt

# 创建监控
curl -X POST http://localhost:8000/api/monitors \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "新监控",
    "url": "https://example.com",
    "method": "GET",
    "interval": 5,
    "enabled": true
  }'
```

## 🚀 最佳实践

1. **错误处理**: 始终检查 `success` 字段
2. **认证管理**: 妥善处理会话过期
3. **请求频率**: 避免过于频繁的 API 调用
4. **数据验证**: 客户端也要进行数据验证
5. **超时处理**: 设置合理的请求超时时间
