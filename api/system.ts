/**
 * 系统相关 API 处理函数
 */

import { HTTP_STATUS, ERROR_CODES } from '@/config/constants.ts';
import { globalCache } from '@/services/cache.ts';
import { monitorScheduler } from '@/services/scheduler.ts';
import { createJsonResponse, createApiResponse } from '@/utils/response.ts';
import { requireAuth } from '@/api/auth.ts';

/**
 * 处理缓存统计 API
 */
export async function handleCacheStatsAPI(request: Request): Promise<Response> {
  try {
    // 检查认证
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    const cacheStats = globalCache.getStats();
    const stats = {
      cacheSize: cacheStats.size,
      cacheKeys: cacheStats.keys,
      timestamp: new Date().toISOString(),
      optimization: {
        description: 'KV读取优化已启用',
        features: [
          '监控配置缓存 (2分钟TTL)',
          '历史记录查询缓存 (5分钟TTL)',
          '系统日志查询缓存 (3分钟TTL)',
          '自动刷新间隔延长至2分钟',
          '查询结果限制和分页',
        ],
      },
    };

    return createJsonResponse(
      createApiResponse(true, stats),
    );
  } catch (error) {
    console.error('❌ 获取缓存统计错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '获取缓存统计失败', ERROR_CODES.NETWORK_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 处理调度器状态 API
 */
export async function handleSchedulerStatusAPI(request: Request): Promise<Response> {
  try {
    // 检查认证
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    const status = monitorScheduler.getStatus();

    return createJsonResponse(
      createApiResponse(true, status),
    );
  } catch (error) {
    console.error('❌ 获取调度器状态错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '获取调度器状态失败', ERROR_CODES.INTERNAL_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 处理清除缓存 API
 */
export async function handleClearCacheAPI(request: Request): Promise<Response> {
  try {
    // 检查认证
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    const beforeSize = globalCache.getStats().size;
    globalCache.clear();
    const afterSize = globalCache.getStats().size;

    return createJsonResponse(
      createApiResponse(true, {
        message: '缓存已清除',
        beforeSize,
        afterSize,
        cleared: beforeSize - afterSize,
      }),
    );
  } catch (error) {
    console.error('❌ 清除缓存错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '清除缓存失败', ERROR_CODES.INTERNAL_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 处理系统维护 API
 */
export async function handleMaintenanceAPI(request: Request): Promise<Response> {
  try {
    // 检查认证
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    // 执行维护任务
    const cleanedCache = globalCache.cleanup();
    
    const maintenanceResult = {
      timestamp: new Date().toISOString(),
      tasks: [
        {
          name: '清理过期缓存',
          result: `清理了 ${cleanedCache} 个过期缓存条目`,
          success: true,
        },
      ],
    };

    return createJsonResponse(
      createApiResponse(true, maintenanceResult, '系统维护完成'),
    );
  } catch (error) {
    console.error('❌ 系统维护错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '系统维护失败', ERROR_CODES.INTERNAL_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}
