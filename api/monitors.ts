/**
 * 监控配置相关 API 处理函数
 */

import { HTTP_STATUS, ERROR_CODES } from '@/config/constants.ts';
import { APP_CONFIG } from '@/config/app.ts';
import type { MonitorConfig, MonitorConfigRequest } from '@/models/monitor.ts';
import { kvService } from '@/services/kv.ts';
import { globalCache, CacheUtils } from '@/services/cache.ts';
import { generateId, validateUrl, validateInterval } from '@/utils/helpers.ts';
import { createJsonResponse, createApiResponse } from '@/utils/response.ts';
import { requireAuth } from '@/api/auth.ts';

/**
 * 处理获取所有监控配置 API
 */
export async function handleGetMonitorsAPI(request: Request): Promise<Response> {
  try {
    // 检查认证
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    // 获取所有监控配置（使用缓存）
    const configs = await kvService.getAllMonitorConfigs();

    return createJsonResponse(
      createApiResponse(true, configs),
    );
  } catch (error) {
    console.error('❌ 获取监控配置错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '获取监控配置失败', ERROR_CODES.DATABASE_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 处理创建监控配置 API
 */
export async function handleCreateMonitorAPI(request: Request): Promise<Response> {
  try {
    // 检查认证
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
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

    // 验证 URL 格式
    if (!validateUrl(body.url)) {
      return createJsonResponse(
        createApiResponse(false, null, '无效的 URL 格式', ERROR_CODES.VALIDATION_ERROR),
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    // 验证监控间隔
    if (!validateInterval(body.interval || APP_CONFIG.DEFAULT_MONITOR_INTERVAL)) {
      return createJsonResponse(
        createApiResponse(false, null, '无效的监控间隔', ERROR_CODES.VALIDATION_ERROR),
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

    // 保存到数据库
    const success = await kvService.saveMonitorConfig(config);

    if (success) {
      // 清除相关缓存
      CacheUtils.clearByPrefix('all_monitor_configs');
      
      return createJsonResponse(
        createApiResponse(true, config, '监控配置创建成功'),
        HTTP_STATUS.CREATED,
      );
    } else {
      return createJsonResponse(
        createApiResponse(false, null, '监控配置创建失败', ERROR_CODES.DATABASE_ERROR),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  } catch (error) {
    console.error('❌ 创建监控配置错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '创建监控配置失败', ERROR_CODES.INTERNAL_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 处理更新监控配置 API
 */
export async function handleUpdateMonitorAPI(request: Request, id: string): Promise<Response> {
  try {
    // 检查认证
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    // 获取现有配置
    const existingConfig = await kvService.getMonitorConfig(id);
    if (!existingConfig) {
      return createJsonResponse(
        createApiResponse(false, null, '监控配置不存在', ERROR_CODES.RESOURCE_NOT_FOUND),
        HTTP_STATUS.NOT_FOUND,
      );
    }

    // 解析请求体
    const body = await request.json() as Partial<MonitorConfigRequest>;

    // 验证字段
    if (body.url && !validateUrl(body.url)) {
      return createJsonResponse(
        createApiResponse(false, null, '无效的 URL 格式', ERROR_CODES.VALIDATION_ERROR),
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    if (body.interval && !validateInterval(body.interval)) {
      return createJsonResponse(
        createApiResponse(false, null, '无效的监控间隔', ERROR_CODES.VALIDATION_ERROR),
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    // 更新配置
    const updatedConfig: MonitorConfig = {
      ...existingConfig,
      name: body.name || existingConfig.name,
      url: body.url || existingConfig.url,
      cookie: body.cookie !== undefined ? body.cookie : existingConfig.cookie,
      headers: body.headers || existingConfig.headers,
      method: body.method || existingConfig.method,
      interval: body.interval || existingConfig.interval,
      enabled: body.enabled !== undefined ? body.enabled : existingConfig.enabled,
      updatedAt: new Date(),
    };

    // 保存到数据库
    const success = await kvService.saveMonitorConfig(updatedConfig);

    if (success) {
      // 清除相关缓存
      CacheUtils.clearByPrefix('all_monitor_configs');
      
      return createJsonResponse(
        createApiResponse(true, updatedConfig, '监控配置更新成功'),
      );
    } else {
      return createJsonResponse(
        createApiResponse(false, null, '监控配置更新失败', ERROR_CODES.DATABASE_ERROR),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  } catch (error) {
    console.error('❌ 更新监控配置错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '更新监控配置失败', ERROR_CODES.INTERNAL_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 处理删除监控配置 API
 */
export async function handleDeleteMonitorAPI(request: Request, id: string): Promise<Response> {
  try {
    // 检查认证
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    // 检查配置是否存在
    const existingConfig = await kvService.getMonitorConfig(id);
    if (!existingConfig) {
      return createJsonResponse(
        createApiResponse(false, null, '监控配置不存在', ERROR_CODES.RESOURCE_NOT_FOUND),
        HTTP_STATUS.NOT_FOUND,
      );
    }

    // 删除配置
    const success = await kvService.deleteMonitorConfig(id);

    if (success) {
      // 清除相关缓存
      CacheUtils.clearByPrefix('all_monitor_configs');
      
      return createJsonResponse(
        createApiResponse(true, null, '监控配置删除成功'),
      );
    } else {
      return createJsonResponse(
        createApiResponse(false, null, '监控配置删除失败', ERROR_CODES.DATABASE_ERROR),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  } catch (error) {
    console.error('❌ 删除监控配置错误:', error);
    return createJsonResponse(
      createApiResponse(false, null, '删除监控配置失败', ERROR_CODES.INTERNAL_ERROR),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * 处理获取监控状态 API
 */
export async function handleMonitorStatusAPI(request: Request): Promise<Response> {
  try {
    // 检查认证
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return createJsonResponse(
        createApiResponse(false, null, '未认证', ERROR_CODES.UNAUTHORIZED),
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    const configs = await kvService.getAllMonitorConfigs();
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
