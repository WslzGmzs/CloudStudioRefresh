/**
 * 认证相关 API 处理函数
 */

import { APP_CONFIG } from '@/config/app.ts';
import { HTTP_STATUS, ERROR_CODES } from '@/config/constants.ts';
import type { Session, LoginRequest, AuthResult } from '@/models/auth.ts';
import { kvService } from '@/services/kv.ts';
import { generateId, getClientIP, getUserAgent } from '@/utils/helpers.ts';
import { createJsonResponse, createApiResponse } from '@/utils/response.ts';

/**
 * 验证登录凭据
 */
function validateCredentials(password: string): boolean {
  return password === APP_CONFIG.LOGIN_PASSWORD;
}

/**
 * 验证会话是否有效
 */
function validateSession(session: Session): boolean {
  return session.authenticated && session.expires > new Date();
}

/**
 * 创建新会话
 */
function createSession(request: Request): Session {
  const now = new Date();
  const expires = new Date(now.getTime() + APP_CONFIG.SESSION_EXPIRE_HOURS * 60 * 60 * 1000);

  return {
    id: generateId(),
    authenticated: true,
    expires,
    createdAt: now,
    lastAccessAt: now,
    ipAddress: getClientIP(request),
    userAgent: getUserAgent(request),
  };
}

/**
 * 从请求中获取会话ID
 */
function getSessionIdFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').map(c => c.trim());
  const sessionCookie = cookies.find(c => c.startsWith('session='));
  
  if (sessionCookie) {
    return sessionCookie.split('=')[1];
  }

  return null;
}

/**
 * 设置会话Cookie
 */
function setSessionCookie(response: Response, sessionId: string): Response {
  const headers = new Headers(response.headers);
  const expires = new Date(Date.now() + APP_CONFIG.SESSION_EXPIRE_HOURS * 60 * 60 * 1000);
  
  headers.set(
    'Set-Cookie',
    `session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Expires=${expires.toUTCString()}`
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * 清除会话Cookie
 */
function clearSessionCookie(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set(
    'Set-Cookie',
    'session=; Path=/; HttpOnly; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * 处理登录 API
 */
export async function handleLoginAPI(request: Request): Promise<Response> {
  try {
    const body = await request.json() as LoginRequest;

    if (!body.password) {
      return createJsonResponse(
        createApiResponse(false, null, '密码不能为空', ERROR_CODES.VALIDATION_ERROR),
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    // 验证密码
    if (!validateCredentials(body.password)) {
      return createJsonResponse(
        createApiResponse(false, null, '密码错误', ERROR_CODES.AUTHENTICATION_FAILED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    // 创建新会话
    const session = createSession(request);
    
    // 保存会话到数据库
    const success = await kvService.saveSession(session);
    
    if (!success) {
      return createJsonResponse(
        createApiResponse(false, null, '会话创建失败', ERROR_CODES.DATABASE_ERROR),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    // 创建响应
    const response = createJsonResponse(
      createApiResponse(true, { sessionId: session.id }, '登录成功'),
    );

    // 设置会话Cookie
    return setSessionCookie(response, session.id);

  } catch (error) {
    console.error('❌ 登录错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '登录失败', ERROR_CODES.INTERNAL_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 处理登出 API
 */
export async function handleLogoutAPI(request: Request): Promise<Response> {
  try {
    const sessionId = getSessionIdFromRequest(request);
    
    if (sessionId) {
      // 删除会话
      await kvService.deleteSession(sessionId);
    }

    // 创建响应
    const response = createJsonResponse(
      createApiResponse(true, null, '登出成功'),
    );

    // 清除会话Cookie
    return clearSessionCookie(response);

  } catch (error) {
    console.error('❌ 登出错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '登出失败', ERROR_CODES.INTERNAL_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 检查认证状态
 */
export async function requireAuth(request: Request): Promise<AuthResult> {
  try {
    const sessionId = getSessionIdFromRequest(request);
    
    if (!sessionId) {
      return { authenticated: false, error: '未找到会话' };
    }

    const session = await kvService.getSession(sessionId);
    
    if (!session) {
      return { authenticated: false, error: '会话不存在' };
    }

    if (!validateSession(session)) {
      // 删除过期会话
      await kvService.deleteSession(sessionId);
      return { authenticated: false, error: '会话已过期' };
    }

    // 更新最后访问时间
    session.lastAccessAt = new Date();
    await kvService.saveSession(session);

    return { authenticated: true, session };

  } catch (error) {
    console.error('❌ 认证检查错误:', error);
    return { authenticated: false, error: '认证检查失败' };
  }
}

/**
 * 处理认证状态检查 API
 */
export async function handleAuthStatusAPI(request: Request): Promise<Response> {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(true, {
          authenticated: true,
          session: {
            id: authResult.session!.id,
            expires: authResult.session!.expires,
            lastAccessAt: authResult.session!.lastAccessAt,
          }
        }),
      );
    } else {
      return createJsonResponse(
        createApiResponse(false, { authenticated: false }, authResult.error),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

  } catch (error) {
    console.error('❌ 认证状态检查错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '认证状态检查失败', ERROR_CODES.INTERNAL_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}
