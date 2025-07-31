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

// ================================
// 数据库操作
// ================================

async function initKV(): Promise<void> {
  try {
    kv = await Deno.openKv();
    console.log('✅ Deno KV 数据库连接成功');
  } catch (error) {
    console.error('❌ Deno KV 数据库连接失败:', error);
    throw error;
  }
}

async function ensureKV(): Promise<Deno.Kv> {
  if (!kv) {
    await initKV();
  }
  return kv;
}

// ================================
// 监控执行引擎
// ================================

async function executeMonitor(config: MonitorConfig, retryCount: number = 0): Promise<MonitorResult> {
  const startTime = Date.now();

  try {
    log(LogLevel.INFO, `开始监控: ${config.name} (${config.url})`, config.id, config.name);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), APP_CONFIG.REQUEST_TIMEOUT);

    const headers: Record<string, string> = {
      'User-Agent': 'CloudStudio-Monitor/1.0',
    };

    if (config.cookie) {
      headers['Cookie'] = config.cookie;
    }

    const response = await fetch(config.url, {
      method: config.method,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      log(LogLevel.INFO, `监控成功: ${config.name} (${responseTime}ms)`, config.id, config.name, {
        responseTime,
        httpStatus: response.status,
        url: config.url,
      });

      const result = createMonitorResult(true, responseTime, response.status);
      await saveMonitorHistory({
        id: generateId(),
        monitorId: config.id,
        result,
        timestamp: new Date(),
      });
      return result;
    } else {
      const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      log(LogLevel.ERROR, `监控失败: ${config.name} - ${errorMsg}`, config.id, config.name, {
        responseTime,
        httpStatus: response.status,
        url: config.url,
        error: errorMsg,
      });

      const result = createMonitorResult(false, responseTime, response.status, errorMsg);
      await saveMonitorHistory({
        id: generateId(),
        monitorId: config.id,
        result,
        timestamp: new Date(),
      });
      return result;
    }

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMsg = (error as Error).message;

    if (retryCount < 2 && !errorMsg.includes('AbortError')) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return executeMonitor(config, retryCount + 1);
    }

    log(LogLevel.ERROR, `监控异常: ${config.name} - ${errorMsg}`, config.id, config.name, {
      responseTime,
      error: errorMsg,
      retryCount,
    });

    const result = createMonitorResult(false, responseTime, undefined, errorMsg);
    await saveMonitorHistory({
      id: generateId(),
      monitorId: config.id,
      result,
      timestamp: new Date(),
    });
    return result;
  }
}

