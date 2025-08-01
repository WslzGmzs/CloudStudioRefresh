/**
 * 认证相关数据模型和接口定义
 */

/**
 * 会话接口
 */
export interface Session {
  /** 会话 ID */
  id: string;
  /** 是否已认证 */
  authenticated: boolean;
  /** 过期时间 */
  expires: Date;
  /** 创建时间 */
  createdAt: Date;
  /** 最后访问时间 */
  lastAccessAt: Date;
  /** 用户IP地址 */
  ipAddress?: string;
  /** 用户代理 */
  userAgent?: string;
}

/**
 * 登录请求接口
 */
export interface LoginRequest {
  /** 密码 */
  password: string;
}

/**
 * 登录尝试记录
 */
export interface LoginAttempt {
  /** IP地址 */
  ip: string;
  /** 时间戳 */
  timestamp: Date;
  /** 是否成功 */
  success: boolean;
  /** 用户代理 */
  userAgent?: string;
}

/**
 * 认证结果接口
 */
export interface AuthResult {
  /** 是否已认证 */
  authenticated: boolean;
  /** 会话信息 */
  session?: Session;
  /** 错误信息 */
  error?: string;
}

/**
 * 登录锁定信息
 */
export interface LoginLockout {
  /** IP地址 */
  ip: string;
  /** 锁定开始时间 */
  lockedAt: Date;
  /** 锁定结束时间 */
  lockedUntil: Date;
  /** 失败尝试次数 */
  attemptCount: number;
}
