/**
 * CloudStudio 监控管理系统
 *
 * 一个具备 Web 管理界面的 Deno Deploy 兼容应用
 * 支持多站点监控配置、身份验证、数据持久化存储
 *
 * 用法:
 * deno run --allow-net --allow-kv cloudStudioRefresh.ts
 *
 * 部署到 Deno Deploy:
 * 直接上传此单文件即可部署
 */

// ================================
// 数据模型和接口定义
// ================================

/**
 * 监控配置接口
 */
interface MonitorConfig {
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
 * 会话信息接口
 */
interface Session {
  /** 会话 ID */
  id: string;
  /** 是否已认证 */
  authenticated: boolean;
  /** 过期时间 */
  expires: Date;
  /** 创建时间 */
  createdAt: Date;
  /** 最后访问时间 */
  lastAccess: Date;
}

/**
 * API 响应格式
 */
interface ApiResponse<T = any> {
  /** 是否成功 */
  success: boolean;
  /** 响应数据 */
  data?: T;
  /** 错误信息 */
  error?: string;
  /** 错误码 */
  code?: number;
  /** 时间戳 */
  timestamp: string;
}

/**
 * 监控历史记录
 */
interface MonitorHistory {
  /** 记录 ID */
  id: string;
  /** 监控配置 ID */
  monitorId: string;
  /** 执行时间 */
  timestamp: Date;
  /** 执行状态 */
  status: 'success' | 'error';
  /** 响应时间（毫秒） */
  responseTime?: number;
  /** 错误信息 */
  error?: string;
  /** HTTP 状态码 */
  httpStatus?: number;
}

/**
 * 系统日志接口
 */
interface SystemLog {
  /** 唯一标识符 */
  id: string;
  /** 日志级别 */
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  /** 日志消息 */
  message: string;
  /** 监控配置 ID（可选） */
  monitorId?: string;
  /** 监控配置名称（可选） */
  monitorName?: string;
  /** 时间戳 */
  timestamp: Date;
  /** 额外数据 */
  data?: any;
}

/**
 * 监控统计数据接口
 */
interface MonitorStats {
  /** 监控配置 ID */
  monitorId: string;
  /** 监控配置名称 */
  monitorName: string;
  /** 时间段 */
  period: '24h' | '7d';
  /** 统计数据点 */
  dataPoints: {
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
  }[];
}

/**
 * 登录请求
 */
interface LoginRequest {
  /** 密码 */
  password: string;
}

/**
 * 监控配置创建/更新请求
 */
interface MonitorConfigRequest {
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

// ================================
// API 路由规范
// ================================

/**
 * API 路由定义
 */
const API_ROUTES = {
  // 页面路由
  LOGIN_PAGE: '/',
  DASHBOARD_PAGE: '/dashboard',

  // 身份验证 API
  LOGIN: '/api/login',
  LOGOUT: '/api/logout',
  CHECK_AUTH: '/api/auth/check',

  // 监控配置 API
  MONITORS_LIST: '/api/monitors',
  MONITORS_CREATE: '/api/monitors',
  MONITORS_UPDATE: '/api/monitors/:id',
  MONITORS_DELETE: '/api/monitors/:id',
  MONITORS_TOGGLE: '/api/monitors/:id/toggle',

  // 监控历史 API
  MONITOR_HISTORY: '/api/monitors/:id/history',
  MONITOR_STATUS: '/api/monitors/status',

  // 系统 API
  SYSTEM_INFO: '/api/system/info',
  SYSTEM_HEALTH: '/api/system/health',
} as const;

/**
 * HTTP 状态码
 */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/**
 * 错误码定义
 */
const ERROR_CODES = {
  // 认证错误
  INVALID_PASSWORD: 1001,
  SESSION_EXPIRED: 1002,
  UNAUTHORIZED: 1003,

  // 监控配置错误
  MONITOR_NOT_FOUND: 2001,
  MONITOR_NAME_EXISTS: 2002,
  INVALID_URL: 2003,
  INVALID_INTERVAL: 2004,

  // 系统错误
  DATABASE_ERROR: 3001,
  NETWORK_ERROR: 3002,
  VALIDATION_ERROR: 3003,
  NOT_FOUND: 4004,
} as const;

// ================================
// 应用配置常量
// ================================

/**
 * 应用配置
 */
const APP_CONFIG = {
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
 * Deno KV 存储键前缀
 */
const KV_KEYS = {
  MONITORS: 'monitors',
  SESSIONS: 'sessions',
  HISTORY: 'history',
  SETTINGS: 'settings',
  LOGIN_ATTEMPTS: 'login_attempts',
  SYSTEM_LOGS: 'system_logs',
} as const;

/**
 * 默认请求头模板
 */
const DEFAULT_HEADERS = {
  'content-length': '0',
  'cache-control': 'max-age=0',
  'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'content-type': 'application/x-www-form-urlencoded',
  'upgrade-insecure-requests': '1',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  'accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'sec-fetch-site': 'cross-site',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-dest': 'iframe',
  'sec-fetch-storage-access': 'active',
  'accept-encoding': 'gzip, deflate, br, zstd',
  'accept-language': 'zh-CN,zh;q=0.9',
  'priority': 'u=0, i',
} as const;

// ================================
// 工具函数类型定义
// ================================

/**
 * 生成唯一 ID
 */
type GenerateId = () => string;

/**
 * 验证 URL 格式
 */
type ValidateUrl = (url: string) => boolean;

/**
 * 验证监控间隔
 */
type ValidateInterval = (interval: number) => boolean;

/**
 * 创建 API 响应
 */
type CreateApiResponse = <T>(
  success: boolean,
  data?: T,
  error?: string,
  code?: number,
) => ApiResponse<T>;

/**
 * 解析路由参数
 */
type ParseRouteParams = (path: string, pattern: string) => Record<string, string> | null;

/**
 * 格式化日期
 */
type FormatDate = (date: Date) => string;

/**
 * 验证会话是否有效
 */
type ValidateSession = (session: Session) => boolean;

// ================================
// 工具函数实现
// ================================

/**
 * 生成唯一 ID
 */
const generateId: GenerateId = (): string => {
  return crypto.randomUUID();
};

/**
 * 验证 URL 格式
 */
const validateUrl: ValidateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * 验证监控间隔
 */
const validateInterval: ValidateInterval = (interval: number): boolean => {
  return interval >= APP_CONFIG.MIN_MONITOR_INTERVAL &&
    interval <= APP_CONFIG.MAX_MONITOR_INTERVAL;
};

/**
 * 创建 API 响应
 */
const createApiResponse: CreateApiResponse = <T>(
  success: boolean,
  data?: T,
  error?: string,
  code?: number,
): ApiResponse<T> => {
  return {
    success,
    data,
    error,
    code,
    timestamp: new Date().toISOString(),
  };
};

/**
 * 解析路由参数
 */
const parseRouteParams: ParseRouteParams = (
  path: string,
  pattern: string,
): Record<string, string> | null => {
  const pathParts = path.split('/');
  const patternParts = pattern.split('/');

  if (pathParts.length !== patternParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      const paramName = patternParts[i].substring(1);
      params[paramName] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }

  return params;
};

/**
 * 格式化日期
 */
const formatDate: FormatDate = (date: Date): string => {
  return date.toISOString();
};

/**
 * 验证会话是否有效
 */
const validateSession: ValidateSession = (session: Session): boolean => {
  return session.authenticated && session.expires > new Date();
};

/**
 * 合并请求头
 */
const mergeHeaders = (
  defaultHeaders: Record<string, string>,
  customHeaders?: Record<string, string>,
): Record<string, string> => {
  return { ...defaultHeaders, ...customHeaders };
};

/**
 * 创建监控结果
 */
interface MonitorResult {
  success: boolean;
  status?: 'success' | 'error';
  responseTime?: number;
  httpStatus?: number;
  error?: string;
  timestamp: Date;
}

const createMonitorResult = (
  success: boolean,
  responseTime?: number,
  httpStatus?: number,
  error?: string,
): MonitorResult => {
  return {
    success,
    status: success ? 'success' : 'error',
    responseTime,
    httpStatus,
    error,
    timestamp: new Date(),
  };
};

// ================================
// 系统日志存储操作
// ================================

/**
 * 保存系统日志
 * @param logEntry 日志条目
 * @returns 是否成功
 */
async function saveSystemLog(logEntry: SystemLog): Promise<boolean> {
  try {
    const db = await ensureKV();

    // 使用时间戳作为排序键，便于按时间查询
    const timeKey = logEntry.timestamp.getTime().toString().padStart(20, '0');
    const key = [KV_KEYS.SYSTEM_LOGS, timeKey, logEntry.id];

    const result = await db.set(key, logEntry);
    return result.ok;
  } catch (error) {
    console.error('保存系统日志失败:', error);
    return false;
  }
}

/**
 * 获取系统日志
 * @param options 查询选项
 * @returns 日志列表
 */
async function getSystemLogs(options: {
  level?: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  monitorId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: SystemLog[]; total: number }> {
  try {
    const db = await ensureKV();
    const logs: SystemLog[] = [];
    let count = 0;

    const iter = db.list<SystemLog>({
      prefix: [KV_KEYS.SYSTEM_LOGS],
    }, {
      reverse: true, // 最新的在前
    });

    for await (const entry of iter) {
      if (entry.value) {
        const log = entry.value;
        log.timestamp = new Date(log.timestamp);

        // 应用过滤条件
        if (options.level && log.level !== options.level) {
          continue;
        }

        if (options.monitorId && log.monitorId !== options.monitorId) {
          continue;
        }

        count++;

        // 应用分页
        if (options.offset && count <= options.offset) {
          continue;
        }

        logs.push(log);

        // 应用限制
        if (options.limit && logs.length >= options.limit) {
          break;
        }
      }
    }

    return { logs, total: count };
  } catch (error) {
    console.error('获取系统日志失败:', error);
    return { logs: [], total: 0 };
  }
}

/**
 * 清理过期系统日志
 * @returns 清理的日志数量
 */
async function cleanupOldSystemLogs(): Promise<number> {
  try {
    const db = await ensureKV();
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 保留7天
    let cleanedCount = 0;

    const iter = db.list<SystemLog>({ prefix: [KV_KEYS.SYSTEM_LOGS] });

    for await (const entry of iter) {
      if (entry.value) {
        const log = entry.value;
        log.timestamp = new Date(log.timestamp);

        if (log.timestamp < cutoffDate) {
          await db.delete(entry.key);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`✅ 已清理 ${cleanedCount} 条过期系统日志`);
    }

    return cleanedCount;
  } catch (error) {
    console.error('清理过期系统日志失败:', error);
    return 0;
  }
}

// ================================
// 监控执行函数
// ================================

/**
 * 执行监控任务
 * @param config 监控配置
 * @param retryCount 重试次数
 * @returns 监控结果
 */
async function executeMonitor(
  config: MonitorConfig,
  retryCount: number = 0,
): Promise<MonitorResult> {
  const startTime = Date.now();

  try {
    log(LogLevel.INFO, `开始监控: ${config.name} (${config.url})`, config.id, config.name);

    // 验证配置
    if (!validateUrl(config.url)) {
      throw new Error(`无效的 URL: ${config.url}`);
    }

    // 构建请求头
    const requestHeaders = mergeHeaders(DEFAULT_HEADERS, config.headers);

    // 添加 Cookie
    if (config.cookie) {
      requestHeaders['Cookie'] = config.cookie;
    }

    // 设置 origin 和 referer
    try {
      const urlObj = new URL(config.url);
      requestHeaders['origin'] = `${urlObj.protocol}//${urlObj.host}`;
      requestHeaders['referer'] = `${urlObj.protocol}//${urlObj.host}/`;
    } catch {
      // 如果 URL 解析失败，使用默认值
    }

    const headers = new Headers();
    Object.entries(requestHeaders).forEach(([key, value]) => {
      headers.append(key, value);
    });

    console.log(`正在发送请求到: ${config.url}`);
    console.log(`请求头数量: ${Object.keys(requestHeaders).length}`);

    // 发送请求
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), APP_CONFIG.REQUEST_TIMEOUT);

    // 确定请求方法
    const method = config.method || 'GET'; // 默认使用 GET 方法

    const response = await fetch(config.url, {
      headers: headers,
      method: method,
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    console.log(`响应状态: ${response.status} ${response.statusText}`);
    console.log(`响应时间: ${responseTime}ms`);
    console.log(`响应 URL (重定向后): ${response.url}`);

    if (response.ok) {
      const text = await response.text();
      console.log(`响应内容长度: ${text.length} 字符`);

      // 检查响应是否符合预期
      const isSuccess = checkResponseSuccess(response, text, config);

      if (isSuccess) {
        log(LogLevel.INFO, `监控成功: ${config.name} (${responseTime}ms)`, config.id, config.name, {
          responseTime,
          httpStatus: response.status,
          url: config.url,
        });
        const result = createMonitorResult(true, responseTime, response.status);

        // 保存历史记录
        await saveMonitorHistoryRecord(config.id, result);

        return result;
      } else {
        log(
          LogLevel.WARN,
          `监控警告: ${config.name} - 响应不符合预期 (${responseTime}ms)`,
          config.id,
          config.name,
          {
            responseTime,
            httpStatus: response.status,
            url: config.url,
            error: '响应不符合预期',
          },
        );
        const result = createMonitorResult(false, responseTime, response.status, '响应不符合预期');

        // 保存历史记录
        await saveMonitorHistoryRecord(config.id, result);

        return result;
      }
    } else {
      const errorText = await response.text();
      const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      log(LogLevel.ERROR, `监控失败: ${config.name} - ${errorMsg}`, config.id, config.name, {
        responseTime,
        httpStatus: response.status,
        url: config.url,
        error: errorMsg,
        responseBody: errorText.substring(0, 500),
      });

      const result = createMonitorResult(false, responseTime, response.status, errorMsg);

      // 保存历史记录
      await saveMonitorHistoryRecord(config.id, result);

      return result;
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    console.error(`❌ 监控异常: ${config.name} - ${errorMsg}`);

    // 重试机制
    if (retryCount < 2 && !errorMsg.includes('AbortError')) {
      console.log(`🔄 重试监控: ${config.name} (第 ${retryCount + 1} 次重试)`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1))); // 递增延迟
      return executeMonitor(config, retryCount + 1);
    }

    console.error(`💥 监控最终失败: ${config.name} - ${errorMsg}\n`);
    const result = createMonitorResult(false, responseTime, undefined, errorMsg);

    // 保存历史记录
    await saveMonitorHistoryRecord(config.id, result);

    return result;
  }
}

/**
 * 检查响应是否成功
 * @param response HTTP 响应
 * @param text 响应文本
 * @param config 监控配置
 * @returns 是否成功
 */
function checkResponseSuccess(response: Response, text: string, config: MonitorConfig): boolean {
  // 基本检查：HTTP 状态码是否正常
  if (!response.ok) {
    return false;
  }

  // 检查重定向 URL（针对 CloudStudio 的特殊逻辑）
  if (config.url.includes('cloudstudio.net')) {
    return response.url.includes('cloudstudio.net') ||
      response.url.includes('cloudstudio.club');
  }

  // 检查响应内容长度
  if (text.length === 0) {
    return false;
  }

  // 默认认为成功
  return true;
}

/**
 * 保存监控历史记录的辅助函数
 * @param monitorId 监控配置 ID
 * @param result 监控结果
 */
async function saveMonitorHistoryRecord(monitorId: string, result: MonitorResult): Promise<void> {
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

    await saveMonitorHistory(history);
  } catch (error) {
    console.error(`❌ 保存监控历史记录失败 (${monitorId}):`, error);
  }
}

// 从 CloudStudio 获取数据的函数（兼容性保留）
async function fetchCloudStudio(): Promise<void> {
  try {
    console.log(
      `[${new Date().toISOString()}] 正在访问 https://cloudstudio.net/a/26783234094321664/edit...`,
    );

    const headers = new Headers();
    headers.append('content-length', '0');
    headers.append('cache-control', 'max-age=0');
    headers.append(
      'sec-ch-ua',
      '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
    );
    headers.append('sec-ch-ua-mobile', '?0');
    headers.append('sec-ch-ua-platform', '"Windows"');
    headers.append('origin', 'https://cloudstudio.net');
    headers.append('content-type', 'application/x-www-form-urlencoded');
    headers.append('upgrade-insecure-requests', '1');
    headers.append(
      'user-agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    );
    headers.append(
      'accept',
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    );
    headers.append('sec-fetch-site', 'cross-site');
    headers.append('sec-fetch-mode', 'navigate');
    headers.append('sec-fetch-dest', 'iframe');
    headers.append('sec-fetch-storage-access', 'active');
    headers.append('referer', 'https://cloudstudio.net/');
    headers.append('accept-encoding', 'gzip, deflate, br, zstd');
    headers.append('accept-language', 'zh-CN,zh;q=0.9');
    headers.append('priority', 'u=0, i');
    headers.append('Cookie', 'cloudstudio-editor-session=your cookie');

    console.log(`正在发送的请求头:`);
    for (const [key, value] of headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }

    const response = await fetch('your url', {
      headers: headers,
      method: 'POST',
      // Deno 的 fetch 默认会跟随重定向。
      // redirect: 'follow' // 默认行为
    });

    console.log(`响应状态: ${response.status} ${response.statusText}`);
    console.log(`响应 URL (重定向后): ${response.url}`);
    console.log(`响应头: ${JSON.stringify(Object.fromEntries(response.headers), null, 2)}`);

    if (response.ok) {
      const text = await response.text();
      console.log(`内容长度: ${text.length} 字符`);
      // console.log(`响应的前 1000 个字符: ${text.substring(0, 1000)}...`);

      // 检查响应 URL 是否是你期望的成功“跳转”后的 URL
      if (
        response.url === 'https://cloudstudio.net/a/26783234094321664/edit' ||
        response.url.startsWith(
          'https://abf1d6edc1f14b6d971f48cca243e1fb.ap-shanghai.cloudstudio.club',
        )
      ) {
        // 或者最终的目标 URL 应该是什么
        console.log('请求成功，并且似乎已到达目标页面或相关资源。\n');
      } else {
        console.log('请求成功，但最终 URL 与预期不同。请检查重定向。\n');
      }
    } else {
      const errorText = await response.text();
      console.error(`错误: ${response.status} ${response.statusText}`);
      console.error(`错误响应体 (前 500 字符): ${errorText.substring(0, 500)}\n`);
    }
  } catch (error) {
    console.error(`发生异常: ${(error as Error).message}\n`);
    fetchCloudStudio();
  }
}

/**
 * 批量执行监控任务
 * @param configs 监控配置列表
 * @returns 监控结果列表
 */
async function executeMonitors(configs: MonitorConfig[]): Promise<MonitorResult[]> {
  const enabledConfigs = configs.filter((config) => config.enabled);

  if (enabledConfigs.length === 0) {
    console.log('没有启用的监控配置');
    return [];
  }

  console.log(`开始执行 ${enabledConfigs.length} 个监控任务`);

  // 限制并发数量
  const maxConcurrent = Math.min(enabledConfigs.length, APP_CONFIG.MAX_CONCURRENT_MONITORS);
  const results: MonitorResult[] = [];

  for (let i = 0; i < enabledConfigs.length; i += maxConcurrent) {
    const batch = enabledConfigs.slice(i, i + maxConcurrent);
    const batchPromises = batch.map((config) => executeMonitor(config));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // 批次间延迟，避免过于频繁的请求
    if (i + maxConcurrent < enabledConfigs.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  console.log(`监控任务完成: 成功 ${successCount} 个，失败 ${failureCount} 个`);

  return results;
}

// ================================
// Deno KV 数据存储层
// ================================

/**
 * KV 数据库实例
 */
let kv: Deno.Kv;

/**
 * 初始化 KV 数据库连接
 */
async function initKV(): Promise<void> {
  try {
    kv = await Deno.openKv();
    console.log('✅ Deno KV 数据库连接成功');
  } catch (error) {
    console.error('❌ Deno KV 数据库连接失败:', error);
    throw error;
  }
}

/**
 * 确保 KV 数据库已初始化
 */
async function ensureKV(): Promise<Deno.Kv> {
  if (!kv) {
    await initKV();
  }
  return kv;
}

// ================================
// 监控配置存储操作
// ================================

/**
 * 保存监控配置
 * @param config 监控配置
 * @returns 是否成功
 */
async function saveMonitorConfig(config: MonitorConfig): Promise<boolean> {
  try {
    const db = await ensureKV();

    // 验证配置
    if (!config.id || !config.name || !config.url) {
      throw new Error('监控配置缺少必要字段');
    }

    if (!validateUrl(config.url)) {
      throw new Error('无效的 URL');
    }

    if (!validateInterval(config.interval)) {
      throw new Error('无效的监控间隔');
    }

    // 更新时间戳
    config.updatedAt = new Date();

    // 保存到 KV 存储
    const key = [KV_KEYS.MONITORS, config.id];
    const result = await db.set(key, config);

    if (result.ok) {
      console.log(`✅ 监控配置已保存: ${config.name} (${config.id})`);
      return true;
    } else {
      console.error(`❌ 监控配置保存失败: ${config.name}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ 保存监控配置时发生错误:`, error);
    return false;
  }
}

/**
 * 获取监控配置
 * @param id 配置 ID
 * @returns 监控配置或 null
 */
async function getMonitorConfig(id: string): Promise<MonitorConfig | null> {
  try {
    const db = await ensureKV();
    const key = [KV_KEYS.MONITORS, id];
    const result = await db.get<MonitorConfig>(key);

    if (result.value) {
      // 确保日期字段正确反序列化
      const config = result.value;
      config.createdAt = new Date(config.createdAt);
      config.updatedAt = new Date(config.updatedAt);
      if (config.lastCheck) {
        config.lastCheck = new Date(config.lastCheck);
      }
      return config;
    }

    return null;
  } catch (error) {
    console.error(`❌ 获取监控配置时发生错误 (${id}):`, error);
    return null;
  }
}

/**
 * 获取所有监控配置
 * @returns 监控配置列表
 */
async function getAllMonitorConfigs(): Promise<MonitorConfig[]> {
  try {
    const db = await ensureKV();
    const configs: MonitorConfig[] = [];

    // 遍历所有监控配置
    const iter = db.list<MonitorConfig>({ prefix: [KV_KEYS.MONITORS] });

    for await (const entry of iter) {
      if (entry.value) {
        // 确保日期字段正确反序列化
        const config = entry.value;
        config.createdAt = new Date(config.createdAt);
        config.updatedAt = new Date(config.updatedAt);
        if (config.lastCheck) {
          config.lastCheck = new Date(config.lastCheck);
        }
        configs.push(config);
      }
    }

    // 按创建时间排序
    configs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return configs;
  } catch (error) {
    console.error(`❌ 获取所有监控配置时发生错误:`, error);
    return [];
  }
}

/**
 * 删除监控配置
 * @param id 配置 ID
 * @returns 是否成功
 */
async function deleteMonitorConfig(id: string): Promise<boolean> {
  try {
    const db = await ensureKV();

    // 检查配置是否存在
    const existing = await getMonitorConfig(id);
    if (!existing) {
      console.warn(`⚠️ 监控配置不存在: ${id}`);
      return false;
    }

    // 删除配置
    const key = [KV_KEYS.MONITORS, id];
    await db.delete(key);

    // 同时删除相关的历史记录
    await deleteMonitorHistory(id);

    console.log(`✅ 监控配置已删除: ${existing.name} (${id})`);
    return true;
  } catch (error) {
    console.error(`❌ 删除监控配置时发生错误 (${id}):`, error);
    return false;
  }
}

// ================================
// 会话管理存储操作
// ================================

/**
 * 创建会话
 * @param sessionId 会话 ID
 * @returns 会话对象或 null
 */
async function createSession(sessionId: string): Promise<Session | null> {
  try {
    const db = await ensureKV();

    const session: Session = {
      id: sessionId,
      authenticated: true,
      expires: new Date(Date.now() + APP_CONFIG.SESSION_EXPIRE_HOURS * 60 * 60 * 1000),
      createdAt: new Date(),
      lastAccess: new Date(),
    };

    const key = [KV_KEYS.SESSIONS, sessionId];
    const result = await db.set(key, session);

    if (result.ok) {
      console.log(`✅ 会话已创建: ${sessionId}`);
      return session;
    } else {
      console.error(`❌ 会话创建失败: ${sessionId}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ 创建会话时发生错误 (${sessionId}):`, error);
    return null;
  }
}

/**
 * 获取会话
 * @param sessionId 会话 ID
 * @returns 会话对象或 null
 */
async function getSession(sessionId: string): Promise<Session | null> {
  try {
    const db = await ensureKV();
    const key = [KV_KEYS.SESSIONS, sessionId];
    const result = await db.get<Session>(key);

    if (result.value) {
      // 确保日期字段正确反序列化
      const session = result.value;
      session.expires = new Date(session.expires);
      session.createdAt = new Date(session.createdAt);
      session.lastAccess = new Date(session.lastAccess);

      // 检查会话是否过期
      if (session.expires < new Date()) {
        await deleteSession(sessionId);
        return null;
      }

      // 更新最后访问时间
      session.lastAccess = new Date();
      await db.set(key, session);

      return session;
    }

    return null;
  } catch (error) {
    console.error(`❌ 获取会话时发生错误 (${sessionId}):`, error);
    return null;
  }
}

/**
 * 删除会话
 * @param sessionId 会话 ID
 * @returns 是否成功
 */
async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    const db = await ensureKV();
    const key = [KV_KEYS.SESSIONS, sessionId];
    await db.delete(key);

    console.log(`✅ 会话已删除: ${sessionId}`);
    return true;
  } catch (error) {
    console.error(`❌ 删除会话时发生错误 (${sessionId}):`, error);
    return false;
  }
}

/**
 * 清理过期会话
 * @returns 清理的会话数量
 */
async function cleanupExpiredSessions(): Promise<number> {
  try {
    const db = await ensureKV();
    let cleanedCount = 0;

    const iter = db.list<Session>({ prefix: [KV_KEYS.SESSIONS] });

    for await (const entry of iter) {
      if (entry.value) {
        const session = entry.value;
        session.expires = new Date(session.expires);

        if (session.expires < new Date()) {
          await db.delete(entry.key);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`✅ 已清理 ${cleanedCount} 个过期会话`);
    }

    return cleanedCount;
  } catch (error) {
    console.error(`❌ 清理过期会话时发生错误:`, error);
    return 0;
  }
}

// ================================
// 监控历史记录存储操作
// ================================

/**
 * 保存监控历史记录
 * @param history 监控历史记录
 * @returns 是否成功
 */
async function saveMonitorHistory(history: MonitorHistory): Promise<boolean> {
  try {
    const db = await ensureKV();

    if (!history.id) {
      history.id = generateId();
    }

    const key = [KV_KEYS.HISTORY, history.monitorId, history.id];
    const result = await db.set(key, history);

    if (result.ok) {
      return true;
    } else {
      console.error(`❌ 监控历史记录保存失败: ${history.monitorId}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ 保存监控历史记录时发生错误:`, error);
    return false;
  }
}

/**
 * 获取监控历史记录
 * @param monitorId 监控配置 ID
 * @param limit 限制数量
 * @returns 历史记录列表
 */
async function getMonitorHistory(
  monitorId: string,
  limit: number = 100,
): Promise<MonitorHistory[]> {
  try {
    const db = await ensureKV();
    const histories: MonitorHistory[] = [];

    const iter = db.list<MonitorHistory>({
      prefix: [KV_KEYS.HISTORY, monitorId],
    }, {
      limit,
      reverse: true, // 最新的记录在前
    });

    for await (const entry of iter) {
      if (entry.value) {
        const history = entry.value;
        history.timestamp = new Date(history.timestamp);
        histories.push(history);
      }
    }

    return histories;
  } catch (error) {
    console.error(`❌ 获取监控历史记录时发生错误 (${monitorId}):`, error);
    return [];
  }
}

/**
 * 删除监控历史记录
 * @param monitorId 监控配置 ID
 * @returns 删除的记录数量
 */
async function deleteMonitorHistory(monitorId: string): Promise<number> {
  try {
    const db = await ensureKV();
    let deletedCount = 0;

    const iter = db.list({ prefix: [KV_KEYS.HISTORY, monitorId] });

    for await (const entry of iter) {
      await db.delete(entry.key);
      deletedCount++;
    }

    if (deletedCount > 0) {
      console.log(`✅ 已删除 ${deletedCount} 条监控历史记录 (${monitorId})`);
    }

    return deletedCount;
  } catch (error) {
    console.error(`❌ 删除监控历史记录时发生错误 (${monitorId}):`, error);
    return 0;
  }
}

/**
 * 清理过期的监控历史记录
 * @returns 清理的记录数量
 */
async function cleanupOldHistory(): Promise<number> {
  try {
    const db = await ensureKV();
    const cutoffDate = new Date(
      Date.now() - APP_CONFIG.HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    let cleanedCount = 0;

    const iter = db.list<MonitorHistory>({ prefix: [KV_KEYS.HISTORY] });

    for await (const entry of iter) {
      if (entry.value) {
        const history = entry.value;
        history.timestamp = new Date(history.timestamp);

        if (history.timestamp < cutoffDate) {
          await db.delete(entry.key);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`✅ 已清理 ${cleanedCount} 条过期监控历史记录`);
    }

    return cleanedCount;
  } catch (error) {
    console.error(`❌ 清理过期监控历史记录时发生错误:`, error);
    return 0;
  }
}

// ================================
// 数据迁移和初始化
// ================================

/**
 * 初始化默认监控配置
 */
async function initializeDefaultConfig(): Promise<void> {
  try {
    const existingConfigs = await getAllMonitorConfigs();

    if (existingConfigs.length === 0) {
      console.log('🔄 初始化默认监控配置...');

      const defaultConfig: MonitorConfig = {
        id: 'default-cloudstudio',
        name: 'CloudStudio 默认监控',
        url: 'https://cloudstudio.net/a/26783234094321664/edit',
        cookie: 'cloudstudio-editor-session=your cookie',
        method: 'POST',
        interval: 1,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const success = await saveMonitorConfig(defaultConfig);
      if (success) {
        console.log('✅ 默认监控配置已创建');
      } else {
        console.error('❌ 默认监控配置创建失败');
      }
    }
  } catch (error) {
    console.error('❌ 初始化默认配置时发生错误:', error);
  }
}

/**
 * 定期清理任务
 */
async function performMaintenance(): Promise<void> {
  try {
    console.log('🧹 开始执行数据库维护任务...');

    const [expiredSessions, oldHistory, oldLogs] = await Promise.all([
      cleanupExpiredSessions(),
      cleanupOldHistory(),
      cleanupOldSystemLogs(),
    ]);

    console.log(
      `✅ 维护任务完成: 清理了 ${expiredSessions} 个过期会话, ${oldHistory} 条过期历史记录, ${oldLogs} 条过期系统日志`,
    );
  } catch (error) {
    console.error('❌ 执行维护任务时发生错误:', error);
  }
}

// ================================
// 身份验证和会话管理
// ================================

/**
 * 登录尝试记录
 */
interface LoginAttempt {
  ip: string;
  timestamp: Date;
  success: boolean;
}

/**
 * 验证登录凭据
 * @param password 密码
 * @returns 是否验证成功
 */
function validateCredentials(password: string): boolean {
  return password === APP_CONFIG.LOGIN_PASSWORD;
}

/**
 * 生成会话 ID
 * @returns 会话 ID
 */
function generateSessionId(): string {
  return generateId();
}

/**
 * 创建认证会话
 * @param sessionId 会话 ID
 * @returns 会话对象或 null
 */
async function createAuthSession(sessionId: string): Promise<Session | null> {
  return await createSession(sessionId);
}

/**
 * 检查登录频率限制
 * @param ip IP 地址
 * @returns 是否允许登录
 */
async function checkLoginRateLimit(ip: string): Promise<boolean> {
  try {
    const db = await ensureKV();
    const now = new Date();
    const lockoutTime = new Date(now.getTime() - APP_CONFIG.LOGIN_LOCKOUT_MINUTES * 60 * 1000);

    // 获取最近的登录尝试记录
    const attempts: LoginAttempt[] = [];
    const iter = db.list<LoginAttempt>({ prefix: [KV_KEYS.LOGIN_ATTEMPTS, ip] });

    for await (const entry of iter) {
      if (entry.value) {
        const attempt = entry.value;
        attempt.timestamp = new Date(attempt.timestamp);

        // 只考虑锁定时间内的尝试
        if (attempt.timestamp > lockoutTime) {
          attempts.push(attempt);
        }
      }
    }

    // 检查失败次数
    const failedAttempts = attempts.filter((a) => !a.success);

    if (failedAttempts.length >= APP_CONFIG.MAX_LOGIN_ATTEMPTS) {
      console.warn(`⚠️ IP ${ip} 登录尝试次数过多，已被锁定`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`❌ 检查登录频率限制时发生错误:`, error);
    return true; // 出错时允许登录，避免误伤
  }
}

/**
 * 记录登录尝试
 * @param ip IP 地址
 * @param success 是否成功
 */
async function recordLoginAttempt(ip: string, success: boolean): Promise<void> {
  try {
    const db = await ensureKV();
    const attempt: LoginAttempt = {
      ip,
      timestamp: new Date(),
      success,
    };

    const key = [KV_KEYS.LOGIN_ATTEMPTS, ip, generateId()];
    await db.set(key, attempt);

    // 清理旧的登录尝试记录（保留最近 24 小时）
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const iter = db.list<LoginAttempt>({ prefix: [KV_KEYS.LOGIN_ATTEMPTS, ip] });

    for await (const entry of iter) {
      if (entry.value) {
        const oldAttempt = entry.value;
        oldAttempt.timestamp = new Date(oldAttempt.timestamp);

        if (oldAttempt.timestamp < cutoffTime) {
          await db.delete(entry.key);
        }
      }
    }
  } catch (error) {
    console.error(`❌ 记录登录尝试时发生错误:`, error);
  }
}

/**
 * 处理用户登录
 * @param password 密码
 * @param ip IP 地址
 * @returns 登录结果
 */
async function handleLogin(password: string, ip: string): Promise<{
  success: boolean;
  sessionId?: string;
  error?: string;
}> {
  try {
    // 检查登录频率限制
    const rateLimitOk = await checkLoginRateLimit(ip);
    if (!rateLimitOk) {
      await recordLoginAttempt(ip, false);
      return {
        success: false,
        error: `登录尝试次数过多，请 ${APP_CONFIG.LOGIN_LOCKOUT_MINUTES} 分钟后再试`,
      };
    }

    // 验证密码
    const isValid = validateCredentials(password);

    if (isValid) {
      // 创建会话
      const sessionId = generateSessionId();
      const session = await createAuthSession(sessionId);

      if (session) {
        await recordLoginAttempt(ip, true);
        console.log(`✅ 用户登录成功 (IP: ${ip}, Session: ${sessionId})`);

        return {
          success: true,
          sessionId,
        };
      } else {
        await recordLoginAttempt(ip, false);
        return {
          success: false,
          error: '会话创建失败',
        };
      }
    } else {
      await recordLoginAttempt(ip, false);
      console.warn(`⚠️ 用户登录失败 - 密码错误 (IP: ${ip})`);

      return {
        success: false,
        error: '密码错误',
      };
    }
  } catch (error) {
    console.error(`❌ 处理登录时发生错误:`, error);
    return {
      success: false,
      error: '登录处理失败',
    };
  }
}

// 会话中间件和认证检查
// ================================

/**
 * 从请求中提取会话 ID
 * @param request HTTP 请求
 * @returns 会话 ID 或 null
 */
function extractSessionId(request: Request): string | null {
  try {
    // 从 Cookie 中提取会话 ID
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) {
      return null;
    }

    const cookies = cookieHeader.split(';').map((c) => c.trim());
    const sessionCookie = cookies.find((c) => c.startsWith('sessionId='));

    if (sessionCookie) {
      return sessionCookie.split('=')[1];
    }

    return null;
  } catch (error) {
    console.error(`❌ 提取会话 ID 时发生错误:`, error);
    return null;
  }
}

/**
 * 获取客户端 IP 地址
 * @param request HTTP 请求
 * @returns IP 地址
 */
function getClientIP(request: Request): string {
  // 尝试从各种头部获取真实 IP
  const forwardedFor = request.headers.get('X-Forwarded-For');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = request.headers.get('X-Real-IP');
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = request.headers.get('CF-Connecting-IP');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // 默认返回未知 IP
  return 'unknown';
}

/**
 * 认证中间件结果
 */
interface AuthResult {
  authenticated: boolean;
  session?: Session;
  error?: string;
}

/**
 * 认证中间件
 * @param request HTTP 请求
 * @returns 认证结果
 */
async function requireAuth(request: Request): Promise<AuthResult> {
  try {
    const sessionId = extractSessionId(request);

    if (!sessionId) {
      return {
        authenticated: false,
        error: '未找到会话信息',
      };
    }

    const session = await getSession(sessionId);

    if (!session) {
      return {
        authenticated: false,
        error: '会话无效或已过期',
      };
    }

    if (!validateSession(session)) {
      await deleteSession(sessionId);
      return {
        authenticated: false,
        error: '会话已过期',
      };
    }

    return {
      authenticated: true,
      session,
    };
  } catch (error) {
    console.error(`❌ 认证检查时发生错误:`, error);
    return {
      authenticated: false,
      error: '认证检查失败',
    };
  }
}

/**
 * 处理用户登出
 * @param request HTTP 请求
 * @returns 是否成功
 */
async function handleLogout(request: Request): Promise<boolean> {
  try {
    const sessionId = extractSessionId(request);

    if (sessionId) {
      const success = await deleteSession(sessionId);
      if (success) {
        console.log(`✅ 用户登出成功 (Session: ${sessionId})`);
      }
      return success;
    }

    return true; // 没有会话也算成功
  } catch (error) {
    console.error(`❌ 处理登出时发生错误:`, error);
    return false;
  }
}

/**
 * 创建会话 Cookie
 * @param sessionId 会话 ID
 * @returns Cookie 字符串
 */
function createSessionCookie(sessionId: string): string {
  const maxAge = APP_CONFIG.SESSION_EXPIRE_HOURS * 60 * 60; // 秒
  return `sessionId=${sessionId}; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}; Path=/`;
}

/**
 * 创建清除 Cookie
 * @returns Cookie 字符串
 */
function createClearCookie(): string {
  return 'sessionId=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/';
}

/**
 * 简单的 CSRF 防护
 * @param request HTTP 请求
 * @returns 是否通过 CSRF 检查
 */
function checkCSRF(request: Request): boolean {
  // 对于 POST、PUT、DELETE 请求，检查 Referer 头
  const method = request.method;
  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    const referer = request.headers.get('Referer');
    const origin = request.headers.get('Origin');
    const host = request.headers.get('Host');

    if (!referer && !origin) {
      return false;
    }

    // 检查 Referer 或 Origin 是否来自同一域名
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        if (refererUrl.host !== host) {
          return false;
        }
      } catch {
        return false;
      }
    }

    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.host !== host) {
          return false;
        }
      } catch {
        return false;
      }
    }
  }

  return true;
}

// ================================
// HTTP 服务器和路由处理
// ================================

/**
 * 路由匹配结果
 */
interface RouteMatch {
  matched: boolean;
  params?: Record<string, string>;
  handler?: (request: Request, params?: Record<string, string>) => Promise<Response>;
}

/**
 * 解析请求路径和方法
 * @param request HTTP 请求
 * @returns 路径和方法信息
 */
function parseRequest(request: Request): { path: string; method: string; url: URL } {
  const url = new URL(request.url);
  return {
    path: url.pathname,
    method: request.method,
    url,
  };
}

/**
 * 创建 JSON 响应
 * @param data 响应数据
 * @param status HTTP 状态码
 * @param headers 额外的响应头
 * @returns Response 对象
 */
function createJsonResponse(
  data: any,
  status: number = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...headers,
    },
  });
}

/**
 * 创建 HTML 响应
 * @param html HTML 内容
 * @param status HTTP 状态码
 * @param headers 额外的响应头
 * @returns Response 对象
 */
function createHtmlResponse(
  html: string,
  status: number = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
      ...headers,
    },
  });
}