async function executeMonitorBatch(configs: MonitorConfig[]): Promise<MonitorResult[]> {
  const batchSize = Math.min(APP_CONFIG.MAX_CONCURRENT_MONITORS, configs.length);
  const results: MonitorResult[] = [];

  for (let i = 0; i < configs.length; i += batchSize) {
    const batch = configs.slice(i, i + batchSize);
    console.log(`🔄 执行批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(configs.length / batchSize)} (${batch.length} 个任务)`);

    const batchPromises = batch.map(config => executeMonitor(config));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    if (i + batchSize < configs.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  console.log(`监控任务完成: 成功 ${successCount} 个，失败 ${failureCount} 个`);

  return results;
}

// ================================
// 监控配置管理
// ================================

async function saveMonitorConfig(config: MonitorConfig): Promise<boolean> {
  try {
    const db = await ensureKV();

    if (!config.id || !config.name || !config.url) {
      throw new Error('监控配置缺少必要字段');
    }

    if (!validateUrl(config.url)) {
      throw new Error('无效的 URL');
    }

    if (!validateInterval(config.interval)) {
      throw new Error('无效的监控间隔');
    }

    config.updatedAt = new Date();
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

async function getAllMonitorConfigs(): Promise<MonitorConfig[]> {
  try {
    const db = await ensureKV();
    const configs: MonitorConfig[] = [];
    const iter = db.list<MonitorConfig>({ prefix: [KV_KEYS.MONITORS] });

    for await (const entry of iter) {
      if (entry.value) {
        const config = entry.value;
        config.createdAt = new Date(config.createdAt);
        config.updatedAt = new Date(config.updatedAt);
        configs.push(config);
      }
    }

    return configs.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('❌ 获取所有监控配置时发生错误:', error);
    return [];
  }
}

async function getMonitorConfig(id: string): Promise<MonitorConfig | null> {
  try {
    const db = await ensureKV();
    const key = [KV_KEYS.MONITORS, id];
    const result = await db.get<MonitorConfig>(key);

    if (result.value) {
      const config = result.value;
      config.createdAt = new Date(config.createdAt);
      config.updatedAt = new Date(config.updatedAt);
      return config;
    }

    return null;
  } catch (error) {
    console.error(`❌ 获取监控配置时发生错误 (${id}):`, error);
    return null;
  }
}

async function deleteMonitorConfig(id: string): Promise<boolean> {
  try {
    const db = await ensureKV();
    const key = [KV_KEYS.MONITORS, id];
    await db.delete(key);
    console.log(`✅ 监控配置已删除: ${id}`);
    return true;
  } catch (error) {
    console.error(`❌ 删除监控配置时发生错误 (${id}):`, error);
    return false;
  }
}

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

async function getMonitorHistory(monitorId: string, limit: number = 50): Promise<MonitorHistory[]> {
  try {
    const db = await ensureKV();
    const history: MonitorHistory[] = [];
    const iter = db.list<MonitorHistory>({ prefix: [KV_KEYS.HISTORY, monitorId] });

    for await (const entry of iter) {
      if (entry.value) {
        const record = entry.value;
        record.timestamp = new Date(record.timestamp);
        record.result.timestamp = new Date(record.result.timestamp);
        history.push(record);

        if (history.length >= limit) break;
      }
    }

    return history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  } catch (error) {
    console.error(`❌ 获取监控历史记录时发生错误 (${monitorId}):`, error);
    return [];
  }
}

// ================================
// 身份验证和会话管理
// ================================

function validateCredentials(password: string): boolean {
  return password === APP_CONFIG.LOGIN_PASSWORD;
}

async function createAuthSession(sessionId: string): Promise<Session | null> {
  try {
    const db = await ensureKV();
    const session: Session = {
      id: sessionId,
      userId: 'admin',
      expires: new Date(Date.now() + APP_CONFIG.SESSION_EXPIRE_HOURS * 60 * 60 * 1000),
      createdAt: new Date(),
    };

    const key = [KV_KEYS.SESSIONS, sessionId];
    const result = await db.set(key, session);

    return result.ok ? session : null;
  } catch (error) {
    console.error('❌ 创建会话时发生错误:', error);
    return null;
  }
}

async function getSession(sessionId: string): Promise<Session | null> {
  try {
    const db = await ensureKV();
    const key = [KV_KEYS.SESSIONS, sessionId];
    const result = await db.get<Session>(key);

    if (result.value) {
      const session = result.value;
      session.expires = new Date(session.expires);
      session.createdAt = new Date(session.createdAt);

      if (session.expires > new Date()) {
        return session;
      } else {
        await db.delete(key);
      }
    }

    return null;
  } catch (error) {
    console.error('❌ 获取会话时发生错误:', error);
    return null;
  }
}

async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    const db = await ensureKV();
    const key = [KV_KEYS.SESSIONS, sessionId];
    await db.delete(key);
    return true;
  } catch (error) {
    console.error('❌ 删除会话时发生错误:', error);
    return false;
  }
}

async function requireAuth(request: Request): Promise<{ authenticated: boolean; session?: Session }> {
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) {
    return { authenticated: false };
  }

  const session = await getSession(sessionId);
  if (!session) {
    return { authenticated: false };
  }

  return { authenticated: true, session };
}

async function recordLoginAttempt(ip: string, success: boolean): Promise<void> {
  try {
    const db = await ensureKV();
    const attempt: LoginAttempt = {
      ip,
      timestamp: new Date(),
      success,
    };

    const key = [KV_KEYS.LOGIN_ATTEMPTS, ip, Date.now().toString()];
    await db.set(key, attempt);
  } catch (error) {
    console.error('❌ 记录登录尝试时发生错误:', error);
  }
}

async function checkLoginAttempts(ip: string): Promise<boolean> {
  try {
    const db = await ensureKV();
    const cutoffTime = new Date(Date.now() - APP_CONFIG.LOGIN_LOCKOUT_MINUTES * 60 * 1000);
    let failedAttempts = 0;

    const iter = db.list<LoginAttempt>({ prefix: [KV_KEYS.LOGIN_ATTEMPTS, ip] });

    for await (const entry of iter) {
      if (entry.value) {
        const attempt = entry.value;
        attempt.timestamp = new Date(attempt.timestamp);

        if (attempt.timestamp > cutoffTime && !attempt.success) {
          failedAttempts++;
        }
      }
    }

    return failedAttempts < APP_CONFIG.MAX_LOGIN_ATTEMPTS;
  } catch (error) {
    console.error('❌ 检查登录尝试时发生错误:', error);
    return true;
  }
}

async function handleLogin(password: string, ip: string): Promise<{
  success: boolean;
  sessionId?: string;
  error?: string;
}> {
  try {
    const canAttempt = await checkLoginAttempts(ip);
    if (!canAttempt) {
      await recordLoginAttempt(ip, false);
      return { success: false, error: '登录尝试过于频繁，请稍后再试' };
    }

    const isValid = validateCredentials(password);

    if (isValid) {
      const sessionId = generateSessionId();
      const session = await createAuthSession(sessionId);

      if (session) {
        await recordLoginAttempt(ip, true);
        console.log(`✅ 用户登录成功 (IP: ${ip}, Session: ${sessionId})`);
        return { success: true, sessionId };
      } else {
        return { success: false, error: '会话创建失败' };
      }
    } else {
      await recordLoginAttempt(ip, false);
      console.warn(`⚠️ 用户登录失败 - 密码错误 (IP: ${ip})`);
      return { success: false, error: '密码错误' };
    }
  } catch (error) {
    console.error(`❌ 处理登录时发生错误:`, error);
    return { success: false, error: '登录处理失败' };
  }
}

async function handleLogout(request: Request): Promise<boolean> {
  try {
    const sessionId = getSessionIdFromRequest(request);
    if (sessionId) {
      await deleteSession(sessionId);
    }
    return true;
  } catch (error) {
    console.error('❌ 处理登出时发生错误:', error);
    return false;
  }
}

// ================================
// 维护任务
// ================================

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

    return cleanedCount;
  } catch (error) {
    console.error('清理过期会话失败:', error);
    return 0;
  }
}

