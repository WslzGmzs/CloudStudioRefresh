/**
 * 系统相关数据模型和接口定义
 */

import { LogLevel } from '@/config/app.ts';

/**
 * 系统日志接口
 */
export interface SystemLog {
  /** 唯一标识符 */
  id: string;
  /** 日志级别 */
  level: LogLevel;
  /** 日志消息 */
  message: string;
  /** 时间戳 */
  timestamp: Date;
  /** 监控配置 ID（可选） */
  monitorId?: string;
  /** 监控名称（可选） */
  monitorName?: string;
  /** 额外数据 */
  metadata?: Record<string, any>;
}

/**
 * API 响应接口
 */
export interface ApiResponse<T = any> {
  /** 是否成功 */
  success: boolean;
  /** 响应数据 */
  data?: T;
  /** 错误信息 */
  error?: string;
  /** 错误代码 */
  code?: number;
  /** 时间戳 */
  timestamp: string;
}

/**
 * 系统信息接口
 */
export interface SystemInfo {
  /** 版本号 */
  version: string;
  /** 总监控数 */
  totalMonitors: number;
  /** 启用监控数 */
  enabledMonitors: number;
  /** 运行时间（毫秒） */
  uptime: number;
  /** 平台信息 */
  platform: string;
  /** 调度器状态 */
  scheduler: {
    isRunning: boolean;
    executionCount: number;
    lastExecutionTime: Date | null;
  };
}

/**
 * 系统健康状态接口
 */
export interface SystemHealth {
  /** 状态 */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** 时间戳 */
  timestamp: string;
  /** 服务状态 */
  services: {
    database: 'healthy' | 'unhealthy';
    monitoring: 'healthy' | 'stopped';
    scheduler: 'running' | 'stopped';
  };
  /** 调度器状态 */
  scheduler: {
    isRunning: boolean;
    executionCount: number;
    lastExecutionTime: Date | null;
  };
}

/**
 * 缓存统计接口
 */
export interface CacheStats {
  /** 缓存大小 */
  cacheSize: number;
  /** 缓存键列表 */
  cacheKeys: string[];
  /** 时间戳 */
  timestamp: string;
  /** 优化信息 */
  optimization: {
    description: string;
    features: string[];
  };
}

/**
 * 分页查询选项
 */
export interface PaginationOptions {
  /** 页码（从1开始） */
  page?: number;
  /** 每页数量 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
}

/**
 * 分页查询结果
 */
export interface PaginatedResult<T> {
  /** 数据列表 */
  items: T[];
  /** 总数量 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页数量 */
  limit: number;
  /** 总页数 */
  totalPages: number;
  /** 是否有下一页 */
  hasNext: boolean;
  /** 是否有上一页 */
  hasPrev: boolean;
}