/**
 * 创建重定向响应
 * @param location 重定向地址
 * @param status HTTP 状态码
 * @returns Response 对象
 */
function createRedirectResponse(location: string, status: number = 302): Response {
  return new Response(null, {
    status,
    headers: {
      'Location': location,
    },
  });
}

/**
 * 处理 CORS 预检请求
 * @param request HTTP 请求
 * @returns Response 对象
 */
function handleCORS(request: Request): Response {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * 日志级别枚举
 */
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * 获取当前日志级别
 */
function getCurrentLogLevel(): LogLevel {
  switch (APP_CONFIG.LOG_LEVEL.toLowerCase()) {
    case 'debug':
      return LogLevel.DEBUG;
    case 'info':
      return LogLevel.INFO;
    case 'warn':
      return LogLevel.WARN;
    case 'error':
      return LogLevel.ERROR;
    default:
      return LogLevel.INFO;
  }
}

/**
 * 条件日志输出并存储到系统日志
 */
function log(
  level: LogLevel,
  message: string,
  monitorId?: string,
  monitorName?: string,
  data?: any,
): void {
  if (level >= getCurrentLogLevel()) {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    console.log(`[${timestamp}] [${levelName}] ${message}`);

    // 存储到系统日志（异步，不阻塞主流程）
    saveSystemLog({
      id: generateId(),
      level: levelName as 'INFO' | 'WARN' | 'ERROR' | 'DEBUG',
      message,
      monitorId,
      monitorName,
      timestamp: new Date(),
      data,
    }).catch((error) => {
      console.error('保存系统日志失败:', error);
    });
  }
}

/**
 * 日志记录中间件
 * @param request HTTP 请求
 * @param response HTTP 响应
 * @param startTime 开始时间
 */
function logRequest(request: Request, response: Response, startTime: number): void {
  const { path, method } = parseRequest(request);
  const duration = Date.now() - startTime;
  const ip = getClientIP(request);

  // 在生产环境中减少日志输出
  if (APP_CONFIG.IS_PRODUCTION && path.startsWith('/api/')) {
    // 只记录错误和重要操作
    if (response.status >= 400 || method !== 'GET') {
      log(LogLevel.INFO, `${method} ${path} - ${response.status} - ${duration}ms - ${ip}`);
    }
  } else {
    log(LogLevel.DEBUG, `${method} ${path} - ${response.status} - ${duration}ms - ${ip}`);
  }
}

/**
 * 错误处理中间件
 * @param error 错误对象
 * @param request HTTP 请求
 * @returns Response 对象
 */
function handleError(error: Error, request: Request): Response {
  const { path, method } = parseRequest(request);
  const ip = getClientIP(request);

  console.error(`❌ ${method} ${path} - Error: ${error.message} - IP: ${ip}`);
  console.error(error.stack);

  return createJsonResponse(
    createApiResponse(false, null, '服务器内部错误', ERROR_CODES.NETWORK_ERROR),
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
  );
}

// ================================
// 路由处理器
// ================================

/**
 * 处理登录页面
 * @param request HTTP 请求
 * @returns Response 对象
 */
async function handleLoginPage(request: Request): Promise<Response> {
  // 检查是否已经登录
  const authResult = await requireAuth(request);
  if (authResult.authenticated) {
    return createRedirectResponse('/dashboard');
  }

  // 返回登录页面 HTML
  const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>CloudStudio 监控管理系统 - 登录</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
        .login-container{background:white;border-radius:12px;box-shadow:0 20px 40px rgba(0,0,0,0.1);padding:40px;width:100%;max-width:400px;text-align:center}
        .logo{font-size:2.5rem;color:#667eea;margin-bottom:10px;font-weight:bold}
        .subtitle{color:#666;margin-bottom:30px;font-size:1.1rem}
        .form-group{margin-bottom:20px;text-align:left}
        .form-label{display:block;margin-bottom:8px;color:#333;font-weight:500}
        .form-input{width:100%;padding:12px 16px;border:2px solid #e1e5e9;border-radius:8px;font-size:16px;transition:border-color 0.3s ease}
        .form-input:focus{outline:none;border-color:#667eea;box-shadow:0 0 0 3px rgba(102,126,234,0.1)}
        .login-btn{width:100%;padding:14px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;transition:transform 0.2s ease,box-shadow 0.2s ease}
        .login-btn:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(102,126,234,0.3)}
        .login-btn:disabled{opacity:0.6;cursor:not-allowed;transform:none;box-shadow:none}
        .error-message{background:#fee;color:#c53030;padding:12px;border-radius:8px;margin-bottom:20px;border:1px solid #fed7d7;display:none}
        .loading{display:none;margin-top:10px;color:#666}
        @media (max-width:480px){.login-container{padding:30px 20px}.logo{font-size:2rem}}
      </style>
    </head>
    <body>
      <div class="login-container">
        <div class="logo">🖥️</div>
        <h1 class="subtitle">CloudStudio 监控管理系统</h1>

        <div id="errorMessage" class="error-message"></div>

        <form id="loginForm">
          <div class="form-group">
            <label for="password" class="form-label">管理员密码</label>
            <input
              type="password"
              id="password"
              name="password"
              class="form-input"
              placeholder="请输入管理员密码"
              required
            >
          </div>

          <button type="submit" id="loginBtn" class="login-btn">
            登录
          </button>

          <div id="loading" class="loading">
            正在登录...
          </div>
        </form>
      </div>

      <script>
        const loginForm = document.getElementById('loginForm');
        const loginBtn = document.getElementById('loginBtn');
        const errorMessage = document.getElementById('errorMessage');
        const loading = document.getElementById('loading');
        const passwordInput = document.getElementById('password');

        // 显示错误信息
        function showError(message) {
          errorMessage.textContent = message;
          errorMessage.style.display = 'block';
        }

        // 隐藏错误信息
        function hideError() {
          errorMessage.style.display = 'none';
        }

        // 设置加载状态
        function setLoading(isLoading) {
          loginBtn.disabled = isLoading;
          loading.style.display = isLoading ? 'block' : 'none';
          loginBtn.textContent = isLoading ? '登录中...' : '登录';
        }

        // 处理登录表单提交
        loginForm.addEventListener('submit', async (e) => {
          e.preventDefault();

          const password = passwordInput.value.trim();
          if (!password) {
            showError('请输入密码');
            return;
          }

          hideError();
          setLoading(true);

          try {
            const response = await fetch('/api/login', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ password })
            });

            const result = await response.json();

            if (result.success) {
              // 登录成功，跳转到仪表板
              window.location.href = '/dashboard';
            } else {
              showError(result.error || '登录失败');
            }
          } catch (error) {
            console.error('登录错误:', error);
            showError('网络错误，请稍后重试');
          } finally {
            setLoading(false);
          }
        });

        // 自动聚焦密码输入框
        passwordInput.focus();
      </script>
    </body>
    </html>
  `;

  return createHtmlResponse(html);
}

/**
 * 处理仪表板页面
 * @param request HTTP 请求
 * @returns Response 对象
 */
async function handleDashboard(request: Request): Promise<Response> {
  // 检查认证
  const authResult = await requireAuth(request);
  if (!authResult.authenticated) {
    return createRedirectResponse('/');
  }

  // 返回仪表板页面 HTML
  const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>CloudStudio 监控管理系统 - 仪表板</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js"></script>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f7fa;color:#333;line-height:1.6}
        .header{background:white;box-shadow:0 2px 4px rgba(0,0,0,0.1);padding:1rem 2rem;display:flex;justify-content:space-between;align-items:center}
        .logo{font-size:1.5rem;font-weight:bold;color:#667eea}
        .nav-menu{display:flex;gap:1rem}
        .nav-btn{background:none;border:none;padding:0.5rem 1rem;border-radius:6px;cursor:pointer;font-size:0.9rem;color:#666;transition:all 0.2s ease}
        .nav-btn:hover{background:#f0f0f0;color:#333}
        .nav-btn.active{background:#667eea;color:white}
        .user-menu{display:flex;align-items:center;gap:1rem}
        .logout-btn{background:#e53e3e;color:white;border:none;padding:0.5rem 1rem;border-radius:6px;cursor:pointer;font-size:0.9rem;transition:background 0.2s ease}
        .logout-btn:hover{background:#c53030}
        .container{max-width:1200px;margin:0 auto;padding:2rem}
        .page-title{font-size:2rem;margin-bottom:2rem;color:#2d3748}
        .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1.5rem;margin-bottom:2rem}
        .stat-card{background:white;padding:1.5rem;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.05);border-left:4px solid #667eea}
        .stat-title{font-size:0.9rem;color:#666;margin-bottom:0.5rem}
        .stat-value{font-size:2rem;font-weight:bold;color:#2d3748}
        .monitors-section{background:white;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.05);overflow:hidden}

        .section-header{padding:1.5rem;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center}
        .section-title{font-size:1.25rem;font-weight:600;color:#2d3748}
        .add-btn{background:#667eea;color:white;border:none;padding:0.75rem 1.5rem;border-radius:8px;cursor:pointer;font-size:0.9rem;font-weight:500;transition:background 0.2s ease}
        .add-btn:hover{background:#5a67d8}
        .monitors-list{padding:1.5rem}
        .monitor-item{display:flex;justify-content:space-between;align-items:center;padding:1rem;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:1rem;transition:box-shadow 0.2s ease}
        .monitor-item:hover{box-shadow:0 2px 8px rgba(0,0,0,0.1)}
        .monitor-info{flex:1}
        .monitor-name{font-weight:600;color:#2d3748;margin-bottom:0.25rem}
        .monitor-url{color:#666;font-size:0.9rem;word-break:break-all}
        .monitor-status{display:flex;align-items:center;gap:1rem}
        .status-badge{padding:0.25rem 0.75rem;border-radius:20px;font-size:0.8rem;font-weight:500}
        .status-success{background:#c6f6d5;color:#22543d}
        .status-error{background:#fed7d7;color:#742a2a}
        .status-pending{background:#feebc8;color:#744210}
        .monitor-actions{display:flex;gap:0.5rem}
        .action-btn{padding:0.5rem;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;transition:background 0.2s ease}
        .edit-btn{background:#bee3f8;color:#2c5282}
        .edit-btn:hover{background:#90cdf4}
        .delete-btn{background:#fed7d7;color:#742a2a}
        .delete-btn:hover{background:#feb2b2}
        .toggle-btn{background:#d6f5d6;color:#22543d}
        .toggle-btn:hover{background:#c6f6d5}
        .toggle-btn.disabled{background:#e2e8f0;color:#666}
        .modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000}

        .modal-content{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:white;border-radius:12px;padding:2rem;width:90%;max-width:500px;max-height:80vh;overflow-y:auto}
        .modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem}
        .modal-title{font-size:1.25rem;font-weight:600;color:#2d3748}
        .close-btn{background:none;border:none;font-size:1.5rem;cursor:pointer;color:#666}
        .form-group{margin-bottom:1rem}
        .form-label{display:block;margin-bottom:0.5rem;font-weight:500;color:#2d3748}
        .form-input,.form-textarea{width:100%;padding:0.75rem;border:1px solid #e2e8f0;border-radius:6px;font-size:0.9rem;transition:border-color 0.2s ease}
        .form-input:focus,.form-textarea:focus{outline:none;border-color:#667eea;box-shadow:0 0 0 3px rgba(102,126,234,0.1)}
        .form-textarea{resize:vertical;min-height:80px}
        .form-checkbox{margin-right:0.5rem}
        .form-actions{display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem}
        .btn-secondary{background:#e2e8f0;color:#4a5568;border:none;padding:0.75rem 1.5rem;border-radius:6px;cursor:pointer;font-size:0.9rem;transition:background 0.2s ease}
        .btn-secondary:hover{background:#cbd5e0}
        .btn-primary{background:#667eea;color:white;border:none;padding:0.75rem 1.5rem;border-radius:6px;cursor:pointer;font-size:0.9rem;transition:background 0.2s ease}
        .btn-primary:hover{background:#5a67d8}
        .loading{text-align:center;padding:2rem;color:#666}
        .error-message{background:#fed7d7;color:#742a2a;padding:1rem;border-radius:6px;margin-bottom:1rem;border:1px solid #feb2b2}
        .page-content{display:block}

        .page-content.hidden{display:none}
        .charts-section{background:white;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.05);margin-bottom:2rem;overflow:hidden}
        .chart-controls{display:flex;gap:1rem;align-items:center}
        .chart-container{padding:1.5rem;position:relative;height:400px}
        .logs-controls{background:white;padding:1.5rem;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.05);margin-bottom:2rem;display:flex;gap:1rem;align-items:center;flex-wrap:wrap}
        .control-group{display:flex;align-items:center;gap:0.5rem}
        .control-group label{font-weight:500;color:#2d3748;white-space:nowrap}
        .logs-section{background:white;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.05);overflow:hidden}
        .logs-list{max-height:600px;overflow-y:auto}
        .log-item{padding:1rem;border-bottom:1px solid #e2e8f0;font-family:'Courier New',monospace;font-size:0.9rem}
        .log-item:last-child{border-bottom:none}
        .log-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem}
        .log-level{padding:0.25rem 0.5rem;border-radius:4px;font-size:0.8rem;font-weight:500}
        .log-level.INFO{background:#c6f6d5;color:#22543d}
        .log-level.WARN{background:#feebc8;color:#744210}
        .log-level.ERROR{background:#fed7d7;color:#742a2a}
        .log-level.DEBUG{background:#bee3f8;color:#2c5282}

        .log-time{color:#666;font-size:0.8rem}
        .log-message{color:#2d3748;margin-bottom:0.5rem}
        .log-monitor{color:#667eea;font-size:0.8rem}
        .pagination{padding:1rem;display:flex;justify-content:center;align-items:center;gap:1rem;border-top:1px solid #e2e8f0}
        @media (max-width:768px){.header{padding:1rem;flex-direction:column;gap:1rem}.nav-menu{order:-1}.container{padding:1rem}.stats-grid{grid-template-columns:1fr}.monitor-item{flex-direction:column;align-items:flex-start;gap:1rem}.monitor-status{width:100%;justify-content:space-between}.logs-controls{flex-direction:column;align-items:stretch}.control-group{justify-content:space-between}.chart-container{height:300px}}
      </style>
    </head>
    <body>
      <header class="header">
        <div class="logo">🖥️ CloudStudio 监控管理系统</div>
        <div class="nav-menu">
          <button id="dashboardTab" class="nav-btn active">仪表板</button>
          <button id="logsTab" class="nav-btn">系统日志</button>
        </div>
        <div class="user-menu">
          <span>管理员</span>
          <button id="logoutBtn" class="logout-btn">登出</button>
        </div>
      </header>

      <div class="container">
        <!-- 仪表板页面 -->
        <div id="dashboardPage" class="page-content">
          <h1 class="page-title">监控仪表板</h1>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-title">总监控数</div>
              <div class="stat-value" id="totalMonitors">-</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">启用监控</div>
              <div class="stat-value" id="enabledMonitors">-</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">正常运行</div>
              <div class="stat-value" id="successMonitors">-</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">异常监控</div>
              <div class="stat-value" id="errorMonitors">-</div>
            </div>
          </div>

          <!-- 监控状态图表 -->
          <div class="charts-section">
            <div class="section-header">
              <h2 class="section-title">监控状态概览</h2>
              <div class="chart-controls">
                <select id="chartPeriod" class="form-input">
                  <option value="24h">24小时</option>
                  <option value="7d">7天</option>
                </select>
              </div>
            </div>
            <div class="chart-container">
              <canvas id="overviewChart" width="800" height="400"></canvas>
            </div>
          </div>

          <div class="monitors-section">
            <div class="section-header">
              <h2 class="section-title">监控配置</h2>
              <button id="addMonitorBtn" class="add-btn">+ 添加监控</button>
            </div>

            <div class="monitors-list">
              <div id="loading" class="loading">加载中...</div>
              <div id="monitorsList"></div>
            </div>
          </div>
        </div>

        <!-- 系统日志页面 -->
        <div id="logsPage" class="page-content" style="display: none;">
          <h1 class="page-title">系统日志</h1>

          <div class="logs-controls">
            <div class="control-group">
              <label for="logLevel">日志级别:</label>
              <select id="logLevel" class="form-input">
                <option value="">全部</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
                <option value="DEBUG">DEBUG</option>
              </select>
            </div>

            <div class="control-group">
              <label for="logMonitor">监控配置:</label>
              <select id="logMonitor" class="form-input">
                <option value="">全部</option>
              </select>
            </div>

            <button id="refreshLogs" class="btn-primary">刷新日志</button>
            <button id="autoRefreshToggle" class="btn-secondary">自动刷新: 开</button>
          </div>

          <div class="logs-section">
            <div id="logsLoading" class="loading">加载中...</div>
            <div id="logsList" class="logs-list"></div>

            <div class="pagination">
              <button id="prevPage" class="btn-secondary">上一页</button>
              <span id="pageInfo">第 1 页，共 1 页</span>
              <button id="nextPage" class="btn-secondary">下一页</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 添加/编辑监控配置模态框 -->
      <div id="monitorModal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title" id="modalTitle">添加监控配置</h3>
            <button class="close-btn" id="closeModal">&times;</button>
          </div>

          <div id="modalError" class="error-message" style="display: none;"></div>

          <form id="monitorForm">
            <div class="form-group">
              <label for="monitorName" class="form-label">监控名称 *</label>
              <input type="text" id="monitorName" name="name" class="form-input" required>
            </div>

            <div class="form-group">
              <label for="monitorUrl" class="form-label">目标 URL *</label>
              <input type="url" id="monitorUrl" name="url" class="form-input" required>
            </div>

            <div class="form-group">
              <label for="monitorCookie" class="form-label">Cookie</label>
              <textarea id="monitorCookie" name="cookie" class="form-textarea" placeholder="可选：请求时使用的 Cookie"></textarea>
            </div>

            <div class="form-group">
              <label for="monitorMethod" class="form-label">请求方法</label>
              <select id="monitorMethod" name="method" class="form-input">
                <option value="GET">GET（推荐）</option>
                <option value="POST">POST</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>

            <div class="form-group">
              <label for="monitorInterval" class="form-label">监控间隔（分钟）</label>
              <input type="number" id="monitorInterval" name="interval" class="form-input" min="1" max="60" value="1">
            </div>

            <div class="form-group">
              <label>
                <input type="checkbox" id="monitorEnabled" name="enabled" class="form-checkbox" checked>
                启用监控
              </label>
            </div>

            <div class="form-actions">
              <button type="button" class="btn-secondary" id="cancelBtn">取消</button>
              <button type="submit" class="btn-primary" id="saveBtn">保存</button>
            </div>
          </form>
        </div>
      </div>

      <script>
        // 全局变量
        let monitors = [];
        let editingMonitorId = null;
        let currentPage = 'dashboard';
        let logsCurrentPage = 1;
        let logsAutoRefresh = true;
        let logsAutoRefreshInterval = null;
        let overviewChart = null;

        // DOM 元素
        const logoutBtn = document.getElementById('logoutBtn');
        const addMonitorBtn = document.getElementById('addMonitorBtn');
        const monitorModal = document.getElementById('monitorModal');
        const closeModal = document.getElementById('closeModal');
        const cancelBtn = document.getElementById('cancelBtn');
        const monitorForm = document.getElementById('monitorForm');
        const modalTitle = document.getElementById('modalTitle');
        const modalError = document.getElementById('modalError');
        const loading = document.getElementById('loading');
        const monitorsList = document.getElementById('monitorsList');

        // 页面切换元素
        const dashboardTab = document.getElementById('dashboardTab');
        const logsTab = document.getElementById('logsTab');
        const dashboardPage = document.getElementById('dashboardPage');
        const logsPage = document.getElementById('logsPage');

        // 日志相关元素
        const logLevel = document.getElementById('logLevel');
        const logMonitor = document.getElementById('logMonitor');
        const refreshLogs = document.getElementById('refreshLogs');
        const autoRefreshToggle = document.getElementById('autoRefreshToggle');
        const logsLoading = document.getElementById('logsLoading');
        const logsList = document.getElementById('logsList');
        const prevPage = document.getElementById('prevPage');
        const nextPage = document.getElementById('nextPage');
        const pageInfo = document.getElementById('pageInfo');

        // 图表相关元素
        const chartPeriod = document.getElementById('chartPeriod');
        const overviewChartCanvas = document.getElementById('overviewChart');

        // 统计元素
        const totalMonitors = document.getElementById('totalMonitors');
        const enabledMonitors = document.getElementById('enabledMonitors');
        const successMonitors = document.getElementById('successMonitors');
        const errorMonitors = document.getElementById('errorMonitors');

        // 工具函数
        function showError(message) {
          modalError.textContent = message;
          modalError.style.display = 'block';
        }

        function hideError() {
          modalError.style.display = 'none';
        }

        function showModal() {
          monitorModal.style.display = 'block';
        }

        function hideModal() {
          monitorModal.style.display = 'none';
          monitorForm.reset();
          editingMonitorId = null;
          hideError();
        }

        // 页面切换函数
        function switchPage(page) {
          currentPage = page;

          // 更新导航按钮状态
          dashboardTab.classList.toggle('active', page === 'dashboard');
          logsTab.classList.toggle('active', page === 'logs');

          // 显示/隐藏页面
          dashboardPage.style.display = page === 'dashboard' ? 'block' : 'none';
          logsPage.style.display = page === 'logs' ? 'block' : 'none';

          // 页面特定的初始化
          if (page === 'logs') {
            loadLogs();
            loadMonitorOptions();
            if (logsAutoRefresh && !logsAutoRefreshInterval) {
              startLogsAutoRefresh();
            }
          } else if (page === 'dashboard') {
            loadMonitors();
            loadOverviewChart();
            if (logsAutoRefreshInterval) {
              clearInterval(logsAutoRefreshInterval);
              logsAutoRefreshInterval = null;
            }
          }
        }

        // 日志相关函数
        async function loadLogs() {
          try {
            logsLoading.style.display = 'block';
            logsList.innerHTML = '';

            const level = logLevel.value || '';
            const monitorId = logMonitor.value || '';

            const params = new URLSearchParams({
              page: logsCurrentPage.toString(),
              limit: '50'
            });

            if (level) params.append('level', level);
            if (monitorId) params.append('monitorId', monitorId);

            const result = await apiRequest(\`/api/logs?\${params}\`);
            if (result && result.success) {
              renderLogs(result.data.logs);
              updateLogsPagination(result.data.pagination);
            } else {
              throw new Error(result?.error || '加载日志失败');
            }
          } catch (error) {
            console.error('加载日志错误:', error);
            logsList.innerHTML = '<div class="error-message">加载失败: ' + error.message + '</div>';
          } finally {
            logsLoading.style.display = 'none';
          }
        }

        function renderLogs(logs) {
          if (logs.length === 0) {
            logsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #666;">暂无日志记录</div>';
            return;
          }

          const html = logs.map(log => {
            const time = new Date(log.timestamp).toLocaleString();
            const levelClass = log.level.toLowerCase();

            return \`
              <div class="log-item">
                <div class="log-header">
                  <div class="log-level \${log.level}">\${log.level}</div>
                  <div class="log-time">\${time}</div>
                </div>
                <div class="log-message">\${log.message}</div>
                \${log.monitorName ? \`<div class="log-monitor">监控: \${log.monitorName}</div>\` : ''}
              </div>
            \`;
          }).join('');

          logsList.innerHTML = html;
        }

        function updateLogsPagination(pagination) {
          pageInfo.textContent = \`第 \${pagination.page} 页，共 \${pagination.totalPages} 页\`;
          prevPage.disabled = pagination.page <= 1;
          nextPage.disabled = pagination.page >= pagination.totalPages;
        }

        async function loadMonitorOptions() {
          try {
            const result = await apiRequest('/api/monitors');
            if (result && result.success) {
              const options = result.data.map(monitor =>
                \`<option value="\${monitor.id}">\${monitor.name}</option>\`
              ).join('');
              logMonitor.innerHTML = '<option value="">全部</option>' + options;
            }
          } catch (error) {
            console.error('加载监控选项错误:', error);
          }
        }

        function startLogsAutoRefresh() {
          logsAutoRefreshInterval = setInterval(() => {
            if (currentPage === 'logs') {
              loadLogs();
            }
          }, 30000); // 30秒刷新一次
        }

        function toggleLogsAutoRefresh() {
          logsAutoRefresh = !logsAutoRefresh;
          autoRefreshToggle.textContent = \`自动刷新: \${logsAutoRefresh ? '开' : '关'}\`;

          if (logsAutoRefresh && currentPage === 'logs') {
            startLogsAutoRefresh();
          } else if (logsAutoRefreshInterval) {
            clearInterval(logsAutoRefreshInterval);
            logsAutoRefreshInterval = null;
          }
        }

        // API 请求函数
        async function apiRequest(url, options = {}) {
          try {
            const response = await fetch(url, {
              ...options,
              headers: {
                'Content-Type': 'application/json',
                ...options.headers
              }
            });

            if (response.status === 401) {
              // 未认证，跳转到登录页
              window.location.href = '/';
              return null;
            }

            const result = await response.json();
            return result;
          } catch (error) {
            console.error('API 请求错误:', error);
            throw new Error('网络错误，请稍后重试');
          }
        }

        // 加载监控配置列表
        async function loadMonitors() {
          try {
            loading.style.display = 'block';
            monitorsList.innerHTML = '';

            const result = await apiRequest('/api/monitors');
            if (result && result.success) {
              monitors = result.data;
              renderMonitors();
              updateStats();
            } else {
              throw new Error(result?.error || '加载监控配置失败');
            }
          } catch (error) {
            console.error('加载监控配置错误:', error);
            monitorsList.innerHTML = '<div class="error-message">加载失败: ' + error.message + '</div>';
          } finally {
            loading.style.display = 'none';
          }
        }

        // 渲染监控配置列表
        function renderMonitors() {
          if (monitors.length === 0) {
            monitorsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #666;">暂无监控配置</div>';
            return;
          }

          const html = monitors.map(monitor => {
            const statusClass = monitor.status === 'success' ? 'status-success' :
                               monitor.status === 'error' ? 'status-error' : 'status-pending';
            const statusText = monitor.status === 'success' ? '正常' :
                              monitor.status === 'error' ? '异常' : '待检查';

            return \`
              <div class="monitor-item">
                <div class="monitor-info">
                  <div class="monitor-name">\${monitor.name}</div>
                  <div class="monitor-url">\${monitor.url}</div>
                </div>
                <div class="monitor-status">
                  <span class="status-badge \${statusClass}">\${statusText}</span>
                  <div class="monitor-actions">
                    <button class="action-btn toggle-btn \${monitor.enabled ? '' : 'disabled'}"
                            onclick="toggleMonitor('\${monitor.id}', \${!monitor.enabled})">
                      \${monitor.enabled ? '禁用' : '启用'}
                    </button>
                    <button class="action-btn edit-btn" onclick="editMonitor('\${monitor.id}')">编辑</button>
                    <button class="action-btn delete-btn" onclick="deleteMonitor('\${monitor.id}')">删除</button>
                  </div>
                </div>
              </div>
            \`;
          }).join('');

          monitorsList.innerHTML = html;
        }

        // 更新统计信息
        function updateStats() {
          const total = monitors.length;
          const enabled = monitors.filter(m => m.enabled).length;
          const success = monitors.filter(m => m.status === 'success').length;
          const error = monitors.filter(m => m.status === 'error').length;

          totalMonitors.textContent = total;
          enabledMonitors.textContent = enabled;
          successMonitors.textContent = success;
          errorMonitors.textContent = error;
        }

        // 图表相关函数
        async function loadOverviewChart() {
          try {
            const period = chartPeriod.value || '24h';
            const result = await apiRequest(\`/api/stats?period=\${period}\`);

            if (result && result.success) {
              renderOverviewChart(result.data, period);
            }
          } catch (error) {
            console.error('加载图表数据错误:', error);
          }
        }

        function renderOverviewChart(statsData, period) {
          const ctx = overviewChartCanvas.getContext('2d');

          // 销毁现有图表
          if (overviewChart) {
            overviewChart.destroy();
          }

          // 合并所有监控的数据点
          const allLabels = new Set();
          statsData.forEach(stats => {
            stats.dataPoints.forEach(point => allLabels.add(point.label));
          });

          const labels = Array.from(allLabels).sort();

          const datasets = statsData.map((stats, index) => {
            const colors = [
              '#667eea', '#f093fb', '#4facfe', '#43e97b',
              '#fa709a', '#ffecd2', '#a8edea', '#d299c2'
            ];
            const color = colors[index % colors.length];

            const data = labels.map(label => {
              const point = stats.dataPoints.find(p => p.label === label);
              return point ? point.successRate : 0;
            });

            return {
              label: stats.monitorName,
              data: data,
              backgroundColor: color + '80', // 50% 透明度
              borderColor: color,
              borderWidth: 2,
              tension: 0.4
            };
          });

          overviewChart = new Chart(ctx, {
            type: 'line',
            data: {
              labels: labels,
              datasets: datasets
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                title: {
                  display: true,
                  text: \`监控成功率趋势 (\${period === '24h' ? '24小时' : '7天'})\`
                },
                legend: {
                  display: true,
                  position: 'top'
                },
                tooltip: {
                  mode: 'index',
                  intersect: false,
                  callbacks: {
                    label: function(context) {
                      return \`\${context.dataset.label}: \${context.parsed.y.toFixed(1)}%\`;
                    }
                  }
                }
              },
              scales: {
                x: {
                  display: true,
                  title: {
                    display: true,
                    text: period === '24h' ? '时间 (小时)' : '日期'
                  }
                },
                y: {
                  display: true,
                  title: {
                    display: true,
                    text: '成功率 (%)'
                  },
                  min: 0,
                  max: 100
                }
              },
              interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
              }
            }
          });
        }

        // 保存监控配置
        async function saveMonitor(formData) {
          try {
            const url = editingMonitorId ? \`/api/monitors/\${editingMonitorId}\` : '/api/monitors';
            const method = editingMonitorId ? 'PUT' : 'POST';

            const result = await apiRequest(url, {
              method,
              body: JSON.stringify(formData)
            });

            if (result && result.success) {
              hideModal();
              await loadMonitors();
            } else {
              throw new Error(result?.error || '保存失败');
            }
          } catch (error) {
            showError(error.message);
          }
        }

        // 删除监控配置
        async function deleteMonitor(id) {
          if (!confirm('确定要删除这个监控配置吗？')) {
            return;
          }

          try {
            const result = await apiRequest(\`/api/monitors/\${id}\`, {
              method: 'DELETE'
            });

            if (result && result.success) {
              await loadMonitors();
            } else {
              throw new Error(result?.error || '删除失败');
            }
          } catch (error) {
            alert('删除失败: ' + error.message);
          }
        }

        // 切换监控状态
        async function toggleMonitor(id, enabled) {
          try {
            const monitor = monitors.find(m => m.id === id);
            if (!monitor) return;

            const result = await apiRequest(\`/api/monitors/\${id}\`, {
              method: 'PUT',
              body: JSON.stringify({
                ...monitor,
                enabled
              })
            });

            if (result && result.success) {
              await loadMonitors();
            } else {
              throw new Error(result?.error || '更新失败');
            }
          } catch (error) {
            alert('更新失败: ' + error.message);
          }
        }

        // 编辑监控配置
        function editMonitor(id) {
          const monitor = monitors.find(m => m.id === id);
          if (!monitor) return;

          editingMonitorId = id;
          modalTitle.textContent = '编辑监控配置';

          document.getElementById('monitorName').value = monitor.name;
          document.getElementById('monitorUrl').value = monitor.url;
          document.getElementById('monitorCookie').value = monitor.cookie || '';
          document.getElementById('monitorMethod').value = monitor.method || 'GET';
          document.getElementById('monitorInterval').value = monitor.interval;
          document.getElementById('monitorEnabled').checked = monitor.enabled;

          showModal();
        }

        // 登出
        async function logout() {
          try {
            await apiRequest('/api/logout', { method: 'POST' });
            window.location.href = '/';
          } catch (error) {
            console.error('登出错误:', error);
            window.location.href = '/';
          }
        }

        // 事件监听器
        logoutBtn.addEventListener('click', logout);

        // 页面切换
        dashboardTab.addEventListener('click', () => switchPage('dashboard'));
        logsTab.addEventListener('click', () => switchPage('logs'));

        // 监控配置相关
        addMonitorBtn.addEventListener('click', () => {
          editingMonitorId = null;
          modalTitle.textContent = '添加监控配置';
          showModal();
        });

        closeModal.addEventListener('click', hideModal);
        cancelBtn.addEventListener('click', hideModal);

        // 日志相关
        refreshLogs.addEventListener('click', loadLogs);
        autoRefreshToggle.addEventListener('click', toggleLogsAutoRefresh);
        logLevel.addEventListener('change', () => {
          logsCurrentPage = 1;
          loadLogs();
        });
        logMonitor.addEventListener('change', () => {
          logsCurrentPage = 1;
          loadLogs();
        });

        prevPage.addEventListener('click', () => {
          if (logsCurrentPage > 1) {
            logsCurrentPage--;
            loadLogs();
          }
        });

        nextPage.addEventListener('click', () => {
          logsCurrentPage++;
          loadLogs();
        });

        // 图表相关
        chartPeriod.addEventListener('change', loadOverviewChart);

        monitorModal.addEventListener('click', (e) => {
          if (e.target === monitorModal) {
            hideModal();
          }
        });

        monitorForm.addEventListener('submit', async (e) => {
          e.preventDefault();

          const formData = new FormData(monitorForm);
          const data = {
            name: formData.get('name'),
            url: formData.get('url'),
            cookie: formData.get('cookie'),
            method: formData.get('method') || 'GET',
            interval: parseInt(formData.get('interval')) || 1,
            enabled: formData.get('enabled') === 'on'
          };

          await saveMonitor(data);
        });

        // 页面加载时初始化
        document.addEventListener('DOMContentLoaded', () => {
          // 初始化仪表板页面
          switchPage('dashboard');

          // 定期刷新监控状态（每30秒）
          setInterval(() => {
            if (currentPage === 'dashboard') {
              loadMonitors();
              loadOverviewChart();
            }
          }, 30000);
        });

        // 全局函数（供 onclick 使用）
        window.editMonitor = editMonitor;
        window.deleteMonitor = deleteMonitor;
        window.toggleMonitor = toggleMonitor;
      </script>
    </body>
    </html>
  `;

  return createHtmlResponse(html);
}

// ================================
// API 路由处理器
// ================================

/**
 * 处理登录 API
 * @param request HTTP 请求
 * @returns Response 对象
 */
async function handleLoginAPI(request: Request): Promise<Response> {
  try {
    // 检查 CSRF
    if (!checkCSRF(request)) {
      return createJsonResponse(
        createApiResponse(false, null, 'CSRF 检查失败', ERROR_CODES.VALIDATION_ERROR),
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    // 解析请求体
    const body = await request.json() as LoginRequest;
    const ip = getClientIP(request);

    if (!body.password) {
      return createJsonResponse(
        createApiResponse(false, null, '密码不能为空', ERROR_CODES.VALIDATION_ERROR),
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    // 处理登录
    const loginResult = await handleLogin(body.password, ip);

    if (loginResult.success && loginResult.sessionId) {
      const response = createJsonResponse(
        createApiResponse(true, { message: '登录成功' }),
        HTTP_STATUS.OK,
      );

      // 设置会话 Cookie
      response.headers.set('Set-Cookie', createSessionCookie(loginResult.sessionId));

      return response;
    } else {
      return createJsonResponse(
        createApiResponse(
          false,
          null,
          loginResult.error || '登录失败',
          ERROR_CODES.INVALID_PASSWORD,
        ),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }
  } catch (error) {
    console.error('❌ 登录 API 处理错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '请求处理失败', ERROR_CODES.VALIDATION_ERROR),
      HTTP_STATUS.BAD_REQUEST,
    );
  }
}

/**
 * 处理登出 API
 * @param request HTTP 请求
 * @returns Response 对象
 */
async function handleLogoutAPI(request: Request): Promise<Response> {
  try {
    const success = await handleLogout(request);

    const response = createJsonResponse(
      createApiResponse(true, { message: '登出成功' }),
      HTTP_STATUS.OK,
    );

    // 清除会话 Cookie
    response.headers.set('Set-Cookie', createClearCookie());

    return response;
  } catch (error) {
    console.error('❌ 登出 API 处理错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '登出处理失败', ERROR_CODES.NETWORK_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 处理认证检查 API
 * @param request HTTP 请求
 * @returns Response 对象
 */
async function handleAuthCheckAPI(request: Request): Promise<Response> {
  const authResult = await requireAuth(request);

  if (authResult.authenticated && authResult.session) {
    return createJsonResponse(
      createApiResponse(true, {
        authenticated: true,
        session: {
          id: authResult.session.id,
          expires: authResult.session.expires,
          lastAccess: authResult.session.lastAccess,
        },
      }),
    );
  } else {
    return createJsonResponse(
      createApiResponse(false, null, authResult.error || '未认证', ERROR_CODES.UNAUTHORIZED),
      HTTP_STATUS.UNAUTHORIZED,
    );
  }
}

/**
 * 处理监控配置列表 API
 * @param request HTTP 请求
 * @returns Response 对象
 */
async function handleMonitorsListAPI(request: Request): Promise<Response> {
  try {
    // 检查认证
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    const configs = await getAllMonitorConfigs();

    return createJsonResponse(
      createApiResponse(true, configs),
    );
  } catch (error) {
    console.error('❌ 获取监控配置列表错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '获取监控配置失败', ERROR_CODES.DATABASE_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 处理创建监控配置 API
 * @param request HTTP 请求
 * @returns Response 对象
 */
async function handleCreateMonitorAPI(request: Request): Promise<Response> {
  try {
    // 检查认证
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    // 检查 CSRF
    if (!checkCSRF(request)) {
      return createJsonResponse(
        createApiResponse(false, null, 'CSRF 检查失败', ERROR_CODES.VALIDATION_ERROR),
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    // 解析请求体
    const body = await request.json() as MonitorConfigRequest;

    // 验证必要字段
    if (!body.name || !body.url) {
      return createJsonResponse(
        createApiResponse(false, null, '名称和 URL 不能为空', ERROR_CODES.VALIDATION_ERROR),
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    // 创建监控配置
    const config: MonitorConfig = {
      id: generateId(),
      name: body.name,
      url: body.url,
      cookie: body.cookie || '',
      headers: body.headers,
      method: body.method || 'GET',
      interval: body.interval || APP_CONFIG.DEFAULT_MONITOR_INTERVAL,
      enabled: body.enabled !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const success = await saveMonitorConfig(config);

    if (success) {
      return createJsonResponse(
        createApiResponse(true, config),
        HTTP_STATUS.CREATED,
      );
    } else {
      return createJsonResponse(
        createApiResponse(false, null, '保存监控配置失败', ERROR_CODES.DATABASE_ERROR),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  } catch (error) {
    console.error('❌ 创建监控配置错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '请求处理失败', ERROR_CODES.VALIDATION_ERROR),
      HTTP_STATUS.BAD_REQUEST,
    );
  }
}

// 主路由分发器
// ================================

/**
 * 主路由处理器
 * @param request HTTP 请求
 * @returns Response 对象
 */
async function routeHandler(request: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    const { path, method } = parseRequest(request);

    // 处理 CORS 预检请求
    if (method === 'OPTIONS') {
      return handleCORS(request);
    }

    // 页面路由
    if (method === 'GET') {
      switch (path) {
        case '/':
          return await handleLoginPage(request);
        case '/dashboard':
          return await handleDashboard(request);
      }
    }

    // API 路由
    if (path.startsWith('/api/')) {
      // 认证相关 API
      if (path === '/api/login' && method === 'POST') {
        return await handleLoginAPI(request);
      }

      if (path === '/api/logout' && method === 'POST') {
        return await handleLogoutAPI(request);
      }

      if (path === '/api/auth/check' && method === 'GET') {
        return await handleAuthCheckAPI(request);
      }

      // 监控配置相关 API
      if (path === '/api/monitors' && method === 'GET') {
        return await handleMonitorsListAPI(request);
      }

      if (path === '/api/monitors' && method === 'POST') {
        return await handleCreateMonitorAPI(request);
      }

      // 监控配置操作 API（带参数）
      const monitorIdMatch = path.match(/^\/api\/monitors\/([^\/]+)$/);
      if (monitorIdMatch) {
        const monitorId = monitorIdMatch[1];

        if (method === 'PUT') {
          return await handleUpdateMonitorAPI(request, monitorId);
        }

        if (method === 'DELETE') {
          return await handleDeleteMonitorAPI(request, monitorId);
        }
      }

      // 监控状态 API
      if (path === '/api/monitors/status' && method === 'GET') {
        return await handleMonitorStatusAPI(request);
      }

      // 系统信息 API
      if (path === '/api/system/info' && method === 'GET') {
        return await handleSystemInfoAPI(request);
      }

      if (path === '/api/system/health' && method === 'GET') {
        return await handleSystemHealthAPI(request);
      }

      // 监控调度器 API
      if (path === '/api/scheduler/status' && method === 'GET') {
        return await handleSchedulerStatusAPI(request);
      }

      if (path === '/api/scheduler/restart' && method === 'POST') {
        return await handleSchedulerRestartAPI(request);
      }

      // 系统日志 API
      if (path === '/api/logs' && method === 'GET') {
        return await handleSystemLogsAPI(request);
      }

      // 监控统计 API
      if (path === '/api/stats' && method === 'GET') {
        return await handleMonitorStatsAPI(request);
      }

      // 监控详细统计 API
      const statsMatch = path.match(/^\/api\/monitors\/([^\/]+)\/stats$/);
      if (statsMatch && method === 'GET') {
        const monitorId = statsMatch[1];
        return await handleMonitorDetailStatsAPI(request, monitorId);
      }
    }

    // 404 Not Found
    return createJsonResponse(
      createApiResponse(false, null, '页面不存在', ERROR_CODES.NOT_FOUND),
      HTTP_STATUS.NOT_FOUND,
    );
  } catch (error) {
    return handleError(error as Error, request);
  } finally {
    // 这里无法直接获取 response，所以在各个处理器中单独记录日志
  }
}

/**
 * 处理更新监控配置 API
 * @param request HTTP 请求
 * @param monitorId 监控配置 ID
 * @returns Response 对象
 */
async function handleUpdateMonitorAPI(request: Request, monitorId: string): Promise<Response> {
  try {
    // 检查认证
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    // 检查 CSRF
    if (!checkCSRF(request)) {
      return createJsonResponse(
        createApiResponse(false, null, 'CSRF 检查失败', ERROR_CODES.VALIDATION_ERROR),
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    // 获取现有配置
    const existingConfig = await getMonitorConfig(monitorId);
    if (!existingConfig) {
      return createJsonResponse(
        createApiResponse(false, null, '监控配置不存在', ERROR_CODES.MONITOR_NOT_FOUND),
        HTTP_STATUS.NOT_FOUND,
      );
    }

    // 解析请求体
    const body = await request.json() as MonitorConfigRequest;

    // 更新配置
    const updatedConfig: MonitorConfig = {
      ...existingConfig,
      name: body.name || existingConfig.name,
      url: body.url || existingConfig.url,
      cookie: body.cookie !== undefined ? body.cookie : existingConfig.cookie,
      headers: body.headers !== undefined ? body.headers : existingConfig.headers,
      method: body.method !== undefined ? body.method : existingConfig.method,
      interval: body.interval !== undefined ? body.interval : existingConfig.interval,
      enabled: body.enabled !== undefined ? body.enabled : existingConfig.enabled,
      updatedAt: new Date(),
    };

    const success = await saveMonitorConfig(updatedConfig);

    if (success) {
      return createJsonResponse(
        createApiResponse(true, updatedConfig),
      );
    } else {
      return createJsonResponse(
        createApiResponse(false, null, '更新监控配置失败', ERROR_CODES.DATABASE_ERROR),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  } catch (error) {
    console.error('❌ 更新监控配置错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '请求处理失败', ERROR_CODES.VALIDATION_ERROR),
      HTTP_STATUS.BAD_REQUEST,
    );
  }
}

/**
 * 处理删除监控配置 API
 * @param request HTTP 请求
 * @param monitorId 监控配置 ID
 * @returns Response 对象
 */
async function handleDeleteMonitorAPI(request: Request, monitorId: string): Promise<Response> {
  try {
    // 检查认证
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    // 检查 CSRF
    if (!checkCSRF(request)) {
      return createJsonResponse(
        createApiResponse(false, null, 'CSRF 检查失败', ERROR_CODES.VALIDATION_ERROR),
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const success = await deleteMonitorConfig(monitorId);

    if (success) {
      return createJsonResponse(
        createApiResponse(true, { message: '监控配置已删除' }),
      );
    } else {
      return createJsonResponse(
        createApiResponse(false, null, '删除监控配置失败', ERROR_CODES.MONITOR_NOT_FOUND),
        HTTP_STATUS.NOT_FOUND,
      );
    }
  } catch (error) {
    console.error('❌ 删除监控配置错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '请求处理失败', ERROR_CODES.DATABASE_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 处理监控状态 API
 * @param request HTTP 请求
 * @returns Response 对象
 */
async function handleMonitorStatusAPI(request: Request): Promise<Response> {
  try {
    // 检查认证
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    const configs = await getAllMonitorConfigs();
    const status = configs.map((config) => ({
      id: config.id,
      name: config.name,
      enabled: config.enabled,
      status: config.status,
      lastCheck: config.lastCheck,
      lastError: config.lastError,
    }));

    return createJsonResponse(
      createApiResponse(true, status),
    );
  } catch (error) {
    console.error('❌ 获取监控状态错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '获取监控状态失败', ERROR_CODES.DATABASE_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 处理系统信息 API
 * @param request HTTP 请求
 * @returns Response 对象
 */
async function handleSystemInfoAPI(request: Request): Promise<Response> {
  try {
    // 检查认证
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    const configs = await getAllMonitorConfigs();
    const schedulerStatus = monitorScheduler.getStatus();

    const info = {
      version: '1.0.0',
      totalMonitors: configs.length,
      enabledMonitors: configs.filter((c) => c.enabled).length,
      uptime: Date.now() - startTime,
      platform: 'Deno Deploy',
      scheduler: {
        isRunning: schedulerStatus.isRunning,
        executionCount: schedulerStatus.executionCount,
        lastExecutionTime: schedulerStatus.lastExecutionTime,
      },
    };

    return createJsonResponse(
      createApiResponse(true, info),
    );
  } catch (error) {
    console.error('❌ 获取系统信息错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '获取系统信息失败', ERROR_CODES.NETWORK_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 处理系统健康检查 API
 * @param request HTTP 请求
 * @returns Response 对象
 */
async function handleSystemHealthAPI(request: Request): Promise<Response> {
  try {
    const schedulerStatus = monitorScheduler.getStatus();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'healthy',
        monitoring: schedulerStatus.isRunning ? 'healthy' : 'stopped',
        scheduler: schedulerStatus.isRunning ? 'running' : 'stopped',
      },
      scheduler: schedulerStatus,
    };

    return createJsonResponse(
      createApiResponse(true, health),
    );
  } catch (error) {
    console.error('❌ 健康检查错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '健康检查失败', ERROR_CODES.NETWORK_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 处理调度器状态 API
 * @param request HTTP 请求
 * @returns Response 对象
 */
async function handleSchedulerStatusAPI(request: Request): Promise<Response> {
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
      createApiResponse(false, null, '获取调度器状态失败', ERROR_CODES.NETWORK_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 处理调度器重启 API
 * @param request HTTP 请求
 * @returns Response 对象
 */
async function handleSchedulerRestartAPI(request: Request): Promise<Response> {
  try {
    // 检查认证
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    // 检查 CSRF
    if (!checkCSRF(request)) {
      return createJsonResponse(
        createApiResponse(false, null, 'CSRF 检查失败', ERROR_CODES.VALIDATION_ERROR),
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    // 重启调度器
    monitorScheduler.stop();
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 等待1秒
    await monitorScheduler.start();

    return createJsonResponse(
      createApiResponse(true, { message: '调度器已重启' }),
    );
  } catch (error) {
    console.error('❌ 重启调度器错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '重启调度器失败', ERROR_CODES.NETWORK_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 处理系统日志 API
 * @param request HTTP 请求
 * @returns Response 对象
 */
async function handleSystemLogsAPI(request: Request): Promise<Response> {
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
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const result = await getSystemLogs({
      level: level || undefined,
      monitorId: monitorId || undefined,
      limit,
      offset,
    });

    return createJsonResponse(
      createApiResponse(true, {
        logs: result.logs,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      }),
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
 * 处理监控统计 API
 * @param request HTTP 请求
 * @returns Response 对象
 */
async function handleMonitorStatsAPI(request: Request): Promise<Response> {
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

    const configs = await getAllMonitorConfigs();
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
 * 处理监控详细统计 API
 * @param request HTTP 请求
 * @param monitorId 监控配置 ID
 * @returns Response 对象
 */
async function handleMonitorDetailStatsAPI(request: Request, monitorId: string): Promise<Response> {
  try {
    // 检查认证
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    const config = await getMonitorConfig(monitorId);
    if (!config) {
      return createJsonResponse(
        createApiResponse(false, null, '监控配置不存在', ERROR_CODES.MONITOR_NOT_FOUND),
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
 * @param monitorId 监控配置 ID
 * @param monitorName 监控配置名称
 * @param period 时间段
 * @returns 统计数据
 */
async function generateMonitorStats(
  monitorId: string,
  monitorName: string,
  period: '24h' | '7d',
): Promise<MonitorStats> {
  const now = new Date();
  const dataPoints: MonitorStats['dataPoints'] = [];

  if (period === '24h') {
    // 24小时视图：按小时统计
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
      hourStart.setMinutes(0, 0, 0);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

      const histories = await getMonitorHistoryInRange(monitorId, hourStart, hourEnd);
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

      const histories = await getMonitorHistoryInRange(monitorId, dayStart, dayEnd);
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

  return {
    monitorId,
    monitorName,
    period,
    dataPoints,
  };
}

/**
 * 获取指定时间范围内的监控历史记录
 * @param monitorId 监控配置 ID
 * @param startTime 开始时间
 * @param endTime 结束时间
 * @returns 历史记录列表
 */
async function getMonitorHistoryInRange(
  monitorId: string,
  startTime: Date,
  endTime: Date,
): Promise<MonitorHistory[]> {
  try {
    const db = await ensureKV();
    const histories: MonitorHistory[] = [];

    const iter = db.list<MonitorHistory>({
      prefix: [KV_KEYS.HISTORY, monitorId],
    });

    for await (const entry of iter) {
      if (entry.value) {
        const history = entry.value;
        history.timestamp = new Date(history.timestamp);

        if (history.timestamp >= startTime && history.timestamp < endTime) {
          histories.push(history);
        }
      }
    }

    return histories;
  } catch (error) {
    console.error('获取监控历史记录失败:', error);
    return [];
  }
}

// ================================
// HTTP 服务器启动
// ================================

let startTime = Date.now();

/**
 * 启动 HTTP 服务器
 * @param port 端口号
 */
async function startHttpServer(port: number = 8000): Promise<void> {
  try {
    console.log(`🌐 启动 HTTP 服务器，端口: ${port}`);

    // 添加优雅关闭处理
    const abortController = new AbortController();

    // 监听关闭信号
    Deno.addSignalListener('SIGINT', () => {
      console.log('\n🛑 收到关闭信号，正在优雅关闭...');
      abortController.abort();
      monitorScheduler.stop();
      console.log('✅ 应用已关闭');
      Deno.exit(0);
    });

    await Deno.serve({
      port,
      signal: abortController.signal,
      handler: async (request: Request) => {
        const requestStartTime = Date.now();
        try {
          const response = await routeHandler(request);
          logRequest(request, response, requestStartTime);
          return response;
        } catch (error) {
          console.error('❌ 请求处理错误:', error);
          const errorResponse = handleError(error as Error, request);
          logRequest(request, errorResponse, requestStartTime);
          return errorResponse;
        }
      },
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.log('✅ HTTP 服务器已停止');
    } else {
      console.error('❌ HTTP 服务器启动失败:', error);
      throw error;
    }
  }
}

// ================================
// 监控任务调度系统
// ================================

/**
 * 监控任务调度器
 */
class MonitorScheduler {
  private isRunning: boolean = false;
  private lastExecutionTime: Date | null = null;
  private executionCount: number = 0;
  private cronJob: any = null;

  /**
   * 启动监控调度器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ 监控调度器已在运行中');
      return;
    }

    this.isRunning = true;
    console.log('🚀 启动监控任务调度器');

    // 立即执行一次监控
    await this.executeMonitoringCycle();

    // 设置定时任务（每分钟执行一次）
    this.cronJob = Deno.cron('Monitor Scheduler', '* * * * *', async () => {
      await this.executeMonitoringCycle();
    });

    console.log('✅ 监控调度器启动成功');
  }

  /**
   * 停止监控调度器
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('⚠️ 监控调度器未在运行');
      return;
    }

    this.isRunning = false;
    console.log('🛑 停止监控任务调度器');
  }

  /**
   * 执行监控周期
   */
  private async executeMonitoringCycle(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      this.lastExecutionTime = new Date();
      this.executionCount++;

      console.log(
        `\n🔄 开始第 ${this.executionCount} 次监控周期 [${this.lastExecutionTime.toISOString()}]`,
      );

      // 获取所有监控配置
      const configs = await getAllMonitorConfigs();
      const enabledConfigs = configs.filter((config) => config.enabled);

      if (enabledConfigs.length === 0) {
        console.log('📝 没有启用的监控配置，跳过本次执行');
        return;
      }

      console.log(`📊 发现 ${enabledConfigs.length} 个启用的监控配置`);

      // 执行监控任务
      const results = await this.executeMonitorTasks(enabledConfigs);

      // 更新监控配置状态
      await this.updateMonitorStatuses(results);

      // 统计结果
      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.length - successCount;

      console.log(`✅ 监控周期完成: 成功 ${successCount} 个，失败 ${failureCount} 个\n`);
    } catch (error) {
      console.error('❌ 监控周期执行错误:', error);
    }
  }

  /**
   * 执行监控任务
   * @param configs 监控配置列表
   * @returns 监控结果列表
   */
  private async executeMonitorTasks(
    configs: MonitorConfig[],
  ): Promise<Array<MonitorResult & { configId: string }>> {
    const results: Array<MonitorResult & { configId: string }> = [];

    // 限制并发数量
    const maxConcurrent = Math.min(configs.length, APP_CONFIG.MAX_CONCURRENT_MONITORS);

    for (let i = 0; i < configs.length; i += maxConcurrent) {
      const batch = configs.slice(i, i + maxConcurrent);

      console.log(
        `🔄 执行批次 ${Math.floor(i / maxConcurrent) + 1}/${
          Math.ceil(configs.length / maxConcurrent)
        } (${batch.length} 个任务)`,
      );

      const batchPromises = batch.map(async (config) => {
        const result = await executeMonitor(config);
        return { ...result, configId: config.id };
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 批次间延迟，避免过于频繁的请求
      if (i + maxConcurrent < configs.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * 更新监控配置状态
   * @param results 监控结果列表
   */
  private async updateMonitorStatuses(
    results: Array<MonitorResult & { configId: string }>,
  ): Promise<void> {
    for (const result of results) {
      try {
        const config = await getMonitorConfig(result.configId);
        if (config) {
          config.lastCheck = result.timestamp;
          config.status = result.status;
          config.lastError = result.error;
          config.updatedAt = new Date();

          await saveMonitorConfig(config);
        }
      } catch (error) {
        console.error(`❌ 更新监控配置状态失败 (${result.configId}):`, error);
      }
    }
  }

  /**
   * 获取调度器状态
   */
  getStatus(): {
    isRunning: boolean;
    lastExecutionTime: Date | null;
    executionCount: number;
  } {
    return {
      isRunning: this.isRunning,
      lastExecutionTime: this.lastExecutionTime,
      executionCount: this.executionCount,
    };
  }
}

// 全局监控调度器实例
const monitorScheduler = new MonitorScheduler();

/**
 * 监控告警管理器
 */
class MonitorAlertManager {
  private alertThreshold: number = 3; // 连续失败次数阈值
  private alertCooldown: number = 60 * 60 * 1000; // 告警冷却时间（1小时）
  private lastAlerts: Map<string, Date> = new Map();

  /**
   * 检查是否需要发送告警
   * @param monitorId 监控配置 ID
   * @param consecutiveFailures 连续失败次数
   * @returns 是否需要告警
   */
  shouldAlert(monitorId: string, consecutiveFailures: number): boolean {
    if (consecutiveFailures < this.alertThreshold) {
      return false;
    }

    const lastAlert = this.lastAlerts.get(monitorId);
    if (lastAlert) {
      const timeSinceLastAlert = Date.now() - lastAlert.getTime();
      if (timeSinceLastAlert < this.alertCooldown) {
        return false;
      }
    }

    return true;
  }

  /**
   * 记录告警
   * @param monitorId 监控配置 ID
   * @param config 监控配置
   * @param error 错误信息
   */
  async recordAlert(monitorId: string, config: MonitorConfig, error: string): Promise<void> {
    try {
      this.lastAlerts.set(monitorId, new Date());

      console.error(`🚨 监控告警: ${config.name} (${config.url})`);
      console.error(`   错误信息: ${error}`);
      console.error(`   连续失败已达到阈值 (${this.alertThreshold} 次)`);

      // 这里可以扩展为发送邮件、短信、Webhook 等告警方式
      // 目前只记录到控制台和历史记录中
    } catch (alertError) {
      console.error('❌ 记录告警失败:', alertError);
    }
  }

  /**
   * 清除告警状态
   * @param monitorId 监控配置 ID
   */
  clearAlert(monitorId: string): void {
    this.lastAlerts.delete(monitorId);
  }
}

// 全局告警管理器实例
const alertManager = new MonitorAlertManager();

// ================================
// 应用启动和初始化
// ================================

async function startApplication(): Promise<void> {
  try {
    console.log('🚀 启动 CloudStudio 监控管理系统');

    // 初始化 KV 数据库
    await initKV();

    // 初始化默认配置
    await initializeDefaultConfig();

    // 执行维护任务
    await performMaintenance();

    console.log('✅ 系统初始化完成');

    // 启动监控调度器
    await monitorScheduler.start();

    // 启动 HTTP 服务器
    const port = parseInt(Deno.env.get('PORT') || '8000');
    console.log(`🌐 Web 管理界面: http://localhost:${port}`);
    console.log('监控调度器已启动，将根据配置定期执行监控任务');
    console.log('按 Ctrl+C 停止\n');

    // 设置定期维护任务（每小时执行一次）
    setInterval(performMaintenance, 60 * 60 * 1000);

    // 启动 HTTP 服务器（这会阻塞主线程）
    await startHttpServer(port);
  } catch (error) {
    console.error('❌ 应用启动失败:', error);
    Deno.exit(1);
  }
}

// 检查是否在测试模式
const isTestMode = Deno.args.includes('--test');

if (isTestMode) {
  console.log('🧪 测试模式：运行基本健康检查');
  try {
    await ensureKV();
    console.log('✅ 数据库连接正常');
    console.log('✅ 应用启动就绪');
  } catch (error) {
    console.error('❌ 健康检查失败:', error);
    Deno.exit(1);
  }
} else {
  startApplication();
}
