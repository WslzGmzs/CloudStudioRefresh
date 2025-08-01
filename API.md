# CloudStudio 监控系统 API 文档

## 概述

本文档描述了 CloudStudio 监控系统的 RESTful API 接口。系统采用前后端分离架构，所有 API 都基于 HTTP 协议，使用 JSON 格式进行数据交换。

## 🔐 认证机制

系统使用基于 Cookie 的会话认证机制：

1. 用户通过 `/api/login` 接口登录
2. 服务器返回会话 Cookie
3. 后续请求自动携带 Cookie 进行认证
4. 会话过期后需要重新登录

## 📋 通用响应格式

所有 API 响应都遵循统一格式：

```json
{
  "success": true,
  "data": {},
  "error": null,
  "code": null,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 响应字段说明

- `success`: 请求是否成功
- `data`: 响应数据（成功时）
- `error`: 错误信息（失败时）
- `code`: 错误代码（失败时）
- `timestamp`: 响应时间戳

## 🔑 认证相关 API

### 用户登录

**POST** `/api/login`

登录系统获取会话。

**请求体:**
```json
{
  "password": "admin123"
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid-string"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 用户登出

**POST** `/api/logout`

登出系统，清除会话。

**响应:**
```json
{
  "success": true,
  "data": null,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 检查认证状态

**GET** `/api/auth/status`

检查当前用户的认证状态。

**响应:**
```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "session": {
      "id": "uuid-string",
      "expires": "2024-01-02T00:00:00.000Z",
      "lastAccessAt": "2024-01-01T12:00:00.000Z"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 📊 监控配置 API

### 获取所有监控配置

**GET** `/api/monitors`

获取所有监控配置列表。

**响应:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-string",
      "name": "网站监控",
      "url": "https://example.com",
      "cookie": "",
      "method": "GET",
      "interval": 5,
      "enabled": true,
      "status": "success",
      "lastCheck": "2024-01-01T12:00:00.000Z",
      "lastError": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T12:00:00.000Z"
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 创建监控配置

**POST** `/api/monitors`

创建新的监控配置。

**请求体:**
```json
{
  "name": "网站监控",
  "url": "https://example.com",
  "cookie": "",
  "method": "GET",
  "interval": 5,
  "enabled": true
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-string",
    "name": "网站监控",
    "url": "https://example.com",
    "cookie": "",
    "method": "GET",
    "interval": 5,
    "enabled": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 更新监控配置

**PUT** `/api/monitors/:id`

更新指定的监控配置。

**请求体:**
```json
{
  "name": "更新的网站监控",
  "interval": 10,
  "enabled": false
}
```

### 删除监控配置

**DELETE** `/api/monitors/:id`

删除指定的监控配置。

**响应:**
```json
{
  "success": true,
  "data": null,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 获取监控状态

**GET** `/api/monitors/status`

获取所有监控的当前状态。

**响应:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-string",
      "name": "网站监控",
      "enabled": true,
      "status": "success",
      "lastCheck": "2024-01-01T12:00:00.000Z",
      "lastError": null
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 📈 统计数据 API

### 获取监控统计

**GET** `/api/stats?period=24h`

获取监控统计数据。

**查询参数:**
- `period`: 统计周期，可选值 `24h` 或 `7d`

**响应:**
```json
{
  "success": true,
  "data": [
    {
      "monitorId": "uuid-string",
      "monitorName": "网站监控",
      "period": "24h",
      "dataPoints": [
        {
          "label": "00:00",
          "success": 10,
          "failure": 0,
          "successRate": 100,
          "timestamp": "2024-01-01T00:00:00.000Z"
        }
      ]
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 获取概览统计

**GET** `/api/stats/overview`

获取系统概览统计。

**响应:**
```json
{
  "success": true,
  "data": {
    "totalMonitors": 5,
    "enabledMonitors": 4,
    "successMonitors": 3,
    "errorMonitors": 1,
    "pendingMonitors": 0
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🔧 系统管理 API

### 获取系统信息

**GET** `/api/system/info`

获取系统基本信息。

**响应:**
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "name": "CloudStudio Monitor",
    "totalMonitors": 5,
    "enabledMonitors": 4,
    "uptime": 3600000,
    "platform": "Deno Deploy",
    "scheduler": {
      "isRunning": true,
      "executionCount": 100,
      "lastExecutionTime": "2024-01-01T12:00:00.000Z"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 健康检查

**GET** `/api/system/health`

检查系统健康状态。

**响应:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "services": {
      "database": "healthy",
      "monitoring": "healthy",
      "scheduler": "running"
    },
    "scheduler": {
      "isRunning": true,
      "executionCount": 100,
      "lastExecutionTime": "2024-01-01T12:00:00.000Z"
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 获取缓存统计

**GET** `/api/system/cache`

获取缓存使用统计。

**响应:**
```json
{
  "success": true,
  "data": {
    "cacheSize": 10,
    "cacheKeys": ["all_monitor_configs", "history_xxx"],
    "timestamp": "2024-01-01T12:00:00.000Z",
    "optimization": {
      "description": "KV读取优化已启用",
      "features": [
        "监控配置缓存 (2分钟TTL)",
        "历史记录查询缓存 (5分钟TTL)",
        "系统日志查询缓存 (3分钟TTL)",
        "自动刷新间隔延长至2分钟",
        "查询结果限制和分页"
      ]
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 清除缓存

**POST** `/api/system/cache/clear`

清除所有缓存。

**响应:**
```json
{
  "success": true,
  "data": {
    "message": "缓存已清除",
    "beforeSize": 10,
    "afterSize": 0,
    "cleared": 10
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 获取调度器状态

**GET** `/api/system/scheduler`

获取任务调度器状态。

**响应:**
```json
{
  "success": true,
  "data": {
    "isRunning": true,
    "lastExecutionTime": "2024-01-01T12:00:00.000Z",
    "executionCount": 100
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## ❌ 错误代码

| 代码 | 说明 |
|------|------|
| 1001 | 验证错误 |
| 1002 | 认证失败 |
| 1004 | 资源不存在 |
| 2001 | 数据库错误 |
| 2002 | 网络错误 |
| 4001 | 未认证 |
| 5001 | 内部错误 |

## 📝 使用示例

### JavaScript 示例

```javascript
// 登录
const loginResponse = await fetch('/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: 'admin123' })
});

// 获取监控配置
const monitorsResponse = await fetch('/api/monitors');
const monitors = await monitorsResponse.json();

// 创建监控配置
const createResponse = await fetch('/api/monitors', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '网站监控',
    url: 'https://example.com',
    interval: 5,
    enabled: true
  })
});
```
