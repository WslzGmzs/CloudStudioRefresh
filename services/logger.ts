/**
 * 系统日志记录服务
 */

import { LogLevel } from '@/config/app.ts';
import type { SystemLog } from '@/models/system.ts';
import { kvService } from '@/services/kv.ts';
import { generateId } from '@/utils/helpers.ts';

/**
 * 日志记录器类
 */
export class Logger {
  private static instance: Logger;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * 记录信息日志
   */
  async info(message: string, monitorId?: string, monitorName?: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.INFO, message, monitorId, monitorName, metadata);
  }

  /**
   * 记录警告日志
   */
  async warn(message: string, monitorId?: string, monitorName?: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.WARN, message, monitorId, monitorName, metadata);
  }

  /**
   * 记录错误日志
   */
  async error(message: string, monitorId?: string, monitorName?: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.ERROR, message, monitorId, monitorName, metadata);
  }

  /**
   * 记录调试日志
   */
  async debug(message: string, monitorId?: string, monitorName?: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.DEBUG, message, monitorId, monitorName, metadata);
  }

  /**
   * 记录日志
   */
  private async log(
    level: LogLevel,
    message: string,
    monitorId?: string,
    monitorName?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const logEntry: SystemLog = {
        id: generateId(),
        level,
        message,
        timestamp: new Date(),
        monitorId,
        monitorName,
        metadata,
      };

      // 控制台输出
      this.consoleLog(level, message, monitorId);

      // 保存到数据库
      await kvService.saveSystemLog(logEntry);
    } catch (error) {
      // 避免日志记录失败影响主要功能
      console.error('日志记录失败:', error);
    }
  }

  /**
   * 控制台日志输出
   */
  private consoleLog(level: LogLevel, message: string, monitorId?: string): void {
    const timestamp = new Date().toISOString();
    const prefix = monitorId ? `[${monitorId}]` : '';
    const logMessage = `${timestamp} ${level} ${prefix} ${message}`;

    switch (level) {
      case LogLevel.ERROR:
        console.error(logMessage);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(logMessage);
        break;
      default:
        console.log(logMessage);
        break;
    }
  }

  /**
   * 记录监控开始
   */
  async logMonitorStart(monitorId: string, monitorName: string, url: string): Promise<void> {
    await this.info(`开始监控: ${url}`, monitorId, monitorName);
  }

  /**
   * 记录监控成功
   */
  async logMonitorSuccess(
    monitorId: string,
    monitorName: string,
    url: string,
    responseTime: number,
    httpStatus: number
  ): Promise<void> {
    await this.info(
      `监控成功: ${url} - ${httpStatus} (${responseTime}ms)`,
      monitorId,
      monitorName,
      { responseTime, httpStatus, url }
    );
  }

  /**
   * 记录监控失败
   */
  async logMonitorError(
    monitorId: string,
    monitorName: string,
    url: string,
    error: string,
    responseTime?: number
  ): Promise<void> {
    await this.error(
      `监控失败: ${url} - ${error}`,
      monitorId,
      monitorName,
      { error, url, responseTime }
    );
  }

  /**
   * 记录系统启动
   */
  async logSystemStart(): Promise<void> {
    await this.info('系统启动');
  }

  /**
   * 记录系统停止
   */
  async logSystemStop(): Promise<void> {
    await this.info('系统停止');
  }

  /**
   * 记录调度器启动
   */
  async logSchedulerStart(): Promise<void> {
    await this.info('监控调度器启动');
  }

  /**
   * 记录调度器停止
   */
  async logSchedulerStop(): Promise<void> {
    await this.info('监控调度器停止');
  }

  /**
   * 记录用户登录
   */
  async logUserLogin(ipAddress: string, userAgent: string, success: boolean): Promise<void> {
    const message = success ? '用户登录成功' : '用户登录失败';
    const level = success ? LogLevel.INFO : LogLevel.WARN;
    
    await this.log(level, message, undefined, undefined, { ipAddress, userAgent });
  }

  /**
   * 记录用户登出
   */
  async logUserLogout(ipAddress: string): Promise<void> {
    await this.info('用户登出', undefined, undefined, { ipAddress });
  }

  /**
   * 记录配置变更
   */
  async logConfigChange(action: string, monitorId: string, monitorName: string): Promise<void> {
    await this.info(`配置${action}: ${monitorName}`, monitorId, monitorName);
  }

  /**
   * 记录缓存操作
   */
  async logCacheOperation(operation: string, details?: string): Promise<void> {
    await this.debug(`缓存操作: ${operation}${details ? ` - ${details}` : ''}`);
  }

  /**
   * 记录性能指标
   */
  async logPerformanceMetric(metric: string, value: number, unit: string): Promise<void> {
    await this.debug(`性能指标: ${metric} = ${value}${unit}`, undefined, undefined, { metric, value, unit });
  }
}

// 导出单例实例
export const logger = Logger.getInstance();
