/**
 * 应用配置
 */

/**
 * 应用配置
 */
export const APP_CONFIG = {
  /** 硬编码登录密码 */
  LOGIN_PASSWORD: Deno.env.get('ADMIN_PASSWORD') || 'admin123',

  /** 会话过期时间（小时） */
  SESSION_EXPIRE_HOURS: parseInt(Deno.env.get('SESSION_EXPIRE_HOURS') || '24'),

  /** 默认监控间隔（分钟） */
  DEFAULT_MONITOR_INTERVAL: parseInt(Deno.env.get('DEFAULT_MONITOR_INTERVAL') || '1'),

  /** 最大监控间隔（分钟） */
  MAX_MONITOR_INTERVAL: parseInt(Deno.env.get('MAX_MONITOR_INTERVAL') || '60'),

  /** 最小监控间隔（分钟） */
  MIN_MONITOR_INTERVAL: parseInt(Deno.env.get('MIN_MONITOR_INTERVAL') || '1'),

  /** 监控历史记录保留天数 */
  HISTORY_RETENTION_DAYS: parseInt(Deno.env.get('HISTORY_RETENTION_DAYS') || '30'),

  /** 最大并发监控数量 */
  MAX_CONCURRENT_MONITORS: parseInt(Deno.env.get('MAX_CONCURRENT_MONITORS') || '10'),

  /** 请求超时时间（毫秒） */
  REQUEST_TIMEOUT: parseInt(Deno.env.get('REQUEST_TIMEOUT') || '30000'),

  /** 登录失败锁定时间（分钟） */
  LOGIN_LOCKOUT_MINUTES: parseInt(Deno.env.get('LOGIN_LOCKOUT_MINUTES') || '15'),

  /** 最大登录尝试次数 */
  MAX_LOGIN_ATTEMPTS: parseInt(Deno.env.get('MAX_LOGIN_ATTEMPTS') || '5'),

  /** 是否为生产环境 */
  IS_PRODUCTION: Deno.env.get('DENO_DEPLOYMENT_ID') !== undefined,

  /** 日志级别 */
  LOG_LEVEL: Deno.env.get('LOG_LEVEL') || 'info',
} as const;

/**
 * HTTP 状态码
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * 错误代码
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 1001,
  AUTHENTICATION_FAILED: 1002,
  AUTHORIZATION_FAILED: 1003,
  RESOURCE_NOT_FOUND: 1004,
  RESOURCE_CONFLICT: 1005,
  DATABASE_ERROR: 2001,
  NETWORK_ERROR: 2002,
  TIMEOUT_ERROR: 2003,
  RATE_LIMIT_EXCEEDED: 3001,
  QUOTA_EXCEEDED: 3002,
  UNAUTHORIZED: 4001,
  FORBIDDEN: 4003,
  INTERNAL_ERROR: 5001,
} as const;

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}
