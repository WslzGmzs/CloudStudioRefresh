/**
 * CloudStudio 监控管理系统 - 主服务器文件
 * 
 * 前后端分离架构的服务器入口点
 */

import { HTTP_STATUS } from '@/config/constants.ts';
import { APP_METADATA } from '@/config/constants.ts';
import { kvService } from '@/services/kv.ts';
import { monitorScheduler } from '@/services/scheduler.ts';
import { createHtmlResponse, createJsonResponse, createApiResponse, createTextResponse } from '@/utils/response.ts';

// API 路由处理器
import { handleLoginAPI, handleLogoutAPI, handleAuthStatusAPI } from '@/api/auth.ts';
import {
  handleGetMonitorsAPI,
  handleCreateMonitorAPI,
  handleUpdateMonitorAPI,
  handleDeleteMonitorAPI,
  handleMonitorStatusAPI
} from '@/api/monitors.ts';
import {
  handleMonitorStatsAPI,
  handleOverviewStatsAPI
} from '@/api/stats.ts';
import {
  handleCacheStatsAPI,
  handleSchedulerStatusAPI,
  handleClearCacheAPI
} from '@/api/system.ts';

// 应用启动时间
const startTime = Date.now();

/**
 * 路由处理器
 */
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { pathname, searchParams } = url;
  const method = request.method;

  console.log(`${method} ${pathname}`);

  try {
    // 静态文件服务
    if (pathname.startsWith('/public/') || pathname === '/favicon.ico') {
      return await handleStaticFiles(pathname);
    }

    // 主页面
    if (pathname === '/' || pathname === '/index.html') {
      return await handleIndexPage();
    }

    // API 路由
    if (pathname.startsWith('/api/')) {
      return await handleAPIRoutes(request, pathname, method);
    }

    // 404 页面
    return createJsonResponse(
      createApiResponse(false, null, 'Not Found'),
      HTTP_STATUS.NOT_FOUND
    );

  } catch (error) {
    console.error('❌ 请求处理错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '服务器内部错误'),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * 处理静态文件请求
 */
async function handleStaticFiles(pathname: string): Promise<Response> {
  try {
    // 移除 /public 前缀
    const filePath = pathname.startsWith('/public/') 
      ? pathname.substring(8) 
      : pathname;

    // 安全检查：防止路径遍历攻击
    if (filePath.includes('..') || filePath.includes('\\')) {
      return createTextResponse('Forbidden', HTTP_STATUS.FORBIDDEN);
    }

    // 根据文件扩展名设置 MIME 类型
    const ext = filePath.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'html': 'text/html; charset=utf-8',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
    };

    const mimeType = mimeTypes[ext || ''] || 'application/octet-stream';

    try {
      const content = await Deno.readTextFile(`./public/${filePath}`);
      return new Response(content, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=3600', // 1小时缓存
        },
      });
    } catch {
      return createTextResponse('File Not Found', HTTP_STATUS.NOT_FOUND);
    }

  } catch (error) {
    console.error('❌ 静态文件服务错误:', error);
    return createTextResponse('Internal Server Error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * 处理主页面请求
 */
async function handleIndexPage(): Promise<Response> {
  try {
    const html = await Deno.readTextFile('./public/index.html');
    return createHtmlResponse(html);
  } catch (error) {
    console.error('❌ 读取主页面失败:', error);
    
    // 如果文件不存在，返回简单的HTML页面
    const fallbackHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${APP_METADATA.NAME}</title>
</head>
<body>
    <h1>${APP_METADATA.NAME}</h1>
    <p>系统正在初始化，请稍后刷新页面...</p>
    <script>
        setTimeout(() => {
            window.location.reload();
        }, 3000);
    </script>
</body>
</html>`;
    
    return createHtmlResponse(fallbackHtml);
  }
}

/**
 * 处理 API 路由
 */
async function handleAPIRoutes(request: Request, pathname: string, method: string): Promise<Response> {
  // 认证相关 API
  if (pathname === '/api/login' && method === 'POST') {
    return await handleLoginAPI(request);
  }

  if (pathname === '/api/logout' && method === 'POST') {
    return await handleLogoutAPI(request);
  }

  if (pathname === '/api/auth/status' && method === 'GET') {
    return await handleAuthStatusAPI(request);
  }

  // 监控配置相关 API
  if (pathname === '/api/monitors' && method === 'GET') {
    return await handleGetMonitorsAPI(request);
  }

  if (pathname === '/api/monitors' && method === 'POST') {
    return await handleCreateMonitorAPI(request);
  }

  if (pathname.startsWith('/api/monitors/') && method === 'PUT') {
    const id = pathname.split('/')[3];
    return await handleUpdateMonitorAPI(request, id);
  }

  if (pathname.startsWith('/api/monitors/') && method === 'DELETE') {
    const id = pathname.split('/')[3];
    return await handleDeleteMonitorAPI(request, id);
  }

  if (pathname === '/api/monitors/status' && method === 'GET') {
    return await handleMonitorStatusAPI(request);
  }

  // 统计数据相关 API
  if (pathname === '/api/stats' && method === 'GET') {
    return await handleMonitorStatsAPI(request);
  }

  if (pathname === '/api/stats/overview' && method === 'GET') {
    return await handleOverviewStatsAPI(request);
  }

  // 系统信息 API
  if (pathname === '/api/system/info' && method === 'GET') {
    return await handleSystemInfoAPI(request);
  }

  if (pathname === '/api/system/health' && method === 'GET') {
    return await handleSystemHealthAPI(request);
  }

  if (pathname === '/api/system/cache' && method === 'GET') {
    return await handleCacheStatsAPI(request);
  }

  if (pathname === '/api/system/cache/clear' && method === 'POST') {
    return await handleClearCacheAPI(request);
  }

  if (pathname === '/api/system/scheduler' && method === 'GET') {
    return await handleSchedulerStatusAPI(request);
  }

  // 404 API
  return createJsonResponse(
    createApiResponse(false, null, 'API endpoint not found'),
    HTTP_STATUS.NOT_FOUND
  );
}

/**
 * 处理系统信息 API
 */
async function handleSystemInfoAPI(request: Request): Promise<Response> {
  try {
    const configs = await kvService.getAllMonitorConfigs();
    const schedulerStatus = monitorScheduler.getStatus();

    const info = {
      version: APP_METADATA.VERSION,
      name: APP_METADATA.NAME,
      totalMonitors: configs.length,
      enabledMonitors: configs.filter((c) => c.enabled).length,
      uptime: Date.now() - startTime,
      platform: 'Deno Deploy',
      scheduler: {
        isRunning: schedulerStatus.isRunning,
        executionCount: schedulerStatus.executionCount,
        lastExecutionTime: schedulerStatus.lastExecutionTime,
      },
    };

    return createJsonResponse(
      createApiResponse(true, info),
    );
  } catch (error) {
    console.error('❌ 获取系统信息错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '获取系统信息失败'),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 处理系统健康检查 API
 */
async function handleSystemHealthAPI(request: Request): Promise<Response> {
  try {
    const schedulerStatus = monitorScheduler.getStatus();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'healthy',
        monitoring: schedulerStatus.isRunning ? 'healthy' : 'stopped',
        scheduler: schedulerStatus.isRunning ? 'running' : 'stopped',
      },
      scheduler: schedulerStatus,
    };

    return createJsonResponse(
      createApiResponse(true, health),
    );
  } catch (error) {
    console.error('❌ 健康检查错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '健康检查失败'),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 应用启动函数
 */
async function startApplication(): Promise<void> {
  try {
    console.log(`🚀 启动 ${APP_METADATA.NAME} v${APP_METADATA.VERSION}`);

    // 初始化 KV 数据库
    await kvService.initialize();

    // 启动监控调度器
    await monitorScheduler.start();

    console.log('✅ 系统初始化完成');

    // 启动 HTTP 服务器
    const port = parseInt(Deno.env.get('PORT') || '8000');
    console.log(`🌐 服务器启动: http://localhost:${port}`);
    console.log('监控调度器已启动，将根据配置定期执行监控任务');
    console.log('按 Ctrl+C 停止\n');

    // 启动 HTTP 服务器
    await Deno.serve({ port }, handleRequest);
  } catch (error) {
    console.error('❌ 应用启动失败:', error);
    Deno.exit(1);
  }
}

// 启动应用
if (import.meta.main) {
  startApplication();
}
