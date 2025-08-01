/**
 * 监控相关数据模型和接口定义
 */

/**
 * 监控配置接口
 */
export interface MonitorConfig {
  /** 唯一标识符 */
  id: string;
  /** 监控名称 */
  name: string;
  /** 目标 URL */
  url: string;
  /** 请求 Cookie */
  cookie: string;
  /** 自定义请求头 */
  headers?: Record<string, string>;
  /** HTTP 请求方法 */
  method?: 'GET' | 'POST' | 'HEAD';
  /** 监控间隔（分钟） */
  interval: number;
  /** 是否启用 */
  enabled: boolean;
  /** 最后检查时间 */
  lastCheck?: Date;
  /** 监控状态 */
  status?: 'success' | 'error' | 'pending';
  /** 最后错误信息 */
  lastError?: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 监控配置创建/更新请求
 */
export interface MonitorConfigRequest {
  /** 监控名称 */
  name: string;
  /** 目标 URL */
  url: string;
  /** 请求 Cookie */
  cookie: string;
  /** 自定义请求头 */
  headers?: Record<string, string>;
  /** HTTP 请求方法 */
  method?: 'GET' | 'POST' | 'HEAD';
  /** 监控间隔（分钟） */
  interval: number;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 监控结果接口
 */
export interface MonitorResult {
  success: boolean;
  status?: 'success' | 'error';
  responseTime?: number;
  httpStatus?: number;
  error?: string;
  timestamp: Date;
}

/**
 * 监控历史记录接口
 */
export interface MonitorHistory {
  /** 唯一标识符 */
  id: string;
  /** 监控配置 ID */
  monitorId: string;
  /** 检查时间 */
  timestamp: Date;
  /** 监控状态 */
  status: 'success' | 'error' | 'pending';
  /** 响应时间（毫秒） */
  responseTime?: number;
  /** HTTP 状态码 */
  httpStatus?: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 监控统计数据接口
 */
export interface MonitorStats {
  /** 监控配置 ID */
  monitorId: string;
  /** 监控配置名称 */
  monitorName: string;
  /** 统计时间段 */
  period: '24h' | '7d';
  /** 数据点列表 */
  dataPoints: MonitorStatsDataPoint[];
}

/**
 * 监控统计数据点接口
 */
export interface MonitorStatsDataPoint {
  /** 时间标签 */
  label: string;
  /** 成功次数 */
  success: number;
  /** 失败次数 */
  failure: number;
  /** 成功率 */
  successRate: number;
  /** 时间戳 */
  timestamp: Date;
}

/**
 * 监控执行选项
 */
export interface MonitorExecutionOptions {
  /** 重试次数 */
  retryCount?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 是否记录历史 */
  recordHistory?: boolean;
}
