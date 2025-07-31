/**
 * CloudStudio 监控管理系统 - 优化生产版本
 * 一个具备 Web 管理界面的 Deno Deploy 兼容应用
 * 支持多站点监控配置、身份验证、数据持久化存储
 */

// ================================
// 类型定义
// ================================

interface MonitorConfig {
  id: string;
  name: string;
  url: string;
  cookie?: string;
  method: 'GET' | 'POST' | 'HEAD';
  interval: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MonitorResult {
  success: boolean;
  responseTime: number;
  httpStatus?: number;
  error?: string;
  timestamp: Date;
}

interface MonitorHistory {
  id: string;
  monitorId: string;
  result: MonitorResult;
  timestamp: Date;
}

interface Session {
  id: string;
  userId: string;
  expires: Date;
  createdAt: Date;
}

interface SystemLog {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  monitorId?: string;
  monitorName?: string;
  data?: unknown;
  timestamp: Date;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: number;
  timestamp?: string;
}

interface LoginAttempt {
  ip: string;
  timestamp: Date;
  success: boolean;
}

// ================================
// 常量定义
// ================================

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

const ERROR_CODES = {
  INVALID_PASSWORD: 1001,
  SESSION_EXPIRED: 1002,
  UNAUTHORIZED: 1003,
  MONITOR_NOT_FOUND: 2001,
  MONITOR_NAME_EXISTS: 2002,
  INVALID_URL: 2003,
  INVALID_INTERVAL: 2004,
  DATABASE_ERROR: 3001,
  NETWORK_ERROR: 3002,
  VALIDATION_ERROR: 3003,
  NOT_FOUND: 4004,
} as const;

const API_ROUTES = {
  LOGIN_PAGE: '/',
  DASHBOARD_PAGE: '/dashboard',
  LOGIN: '/api/login',
  LOGOUT: '/api/logout',
  CHECK_AUTH: '/api/auth/check',
  MONITORS_LIST: '/api/monitors',
  MONITORS_CREATE: '/api/monitors',
  MONITORS_UPDATE: '/api/monitors/:id',
  MONITORS_DELETE: '/api/monitors/:id',
  MONITORS_TOGGLE: '/api/monitors/:id/toggle',
  MONITOR_HISTORY: '/api/monitors/:id/history',
  MONITOR_STATUS: '/api/monitors/status',
  SYSTEM_INFO: '/api/system/info',
  SYSTEM_HEALTH: '/api/system/health',
} as const;

const APP_CONFIG = {
  LOGIN_PASSWORD: Deno.env.get('ADMIN_PASSWORD') || 'admin123',
  SESSION_EXPIRE_HOURS: parseInt(Deno.env.get('SESSION_EXPIRE_HOURS') || '24'),
  DEFAULT_MONITOR_INTERVAL: parseInt(Deno.env.get('DEFAULT_MONITOR_INTERVAL') || '1'),
  MAX_MONITOR_INTERVAL: parseInt(Deno.env.get('MAX_MONITOR_INTERVAL') || '60'),
  MIN_MONITOR_INTERVAL: parseInt(Deno.env.get('MIN_MONITOR_INTERVAL') || '1'),
  HISTORY_RETENTION_DAYS: parseInt(Deno.env.get('HISTORY_RETENTION_DAYS') || '30'),
  MAX_CONCURRENT_MONITORS: parseInt(Deno.env.get('MAX_CONCURRENT_MONITORS') || '10'),
  REQUEST_TIMEOUT: parseInt(Deno.env.get('REQUEST_TIMEOUT') || '30000'),
  LOGIN_LOCKOUT_MINUTES: parseInt(Deno.env.get('LOGIN_LOCKOUT_MINUTES') || '15'),
  MAX_LOGIN_ATTEMPTS: parseInt(Deno.env.get('MAX_LOGIN_ATTEMPTS') || '5'),
  IS_PRODUCTION: Deno.env.get('DENO_DEPLOYMENT_ID') !== undefined,
  LOG_LEVEL: Deno.env.get('LOG_LEVEL') || 'info',
} as const;

const KV_KEYS = {
  MONITORS: 'monitors',
  SESSIONS: 'sessions',
  HISTORY: 'history',
  SETTINGS: 'settings',
  LOGIN_ATTEMPTS: 'login_attempts',
  SYSTEM_LOGS: 'system_logs',
} as const;

// ================================
// 全局变量
// ================================

let kv: Deno.Kv;
let startTime = Date.now();

// ================================
// 工具函数
// ================================

function generateId(): string {
  return crypto.randomUUID();
}

function generateSessionId(): string {
  return crypto.randomUUID();
}

function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function validateInterval(interval: number): boolean {
  return interval >= APP_CONFIG.MIN_MONITOR_INTERVAL && 
         interval <= APP_CONFIG.MAX_MONITOR_INTERVAL;
}

function createApiResponse<T>(
  success: boolean,
  data?: T,
  message?: string,
  code?: number,
): ApiResponse<T> {
  return {
    success,
    data,
    message,
    code,
    timestamp: new Date().toISOString(),
  };
}

function createJsonResponse(data: unknown, status: number = HTTP_STATUS.OK): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function createMonitorResult(
  success: boolean,
  responseTime: number,
  httpStatus?: number,
  error?: string,
): MonitorResult {
  return {
    success,
    responseTime,
    httpStatus,
    error,
    timestamp: new Date(),
  };
}

function parseRouteParams(path: string, template: string): Record<string, string> {
  const params: Record<string, string> = {};
  const pathParts = path.split('/');
  const templateParts = template.split('/');

  for (let i = 0; i < templateParts.length; i++) {
    const templatePart = templateParts[i];
    if (templatePart.startsWith(':')) {
      const paramName = templatePart.slice(1);
      params[paramName] = pathParts[i] || '';
    }
  }

  return params;
}

function getClientIP(request: Request): string {
  return request.headers.get('x-forwarded-for') || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

function getSessionIdFromRequest(request: Request): string | null {
  const cookies = request.headers.get('cookie');
  if (!cookies) return null;

  const sessionMatch = cookies.match(/session=([^;]+)/);
  return sessionMatch ? sessionMatch[1] : null;
}

function checkCSRF(request: Request): boolean {
  const referer = request.headers.get('referer');
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  if (!referer && !origin) return false;

  const requestHost = referer ? new URL(referer).host : (origin ? new URL(origin).host : '');
  return requestHost === host;
}

// ================================
// 日志系统
// ================================

enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

async function saveSystemLog(log: Omit<SystemLog, 'id' | 'timestamp'>): Promise<void> {
  try {
    const db = await ensureKV();
    const logEntry: SystemLog = {
      ...log,
      id: generateId(),
      timestamp: new Date(),
    };

    const timeKey = logEntry.timestamp.getTime().toString().padStart(20, '0');
    const key = [KV_KEYS.SYSTEM_LOGS, timeKey, logEntry.id];
    await db.set(key, logEntry);
  } catch (error) {
    console.error('保存系统日志失败:', error);
  }
}

function log(
  level: LogLevel,
  message: string,
  monitorId?: string,
  monitorName?: string,
  data?: unknown,
): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  console.log(`${prefix} ${message}`);
  
  saveSystemLog({
    level,
    message,
    monitorId,
    monitorName,
    data,
  });
}
