/**
 * HTTP 响应工具函数
 */

import { HTTP_STATUS, DEFAULT_HEADERS, CORS_CONFIG } from '@/config/constants.ts';
import type { ApiResponse } from '@/models/system.ts';

/**
 * 创建 API 响应对象
 */
export const createApiResponse = <T>(
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
 * 创建 JSON 响应
 */
export const createJsonResponse = (
  data: any,
  status: number = HTTP_STATUS.OK,
  additionalHeaders: Record<string, string> = {}
): Response => {
  const headers = new Headers({
    ...DEFAULT_HEADERS,
    ...additionalHeaders,
  });

  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
};

/**
 * 创建 HTML 响应
 */
export const createHtmlResponse = (
  html: string,
  status: number = HTTP_STATUS.OK,
  additionalHeaders: Record<string, string> = {}
): Response => {
  const headers = new Headers({
    ...DEFAULT_HEADERS,
    'Content-Type': 'text/html; charset=utf-8',
    ...additionalHeaders,
  });

  return new Response(html, {
    status,
    headers,
  });
};

/**
 * 创建文本响应
 */
export const createTextResponse = (
  text: string,
  status: number = HTTP_STATUS.OK,
  additionalHeaders: Record<string, string> = {}
): Response => {
  const headers = new Headers({
    ...DEFAULT_HEADERS,
    'Content-Type': 'text/plain; charset=utf-8',
    ...additionalHeaders,
  });

  return new Response(text, {
    status,
    headers,
  });
};

/**
 * 创建重定向响应
 */
export const createRedirectResponse = (
  location: string,
  status: number = 302
): Response => {
  return new Response(null, {
    status,
    headers: {
      'Location': location,
    },
  });
};

/**
 * 创建 CORS 预检响应
 */
export const createCorsPreflightResponse = (
  origin?: string
): Response => {
  const headers = new Headers();

  if (origin && CORS_CONFIG.ALLOWED_ORIGINS.includes('*')) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else if (CORS_CONFIG.ALLOWED_ORIGINS.includes('*')) {
    headers.set('Access-Control-Allow-Origin', '*');
  }

  headers.set('Access-Control-Allow-Methods', CORS_CONFIG.ALLOWED_METHODS.join(', '));
  headers.set('Access-Control-Allow-Headers', CORS_CONFIG.ALLOWED_HEADERS.join(', '));
  headers.set('Access-Control-Max-Age', CORS_CONFIG.MAX_AGE.toString());

  return new Response(null, {
    status: HTTP_STATUS.NO_CONTENT,
    headers,
  });
};

/**
 * 添加 CORS 头到响应
 */
export const addCorsHeaders = (
  response: Response,
  origin?: string
): Response => {
  const headers = new Headers(response.headers);

  if (origin && CORS_CONFIG.ALLOWED_ORIGINS.includes('*')) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else if (CORS_CONFIG.ALLOWED_ORIGINS.includes('*')) {
    headers.set('Access-Control-Allow-Origin', '*');
  }

  headers.set('Access-Control-Allow-Methods', CORS_CONFIG.ALLOWED_METHODS.join(', '));
  headers.set('Access-Control-Allow-Headers', CORS_CONFIG.ALLOWED_HEADERS.join(', '));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

/**
 * 创建错误响应
 */
export const createErrorResponse = (
  error: string,
  status: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
  code?: number
): Response => {
  return createJsonResponse(
    createApiResponse(false, null, error, code),
    status
  );
};

/**
 * 创建成功响应
 */
export const createSuccessResponse = <T>(
  data: T,
  status: number = HTTP_STATUS.OK
): Response => {
  return createJsonResponse(
    createApiResponse(true, data),
    status
  );
};

/**
 * 创建分页响应
 */
export const createPaginatedResponse = <T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
  status: number = HTTP_STATUS.OK
): Response => {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  const paginatedData = {
    items,
    total,
    page,
    limit,
    totalPages,
    hasNext,
    hasPrev,
  };

  return createJsonResponse(
    createApiResponse(true, paginatedData),
    status
  );
};

/**
 * 创建文件响应
 */
export const createFileResponse = (
  content: string | Uint8Array,
  filename: string,
  mimeType: string = 'application/octet-stream'
): Response => {
  const headers = new Headers({
    'Content-Type': mimeType,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-cache',
  });

  return new Response(content, {
    status: HTTP_STATUS.OK,
    headers,
  });
};

/**
 * 创建 SSE 响应
 */
export const createSSEResponse = (): Response => {
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  return new Response(
    new ReadableStream({
      start(controller) {
        // SSE 连接建立
        controller.enqueue(new TextEncoder().encode('data: {"type":"connected"}\n\n'));
      },
    }),
    {
      status: HTTP_STATUS.OK,
      headers,
    }
  );
};
