/**
 * 统计数据相关 API 处理函数
 */

import { HTTP_STATUS, ERROR_CODES, CACHE_KEYS, CACHE_TTL } from '@/config/constants.ts';
import type { MonitorStats, MonitorStatsDataPoint } from '@/models/monitor.ts';
import { kvService } from '@/services/kv.ts';
import { monitorService } from '@/services/monitor.ts';
import { globalCache } from '@/services/cache.ts';
import { createJsonResponse, createApiResponse } from '@/utils/response.ts';
import { requireAuth } from '@/api/auth.ts';

/**
 * 处理监控统计 API
 */
export async function handleMonitorStatsAPI(request: Request): Promise<Response> {
  try {
    // 检查认证
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    const url = new URL(request.url);
    const period = url.searchParams.get('period') as '24h' | '7d' || '24h';

    const configs = await kvService.getAllMonitorConfigs();
    const stats: MonitorStats[] = [];

    for (const config of configs) {
      const configStats = await generateMonitorStats(config.id, config.name, period);
      stats.push(configStats);
    }

    return createJsonResponse(
      createApiResponse(true, stats),
    );
  } catch (error) {
    console.error('❌ 获取监控统计错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '获取监控统计失败', ERROR_CODES.DATABASE_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 处理单个监控详细统计 API
 */
export async function handleMonitorDetailStatsAPI(request: Request, id: string): Promise<Response> {
  try {
    // 检查认证
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    const config = await kvService.getMonitorConfig(id);
    if (!config) {
      return createJsonResponse(
        createApiResponse(false, null, '监控配置不存在', ERROR_CODES.RESOURCE_NOT_FOUND),
        HTTP_STATUS.NOT_FOUND,
      );
    }

    const url = new URL(request.url);
    const period = url.searchParams.get('period') as '24h' | '7d' || '24h';

    const stats = await generateMonitorStats(config.id, config.name, period);

    return createJsonResponse(
      createApiResponse(true, stats),
    );
  } catch (error) {
    console.error('❌ 获取监控详细统计错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '获取监控详细统计失败', ERROR_CODES.DATABASE_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 生成监控统计数据
 */
async function generateMonitorStats(
  monitorId: string,
  monitorName: string,
  period: '24h' | '7d',
): Promise<MonitorStats> {
  const cacheKey = `${CACHE_KEYS.MONITOR_STATS}_${monitorId}_${period}`;
  
  // 尝试从缓存获取
  const cached = globalCache.get<MonitorStats>(cacheKey);
  if (cached) {
    return cached;
  }

  const now = new Date();
  const dataPoints: MonitorStatsDataPoint[] = [];

  if (period === '24h') {
    // 24小时视图：按小时统计
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
      hourStart.setMinutes(0, 0, 0);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

      const histories = await monitorService.getMonitorHistoryInRange(monitorId, hourStart, hourEnd);
      const success = histories.filter((h) => h.status === 'success').length;
      const failure = histories.filter((h) => h.status === 'error').length;
      const total = success + failure;
      const successRate = total > 0 ? (success / total) * 100 : 0;

      dataPoints.push({
        label: hourStart.getHours().toString().padStart(2, '0') + ':00',
        success,
        failure,
        successRate: Math.round(successRate * 100) / 100,
        timestamp: hourStart,
      });
    }
  } else {
    // 7天视图：按天统计
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const histories = await monitorService.getMonitorHistoryInRange(monitorId, dayStart, dayEnd);
      const success = histories.filter((h) => h.status === 'success').length;
      const failure = histories.filter((h) => h.status === 'error').length;
      const total = success + failure;
      const successRate = total > 0 ? (success / total) * 100 : 0;

      dataPoints.push({
        label: `${dayStart.getMonth() + 1}/${dayStart.getDate()}`,
        success,
        failure,
        successRate: Math.round(successRate * 100) / 100,
        timestamp: dayStart,
      });
    }
  }

  const stats: MonitorStats = {
    monitorId,
    monitorName,
    period,
    dataPoints,
  };

  // 缓存结果
  globalCache.set(cacheKey, stats, CACHE_TTL.MONITOR_STATS);

  return stats;
}

/**
 * 处理监控概览统计 API
 */
export async function handleOverviewStatsAPI(request: Request): Promise<Response> {
  try {
    // 检查认证
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    const configs = await kvService.getAllMonitorConfigs();
    
    const overview = {
      totalMonitors: configs.length,
      enabledMonitors: configs.filter(c => c.enabled).length,
      successMonitors: configs.filter(c => c.status === 'success').length,
      errorMonitors: configs.filter(c => c.status === 'error').length,
      pendingMonitors: configs.filter(c => c.status === 'pending' || !c.status).length,
    };

    return createJsonResponse(
      createApiResponse(true, overview),
    );
  } catch (error) {
    console.error('❌ 获取概览统计错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '获取概览统计失败', ERROR_CODES.DATABASE_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}