async function cleanupOldHistory(): Promise<number> {
  try {
    const db = await ensureKV();
    const cutoffDate = new Date(Date.now() - APP_CONFIG.HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
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

    return cleanedCount;
  } catch (error) {
    console.error('清理过期历史记录失败:', error);
    return 0;
  }
}

async function cleanupOldSystemLogs(): Promise<number> {
  try {
    const db = await ensureKV();
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7天
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

    return cleanedCount;
  } catch (error) {
    console.error('清理过期系统日志失败:', error);
    return 0;
  }
}

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
// 监控调度器
// ================================

class MonitorScheduler {
  private isRunning: boolean = false;
  private executionCount: number = 0;
  private lastExecutionTime: Date | null = null;
  private cronJob: unknown = null;

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ 监控调度器已在运行');
      return;
    }

    try {
      console.log('🚀 启动监控任务调度器');
      this.isRunning = true;

      if (typeof Deno.cron !== 'undefined') {
        this.cronJob = Deno.cron('monitor-scheduler', '* * * * *', () => {
          this.executeMonitorCycle();
        });
      } else {
        setInterval(() => {
          this.executeMonitorCycle();
        }, 60000);
      }

      console.log('✅ 监控调度器启动成功');
    } catch (error) {
      console.error('❌ 监控调度器启动失败:', error);
      this.isRunning = false;
      throw error;
    }
  }

  stop(): void {
    if (!this.isRunning) {
      console.log('⚠️ 监控调度器未在运行');
      return;
    }

    console.log('🛑 停止监控调度器');
    this.isRunning = false;
    this.cronJob = null;
    console.log('✅ 监控调度器已停止');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      executionCount: this.executionCount,
      lastExecutionTime: this.lastExecutionTime,
    };
  }

  private async executeMonitorCycle(): Promise<void> {
    if (!this.isRunning) return;

    try {
      this.lastExecutionTime = new Date();
      this.executionCount++;

      console.log(`\n🔄 开始第 ${this.executionCount} 次监控周期 [${this.lastExecutionTime.toISOString()}]`);

      const configs = await getAllMonitorConfigs();
      const enabledConfigs = configs.filter(config => config.enabled);

      if (enabledConfigs.length === 0) {
        console.log('📝 没有启用的监控配置，跳过本次执行');
        return;
      }

      console.log(`📊 发现 ${enabledConfigs.length} 个启用的监控配置`);

      const results = await executeMonitorBatch(enabledConfigs);
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      console.log(`✅ 监控周期完成: 成功 ${successCount} 个，失败 ${failureCount} 个\n`);

    } catch (error) {
      console.error('❌ 监控周期执行失败:', error);
    }
  }
}

