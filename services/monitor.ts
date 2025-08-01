/**
 * 监控执行服务
 */

import { APP_CONFIG } from '@/config/app.ts';
import { CACHE_KEYS, CACHE_TTL, QUERY_LIMITS } from '@/config/constants.ts';
import type { MonitorConfig, MonitorResult, MonitorHistory, MonitorExecutionOptions } from '@/models/monitor.ts';
import { kvService } from '@/services/kv.ts';
import { globalCache } from '@/services/cache.ts';
import { generateId } from '@/utils/helpers.ts';

/**
 * 监控服务类
 */
export class MonitorService {
  private static instance: MonitorService;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): MonitorService {
    if (!MonitorService.instance) {
      MonitorService.instance = new MonitorService();
    }
    return MonitorService.instance;
  }

  /**
   * 执行监控任务
   */
  async executeMonitor(
    config: MonitorConfig,
    options: MonitorExecutionOptions = {}
  ): Promise<MonitorResult> {
    const { retryCount = 0, timeout = APP_CONFIG.REQUEST_TIMEOUT, recordHistory = true } = options;
    const startTime = Date.now();

    try {
      console.log(`🔍 开始监控: ${config.name} (${config.url})`);

      // 准备请求头
      const headers = new Headers({
        'User-Agent': 'CloudStudio-Monitor/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      });

      // 添加 Cookie
      if (config.cookie) {
        headers.set('Cookie', config.cookie);
      }

      // 添加自定义请求头
      if (config.headers) {
        Object.entries(config.headers).forEach(([key, value]) => {
          headers.set(key, value);
        });
      }

      // 执行 HTTP 请求
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(config.url, {
        method: config.method || 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      console.log(`📊 监控响应: ${config.name} - ${response.status} (${responseTime}ms)`);

      // 判断监控是否成功
      const isSuccess = response.ok && response.status >= 200 && response.status < 400;
      
      let result: MonitorResult;

      if (isSuccess) {
        console.log(`✅ 监控成功: ${config.name} (${responseTime}ms)`);
        result = this.createMonitorResult(true, responseTime, response.status);
      } else {
        const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        console.log(`❌ 监控失败: ${config.name} - ${errorMsg} (${responseTime}ms)`);
        result = this.createMonitorResult(false, responseTime, response.status, errorMsg);
      }

      // 保存历史记录
      if (recordHistory) {
        await this.saveMonitorHistoryRecord(config.id, result);
      }

      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      console.error(`💥 监控异常: ${config.name} - ${errorMsg}`);

      // 重试机制
      if (retryCount < 2 && !errorMsg.includes('AbortError')) {
        console.log(`🔄 重试监控: ${config.name} (第 ${retryCount + 1} 次重试)`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.executeMonitor(config, { ...options, retryCount: retryCount + 1 });
      }

      console.error(`💥 监控最终失败: ${config.name} - ${errorMsg}`);
      const result = this.createMonitorResult(false, responseTime, undefined, errorMsg);

      // 保存历史记录
      if (recordHistory) {
        await this.saveMonitorHistoryRecord(config.id, result);
      }

      return result;
    }
  }

  /**
   * 批量执行监控任务
   */
  async executeMonitors(configs: MonitorConfig[]): Promise<MonitorResult[]> {
    const enabledConfigs = configs.filter((config) => config.enabled);

    if (enabledConfigs.length === 0) {
      console.log('没有启用的监控配置');
      return [];
    }

    console.log(`开始执行 ${enabledConfigs.length} 个监控任务`);

    // 限制并发数量
    const maxConcurrent = Math.min(enabledConfigs.length, QUERY_LIMITS.MAX_CONCURRENT_MONITORS);
    const results: MonitorResult[] = [];

    for (let i = 0; i < enabledConfigs.length; i += maxConcurrent) {
      const batch = enabledConfigs.slice(i, i + maxConcurrent);
      const batchPromises = batch.map((config) => this.executeMonitor(config));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 批次间延迟，避免过于频繁的请求
      if (i + maxConcurrent < enabledConfigs.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * 检查监控是否应该执行
   */
  shouldExecuteMonitor(config: MonitorConfig): boolean {
    // 如果没有上次检查时间，应该立即执行
    if (!config.lastCheck) {
      return true;
    }

    // 计算距离上次检查的时间（分钟）
    const now = new Date();
    const lastCheck = new Date(config.lastCheck);
    const timeDiffMinutes = Math.floor((now.getTime() - lastCheck.getTime()) / (1000 * 60));

    // 如果超过配置的间隔时间，应该执行
    return timeDiffMinutes >= config.interval;
  }

  /**
   * 计算监控下次执行时间
   */
  getNextExecutionTime(config: MonitorConfig): Date {
    if (!config.lastCheck) {
      return new Date(); // 立即执行
    }

    const lastCheck = new Date(config.lastCheck);
    const nextExecution = new Date(lastCheck.getTime() + (config.interval * 60 * 1000));
    return nextExecution;
  }

  /**
   * 获取指定时间范围内的监控历史记录（优化版）
   */
  async getMonitorHistoryInRange(
    monitorId: string,
    startTime: Date,
    endTime: Date,
    useCache: boolean = true,
  ): Promise<MonitorHistory[]> {
    const cacheKey = `${CACHE_KEYS.MONITOR_HISTORY}_${monitorId}_${startTime.getTime()}_${endTime.getTime()}`;
    
    // 尝试从缓存获取
    if (useCache) {
      const cached = globalCache.get<MonitorHistory[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const kv = await kvService.getKV();
      const histories: MonitorHistory[] = [];
      let processedCount = 0;

      const iter = kv.list<MonitorHistory>({
        prefix: ['history', monitorId],
      }, {
        limit: QUERY_LIMITS.MAX_HISTORY_RECORDS,
        reverse: true, // 从最新开始查询
      });

      for await (const entry of iter) {
        if (entry.value && processedCount < QUERY_LIMITS.MAX_HISTORY_RECORDS) {
          const history = entry.value;
          history.timestamp = new Date(history.timestamp);

          if (history.timestamp >= startTime && history.timestamp < endTime) {
            histories.push(history);
          }
          
          // 如果时间戳已经早于开始时间，可以停止查询
          if (history.timestamp < startTime) {
            break;
          }
          
          processedCount++;
        }
      }

      // 按时间排序
      histories.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // 缓存结果
      if (useCache) {
        globalCache.set(cacheKey, histories, CACHE_TTL.MONITOR_HISTORY);
      }

      return histories;
    } catch (error) {
      console.error('获取监控历史记录失败:', error);
      return [];
    }
  }

  /**
   * 创建监控结果
   */
  private createMonitorResult(
    success: boolean,
    responseTime?: number,
    httpStatus?: number,
    error?: string
  ): MonitorResult {
    return {
      success,
      status: success ? 'success' : 'error',
      responseTime,
      httpStatus,
      error,
      timestamp: new Date(),
    };
  }

  /**
   * 保存监控历史记录
   */
  private async saveMonitorHistoryRecord(monitorId: string, result: MonitorResult): Promise<void> {
    try {
      const history: MonitorHistory = {
        id: generateId(),
        monitorId,
        timestamp: result.timestamp,
        status: result.status || 'error',
        responseTime: result.responseTime,
        error: result.error,
        httpStatus: result.httpStatus,
      };

      await kvService.saveMonitorHistory(history);
    } catch (error) {
      console.error(`❌ 保存监控历史记录失败 (${monitorId}):`, error);
    }
  }
}

// 导出单例实例
export const monitorService = MonitorService.getInstance();
