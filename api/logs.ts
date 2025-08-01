/**
 * 系统日志相关 API 处理函数
 */

import { HTTP_STATUS, ERROR_CODES, CACHE_KEYS, CACHE_TTL, QUERY_LIMITS } from '@/config/constants.ts';
import type { SystemLog } from '@/models/system.ts';
import { kvService } from '@/services/kv.ts';
import { globalCache } from '@/services/cache.ts';
import { createJsonResponse, createApiResponse, createPaginatedResponse } from '@/utils/response.ts';
import { requireAuth } from '@/api/auth.ts';

/**
 * 处理获取系统日志 API
 */
export async function handleGetLogsAPI(request: Request): Promise<Response> {
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
    const level = url.searchParams.get('level') as 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | null;
    const monitorId = url.searchParams.get('monitorId');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const search = url.searchParams.get('search');

    const result = await getSystemLogs({
      level,
      monitorId,
      page,
      limit,
      search,
    });

    return createPaginatedResponse(
      result.logs,
      result.total,
      page,
      limit,
    );
  } catch (error) {
    console.error('❌ 获取系统日志错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '获取系统日志失败', ERROR_CODES.DATABASE_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 处理导出系统日志 API
 */
export async function handleExportLogsAPI(request: Request): Promise<Response> {
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
    const level = url.searchParams.get('level') as 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | null;
    const monitorId = url.searchParams.get('monitorId');
    const format = url.searchParams.get('format') || 'json';

    const result = await getSystemLogs({
      level,
      monitorId,
      limit: 1000, // 导出限制
      useCache: false, // 导出时不使用缓存
    });

    if (format === 'csv') {
      const csv = convertLogsToCSV(result.logs);
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="system-logs-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else {
      return createJsonResponse(
        createApiResponse(true, result.logs),
      );
    }
  } catch (error) {
    console.error('❌ 导出系统日志错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '导出系统日志失败', ERROR_CODES.INTERNAL_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 获取系统日志（优化版）
 */
async function getSystemLogs(options: {
  level?: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | null;
  monitorId?: string | null;
  page?: number;
  limit?: number;
  search?: string | null;
  useCache?: boolean;
} = {}): Promise<{ logs: SystemLog[]; total: number }> {
  const {
    level,
    monitorId,
    page = 1,
    limit = QUERY_LIMITS.DEFAULT_LOG_LIMIT,
    search,
    useCache = true,
  } = options;

  const offset = (page - 1) * limit;
  const cacheKey = `${CACHE_KEYS.SYSTEM_LOGS}_${level || 'all'}_${monitorId || 'all'}_${page}_${limit}_${search || 'all'}`;
  
  // 尝试从缓存获取
  if (useCache) {
    const cached = globalCache.get<{ logs: SystemLog[]; total: number }>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  try {
    const kv = await kvService.getKV();
    const logs: SystemLog[] = [];
    let count = 0;
    let processedCount = 0;
    const maxProcessCount = QUERY_LIMITS.MAX_SYSTEM_LOGS;

    const iter = kv.list<SystemLog>({
      prefix: ['system_logs'],
    }, {
      reverse: true, // 最新的在前
      limit: maxProcessCount,
    });

    for await (const entry of iter) {
      if (entry.value && processedCount < maxProcessCount) {
        const log = entry.value;
        log.timestamp = new Date(log.timestamp);

        // 应用过滤条件
        if (level && log.level !== level) {
          processedCount++;
          continue;
        }

        if (monitorId && log.monitorId !== monitorId) {
          processedCount++;
          continue;
        }

        if (search && !log.message.toLowerCase().includes(search.toLowerCase())) {
          processedCount++;
          continue;
        }

        count++;

        // 应用分页
        if (count <= offset) {
          processedCount++;
          continue;
        }

        logs.push(log);

        // 应用限制
        if (logs.length >= limit) {
          break;
        }
        
        processedCount++;
      }
    }

    const result = { logs, total: count };

    // 缓存结果
    if (useCache) {
      globalCache.set(cacheKey, result, CACHE_TTL.SYSTEM_LOGS);
    }

    return result;
  } catch (error) {
    console.error('获取系统日志失败:', error);
    return { logs: [], total: 0 };
  }
}

/**
 * 转换日志为CSV格式
 */
function convertLogsToCSV(logs: SystemLog[]): string {
  const headers = ['时间', '级别', '消息', '监控ID', '监控名称'];
  const rows = logs.map(log => [
    log.timestamp.toISOString(),
    log.level,
    `"${log.message.replace(/"/g, '""')}"`, // 转义双引号
    log.monitorId || '',
    log.monitorName || '',
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}