const monitorScheduler = new MonitorScheduler();

// ================================
// Web 界面
// ================================

async function handleLoginPage(request: Request): Promise<Response> {
  const authResult = await requireAuth(request);
  if (authResult.authenticated) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/dashboard' },
    });
  }

  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>CloudStudio 监控管理系统 - 登录</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}.login-container{background:white;border-radius:12px;box-shadow:0 20px 40px rgba(0,0,0,0.1);padding:40px;width:100%;max-width:400px;text-align:center}.logo{margin-bottom:30px}.logo h1{color:#333;font-size:2rem;margin-bottom:10px}.logo p{color:#666;font-size:1rem}.form-group{margin-bottom:20px;text-align:left}.form-group label{display:block;margin-bottom:8px;color:#333;font-weight:500}.form-group input{width:100%;padding:12px;border:2px solid #e1e5e9;border-radius:8px;font-size:1rem;transition:border-color 0.3s}.form-group input:focus{outline:none;border-color:#667eea}.btn{width:100%;padding:12px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;border-radius:8px;font-size:1rem;cursor:pointer;transition:transform 0.2s}.btn:hover{transform:translateY(-2px)}.error{color:#e74c3c;text-align:center;margin-top:15px;font-size:0.9rem}</style></head><body><div class="login-container"><div class="logo"><h1>🚀 CloudStudio 监控</h1><p>监控管理系统</p></div><form id="loginForm"><div class="form-group"><label for="password">管理员密码</label><input type="password" id="password" name="password" required></div><button type="submit" class="btn">登录</button><div id="error" class="error"></div></form></div><script>document.getElementById('loginForm').addEventListener('submit',async(e)=>{e.preventDefault();const password=document.getElementById('password').value;const errorDiv=document.getElementById('error');try{const response=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});const result=await response.json();if(result.success){document.cookie=\`session=\${result.data.sessionId}; path=/; max-age=86400\`;window.location.href='/dashboard'}else{errorDiv.textContent=result.message||'登录失败'}}catch(error){errorDiv.textContent='网络错误，请重试'}});</script></body></html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function handleDashboard(request: Request): Promise<Response> {
  const authResult = await requireAuth(request);
  if (!authResult.authenticated) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/' },
    });
  }

  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>CloudStudio 监控管理系统 - 仪表板</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f7fa;color:#333;line-height:1.6}.header{background:white;box-shadow:0 2px 4px rgba(0,0,0,0.1);padding:1rem 2rem;display:flex;justify-content:space-between;align-items:center}.logo{font-size:1.5rem;font-weight:bold;color:#667eea}.nav-menu{display:flex;gap:1rem}.nav-btn{background:none;border:none;color:#666;cursor:pointer;padding:0.5rem 1rem;border-radius:4px;transition:background 0.2s}.nav-btn:hover{background:#f0f0f0}.logout-btn{background:#e74c3c;color:white;border:none;padding:0.5rem 1rem;border-radius:4px;cursor:pointer}.container{max-width:1200px;margin:2rem auto;padding:0 2rem}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem;margin-bottom:2rem}.stat-card{background:white;padding:1.5rem;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1)}.stat-card h3{color:#666;font-size:0.9rem;margin-bottom:0.5rem}.stat-card .value{font-size:2rem;font-weight:bold;color:#333}.monitors{background:white;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);padding:1.5rem}.monitors h2{margin-bottom:1rem;color:#333}.add-btn{background:#667eea;color:white;border:none;padding:0.75rem 1.5rem;border-radius:6px;cursor:pointer;margin-bottom:1rem}.monitor-item{display:flex;justify-content:space-between;align-items:center;padding:1rem;border:1px solid #e1e5e9;border-radius:6px;margin-bottom:0.5rem}.monitor-info h4{color:#333;margin-bottom:0.25rem}.monitor-info p{color:#666;font-size:0.9rem}.monitor-actions{display:flex;gap:0.5rem}.action-btn{padding:0.5rem 1rem;border:none;border-radius:4px;cursor:pointer;font-size:0.8rem}.toggle-btn{background:#28a745;color:white}.toggle-btn.disabled{background:#6c757d}.edit-btn{background:#ffc107;color:#333}.delete-btn{background:#dc3545;color:white}.status{padding:0.25rem 0.75rem;border-radius:20px;font-size:0.8rem;font-weight:500}.status.online{background:#d4edda;color:#155724}.status.offline{background:#f8d7da;color:#721c24}.loading{text-align:center;padding:2rem;color:#666}</style></head><body><div class="header"><div class="logo">🚀 CloudStudio 监控仪表板</div><div class="nav-menu"><button class="logout-btn" onclick="logout()">登出</button></div></div><div class="container"><div class="stats"><div class="stat-card"><h3>总监控数</h3><div class="value" id="totalMonitors">-</div></div><div class="stat-card"><h3>在线监控</h3><div class="value" id="onlineMonitors">-</div></div><div class="stat-card"><h3>系统状态</h3><div class="value" id="systemStatus">-</div></div></div><div class="monitors"><h2>监控列表</h2><button class="add-btn" onclick="addMonitor()">添加监控</button><div id="monitorsList" class="loading">加载中...</div></div></div><script>async function loadData(){try{const[monitorsRes,statusRes]=await Promise.all([fetch('/api/monitors'),fetch('/api/monitors/status')]);const monitors=await monitorsRes.json();const status=await statusRes.json();if(monitors.success){updateStats(monitors.data,status.data);renderMonitors(monitors.data)}}catch(error){document.getElementById('monitorsList').innerHTML='加载失败'}}function updateStats(monitors,status){document.getElementById('totalMonitors').textContent=monitors.length;document.getElementById('onlineMonitors').textContent=monitors.filter(m=>m.enabled).length;document.getElementById('systemStatus').textContent='正常'}function renderMonitors(monitors){const container=document.getElementById('monitorsList');if(monitors.length===0){container.innerHTML='<p>暂无监控配置</p>';return}container.innerHTML=monitors.map(monitor=>\`<div class="monitor-item"><div class="monitor-info"><h4>\${monitor.name}</h4><p>\${monitor.url}</p></div><div class="monitor-status"><div class="status \${monitor.enabled?'online':'offline'}">\${monitor.enabled?'在线':'离线'}</div><div class="monitor-actions"><button class="action-btn toggle-btn \${monitor.enabled?'':'disabled'}" onclick="toggleMonitor('\${monitor.id}',\${!monitor.enabled})">\${monitor.enabled?'禁用':'启用'}</button><button class="action-btn edit-btn" onclick="editMonitor('\${monitor.id}')">编辑</button><button class="action-btn delete-btn" onclick="deleteMonitor('\${monitor.id}')">删除</button></div></div></div>\`).join('')}async function toggleMonitor(id,enabled){try{const response=await fetch(\`/api/monitors/\${id}/toggle\`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled})});if(response.ok){loadData()}}catch(error){alert('操作失败')}}async function deleteMonitor(id){if(confirm('确定要删除这个监控配置吗？')){try{const response=await fetch(\`/api/monitors/\${id}\`,{method:'DELETE'});if(response.ok){loadData()}}catch(error){alert('删除失败')}}}function addMonitor(){alert('添加监控功能开发中')}function editMonitor(id){alert('编辑监控功能开发中')}async function logout(){try{await fetch('/api/logout',{method:'POST'});document.cookie='session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';window.location.href='/'}catch(error){console.error('登出失败:',error)}}loadData();setInterval(loadData,30000);</script></body></html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// ================================
