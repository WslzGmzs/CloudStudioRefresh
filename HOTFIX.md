# 🔧 HTTP 405 错误修复指南

## 问题描述

您遇到的 **HTTP 405 Method Not Allowed** 错误是因为系统默认使用 POST 方法发送请求，而 bilibili.com 等大多数网站不允许对首页使用 POST 方法。

## 🚀 快速修复方案

### 方案一：更新现有监控配置（推荐）

1. **登录管理界面**
   - 访问您的监控系统
   - 使用管理员密码登录

2. **编辑 bilibili 监控配置**
   - 找到 "bilibili" 监控配置
   - 点击"编辑"按钮
   - 在"请求方法"下拉框中选择 **GET**
   - 点击"保存"

3. **验证修复**
   - 等待下一个监控周期（1分钟内）
   - 查看监控状态是否变为"正常"

### 方案二：重新部署修复版本

如果您想要最新的修复版本：

1. **下载更新后的文件**
   - 下载最新的 `cloudStudioRefresh.ts`
   - 文件已包含 HTTP 方法选择功能

2. **重新部署**
   - 在 Deno Deploy 中上传新文件
   - 或本地重新运行应用

## 🎯 HTTP 方法选择指南

### GET 方法（推荐）
- ✅ 适用于大多数网站
- ✅ bilibili.com、GitHub、Google 等
- ✅ 标准的健康检查方式

### POST 方法
- ✅ CloudStudio 会话保活
- ✅ 特定的 API 端点
- ❌ 大多数网站首页不支持

### HEAD 方法
- ✅ 仅检查响应头
- ✅ 节省带宽
- ✅ 适用于大文件检查

## 📊 常见网站推荐配置

### bilibili.com
```json
{
  "name": "bilibili 监控",
  "url": "https://www.bilibili.com",
  "method": "GET",
  "interval": 5
}
```

### GitHub
```json
{
  "name": "GitHub 监控",
  "url": "https://github.com",
  "method": "GET",
  "interval": 10
}
```

### CloudStudio
```json
{
  "name": "CloudStudio 监控",
  "url": "https://cloudstudio.net/a/your-project/edit",
  "method": "POST",
  "cookie": "your-session-cookie",
  "interval": 1
}
```

## 🔍 故障排除

### 如果仍然出现 405 错误
1. 确认选择了正确的 HTTP 方法
2. 检查目标 URL 是否正确
3. 尝试使用 HEAD 方法

### 如果出现其他错误
- **403 Forbidden**：可能需要 Cookie 或认证
- **404 Not Found**：检查 URL 是否正确
- **超时错误**：检查网络连接

## 📝 更新日志

### v1.0.1 - HTTP 方法支持
- ✅ 添加 GET、POST、HEAD 方法选择
- ✅ 修复 405 Method Not Allowed 错误
- ✅ 更新前端界面支持方法选择
- ✅ 优化默认配置推荐

## 💡 最佳实践

1. **新建监控时**：优先选择 GET 方法
2. **CloudStudio 监控**：使用 POST 方法
3. **API 监控**：根据 API 文档选择合适方法
4. **带宽敏感**：考虑使用 HEAD 方法

---

如果您需要进一步帮助，请查看完整的 README.md 文档或联系技术支持。
