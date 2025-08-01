/**
 * 应用常量定义
 */

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
 * Deno KV 存储键前缀
 */
export const KV_KEYS = {
  MONITORS: 'monitors',
  SESSIONS: 'sessions',
  HISTORY: 'history',
  SETTINGS: 'settings',
  LOGIN_ATTEMPTS: 'login_attempts',
  SYSTEM_LOGS: 'system_logs',
} as const;

/**
 * 缓存键前缀
 */
export const CACHE_KEYS = {
  ALL_MONITOR_CONFIGS: 'all_monitor_configs',
  MONITOR_HISTORY: 'history',
  SYSTEM_LOGS: 'system_logs',
  MONITOR_STATS: 'monitor_stats',
} as const;

/**
 * 缓存TTL配置（毫秒）
 */
export const CACHE_TTL = {
  MONITOR_CONFIGS: 2 * 60 * 1000,    // 2分钟
  MONITOR_HISTORY: 5 * 60 * 1000,    // 5分钟
  SYSTEM_LOGS: 3 * 60 * 1000,        // 3分钟
  MONITOR_STATS: 5 * 60 * 1000,      // 5分钟
  DEFAULT: 5 * 60 * 1000,             // 默认5分钟
} as const;

/**
 * 查询限制配置
 */
export const QUERY_LIMITS = {
  MAX_HISTORY_RECORDS: 1000,
  MAX_SYSTEM_LOGS: 500,
  DEFAULT_LOG_LIMIT: 50,
  MAX_CONCURRENT_MONITORS: 10,
} as const;

/**
 * 时间间隔配置（毫秒）
 */
export const INTERVALS = {
  CACHE_CLEANUP: 10 * 60 * 1000,      // 缓存清理：10分钟
  MAINTENANCE: 60 * 60 * 1000,        // 维护任务：1小时
  DASHBOARD_REFRESH: 2 * 60 * 1000,   // 仪表板刷新：2分钟
  MONITOR_SCHEDULER: 60 * 1000,       // 监控调度：1分钟
} as const;

/**
 * 应用元数据
 */
export const APP_METADATA = {
  NAME: 'CloudStudio Monitor',
  VERSION: '1.0.0',
  DESCRIPTION: 'CloudStudio 监控管理系统',
  AUTHOR: 'CloudStudio Monitor Team',
} as const;

/**
 * 默认请求头
 */
export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
} as const;

/**
 * CORS 配置
 */
export const CORS_CONFIG = {
  ALLOWED_ORIGINS: ['*'],
  ALLOWED_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
  ALLOWED_HEADERS: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'Pragma',
  ],
  MAX_AGE: 86400, // 24小时
} as const;