// API 处理函数
// ================================

async function handleLoginAPI(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return createJsonResponse(
        createApiResponse(false, null, '密码不能为空', ERROR_CODES.VALIDATION_ERROR),
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const ip = getClientIP(request);
    const result = await handleLogin(password, ip);

    if (result.success) {
      return createJsonResponse(
        createApiResponse(true, { sessionId: result.sessionId }),
      );
    } else {
      return createJsonResponse(
        createApiResponse(false, null, result.error, ERROR_CODES.INVALID_PASSWORD),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }
  } catch (error) {
    console.error('❌ 登录 API 错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '请求处理失败', ERROR_CODES.VALIDATION_ERROR),
      HTTP_STATUS.BAD_REQUEST,
    );
  }
}

async function handleLogoutAPI(request: Request): Promise<Response> {
  try {
    await handleLogout(request);
    return createJsonResponse(
      createApiResponse(true, { message: '登出成功' }),
    );
  } catch (error) {
    console.error('❌ 登出 API 错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '登出失败', ERROR_CODES.NETWORK_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

async function handleAuthCheckAPI(request: Request): Promise<Response> {
  try {
    const authResult = await requireAuth(request);
    return createJsonResponse(
      createApiResponse(true, { authenticated: authResult.authenticated }),
    );
  } catch (error) {
    console.error('❌ 认证检查 API 错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '认证检查失败', ERROR_CODES.NETWORK_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

async function handleMonitorsListAPI(request: Request): Promise<Response> {
  try {
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
    console.error('❌ 获取监控列表错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '获取监控列表失败', ERROR_CODES.DATABASE_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

async function handleMonitorsCreateAPI(request: Request): Promise<Response> {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    if (!checkCSRF(request)) {
      return createJsonResponse(
        createApiResponse(false, null, 'CSRF 检查失败', ERROR_CODES.VALIDATION_ERROR),
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const body = await request.json();
    const { name, url, cookie, method, interval, enabled } = body;

    if (!name || !url) {
      return createJsonResponse(
        createApiResponse(false, null, '名称和URL不能为空', ERROR_CODES.VALIDATION_ERROR),
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const config: MonitorConfig = {
      id: generateId(),
      name,
      url,
      cookie: cookie || '',
      method: method || 'GET',
      interval: interval || APP_CONFIG.DEFAULT_MONITOR_INTERVAL,
      enabled: enabled !== false,
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
      createApiResponse(false, null, '创建监控配置失败', ERROR_CODES.VALIDATION_ERROR),
      HTTP_STATUS.BAD_REQUEST,
    );
  }
}

async function handleMonitorsUpdateAPI(request: Request, id: string): Promise<Response> {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    if (!checkCSRF(request)) {
      return createJsonResponse(
        createApiResponse(false, null, 'CSRF 检查失败', ERROR_CODES.VALIDATION_ERROR),
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const existingConfig = await getMonitorConfig(id);
    if (!existingConfig) {
      return createJsonResponse(
        createApiResponse(false, null, '监控配置不存在', ERROR_CODES.MONITOR_NOT_FOUND),
        HTTP_STATUS.NOT_FOUND,
      );
    }

    const body = await request.json();
    const updatedConfig = { ...existingConfig, ...body, id, updatedAt: new Date() };

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
      createApiResponse(false, null, '更新监控配置失败', ERROR_CODES.VALIDATION_ERROR),
      HTTP_STATUS.BAD_REQUEST,
    );
  }
}

async function handleMonitorsDeleteAPI(request: Request, id: string): Promise<Response> {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    if (!checkCSRF(request)) {
      return createJsonResponse(
        createApiResponse(false, null, 'CSRF 检查失败', ERROR_CODES.VALIDATION_ERROR),
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const success = await deleteMonitorConfig(id);
    if (success) {
      return createJsonResponse(
        createApiResponse(true, { message: '监控配置已删除' }),
      );
    } else {
      return createJsonResponse(
        createApiResponse(false, null, '删除监控配置失败', ERROR_CODES.DATABASE_ERROR),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  } catch (error) {
    console.error('❌ 删除监控配置错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '删除监控配置失败', ERROR_CODES.VALIDATION_ERROR),
      HTTP_STATUS.BAD_REQUEST,
    );
  }
}

async function handleMonitorsToggleAPI(request: Request, id: string): Promise<Response> {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    if (!checkCSRF(request)) {
      return createJsonResponse(
        createApiResponse(false, null, 'CSRF 检查失败', ERROR_CODES.VALIDATION_ERROR),
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const existingConfig = await getMonitorConfig(id);
    if (!existingConfig) {
      return createJsonResponse(
        createApiResponse(false, null, '监控配置不存在', ERROR_CODES.MONITOR_NOT_FOUND),
        HTTP_STATUS.NOT_FOUND,
      );
    }

    const body = await request.json();
    const { enabled } = body;

    const updatedConfig = { ...existingConfig, enabled, updatedAt: new Date() };

    const success = await saveMonitorConfig(updatedConfig);
    if (success) {
      return createJsonResponse(
        createApiResponse(true, updatedConfig),
      );
    } else {
      return createJsonResponse(
        createApiResponse(false, null, '切换监控状态失败', ERROR_CODES.DATABASE_ERROR),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  } catch (error) {
    console.error('❌ 切换监控状态错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '切换监控状态失败', ERROR_CODES.VALIDATION_ERROR),
      HTTP_STATUS.BAD_REQUEST,
    );
  }
}

async function handleMonitorsStatusAPI(request: Request): Promise<Response> {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    const configs = await getAllMonitorConfigs();
    const status = {
      total: configs.length,
      enabled: configs.filter(c => c.enabled).length,
      disabled: configs.filter(c => !c.enabled).length,
    };

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

async function handleSystemInfoAPI(_request: Request): Promise<Response> {
  try {
    const configs = await getAllMonitorConfigs();
    const schedulerStatus = monitorScheduler.getStatus();

    const info = {
      version: '1.0.1',
      totalMonitors: configs.length,
      enabledMonitors: configs.filter(c => c.enabled).length,
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

// ================================
// HTTP 服务器和路由
// ================================

function parseRequest(request: Request): { path: string; method: string; url: URL } {
  const url = new URL(request.url);
  return {
    path: url.pathname,
    method: request.method,
    url,
  };
}

function handleCORS(_request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

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

function logRequest(request: Request, response: Response, startTime: number): void {
  const { path, method } = parseRequest(request);
  const ip = getClientIP(request);
  const duration = Date.now() - startTime;
  const status = response.status;

  console.log(`${method} ${path} - ${status} - ${duration}ms - IP: ${ip}`);
}

async function routeHandler(request: Request): Promise<Response> {
  try {
    const { path, method } = parseRequest(request);

    if (method === 'OPTIONS') {
      return handleCORS(request);
    }

    if (method === 'GET') {
      switch (path) {
        case '/':
          return await handleLoginPage(request);
        case '/dashboard':
          return await handleDashboard(request);
      }
    }

    if (path.startsWith('/api/')) {
      switch (true) {
        case method === 'POST' && path === '/api/login':
          return await handleLoginAPI(request);
        case method === 'POST' && path === '/api/logout':
          return await handleLogoutAPI(request);
        case method === 'GET' && path === '/api/auth/check':
          return await handleAuthCheckAPI(request);
        case method === 'GET' && path === '/api/monitors':
          return await handleMonitorsListAPI(request);
        case method === 'POST' && path === '/api/monitors':
          return await handleMonitorsCreateAPI(request);
        case method === 'GET' && path === '/api/monitors/status':
          return await handleMonitorsStatusAPI(request);
        case method === 'GET' && path === '/api/system/info':
          return await handleSystemInfoAPI(request);
        case method === 'PUT' && path.startsWith('/api/monitors/') && !path.includes('/toggle'):
          const updateId = parseRouteParams(path, '/api/monitors/:id').id;
          return await handleMonitorsUpdateAPI(request, updateId);
        case method === 'DELETE' && path.startsWith('/api/monitors/'):
          const deleteId = parseRouteParams(path, '/api/monitors/:id').id;
          return await handleMonitorsDeleteAPI(request, deleteId);
        case method === 'POST' && path.includes('/toggle'):
          const toggleId = parseRouteParams(path, '/api/monitors/:id/toggle').id;
          return await handleMonitorsToggleAPI(request, toggleId);
      }
    }

    return createJsonResponse(
      createApiResponse(false, null, '页面不存在', ERROR_CODES.NOT_FOUND),
      HTTP_STATUS.NOT_FOUND,
    );

  } catch (error) {
    return handleError(error as Error, request);
  }
}

async function startHttpServer(port: number = 8000): Promise<void> {
  try {
    console.log(`🌐 启动 HTTP 服务器，端口: ${port}`);

    const abortController = new AbortController();

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
// 应用初始化和启动
// ================================

async function initializeDefaultConfig(): Promise<void> {
  try {
    const existingConfigs = await getAllMonitorConfigs();

    if (existingConfigs.length === 0) {
      console.log('🔄 初始化默认监控配置...');

      const defaultConfig: MonitorConfig = {
        id: 'default-cloudstudio',
        name: 'CloudStudio 默认监控',
        url: 'https://cloudstudio.net/a/26783234094321664/edit',
        cookie: 'cloudstudio-editor-session=your-cookie-here',
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

async function startApplication(): Promise<void> {
  try {
    console.log('🚀 启动 CloudStudio 监控管理系统');

    await initKV();
    await initializeDefaultConfig();
    await performMaintenance();

    console.log('✅ 系统初始化完成');

    await monitorScheduler.start();

    const port = parseInt(Deno.env.get('PORT') || '8000');
    console.log(`🌐 Web 管理界面: http://localhost:${port}`);
    console.log('监控调度器已启动，将根据配置定期执行监控任务');
    console.log('按 Ctrl+C 停止\n');

    setInterval(performMaintenance, 60 * 60 * 1000);

    await startHttpServer(port);
  } catch (error) {
    console.error('❌ 应用启动失败:', error);
    Deno.exit(1);
  }
}

startApplication();
