/**
 * Deno KV 数据库服务
 */

import { KV_KEYS } from '@/config/constants.ts';
import type { MonitorConfig, MonitorHistory } from '@/models/monitor.ts';
import type { Session, LoginAttempt } from '@/models/auth.ts';
import type { SystemLog } from '@/models/system.ts';

/**
 * KV 数据库管理器
 */
export class KVService {
  private static instance: KVService;
  private kv: Deno.Kv | null = null;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): KVService {
    if (!KVService.instance) {
      KVService.instance = new KVService();
    }
    return KVService.instance;
  }

  /**
   * 初始化 KV 数据库连接
   */
  async initialize(): Promise<void> {
    if (this.kv) {
      return;
    }

    try {
      this.kv = await Deno.openKv();
      console.log('✅ KV 数据库连接成功');
    } catch (error) {
      console.error('❌ KV 数据库连接失败:', error);
      throw error;
    }
  }

  /**
   * 获取 KV 实例
   */
  async getKV(): Promise<Deno.Kv> {
    if (!this.kv) {
      await this.initialize();
    }
    return this.kv!;
  }

  /**
   * 关闭 KV 连接
   */
  async close(): Promise<void> {
    if (this.kv) {
      this.kv.close();
      this.kv = null;
      console.log('🔒 KV 数据库连接已关闭');
    }
  }

  // ================================
  // 监控配置相关操作
  // ================================

  /**
   * 保存监控配置
   */
  async saveMonitorConfig(config: MonitorConfig): Promise<boolean> {
    try {
      const kv = await this.getKV();
      const key = [KV_KEYS.MONITORS, config.id];
      const result = await kv.set(key, config);
      return result.ok;
    } catch (error) {
      console.error('保存监控配置失败:', error);
      return false;
    }
  }

  /**
   * 获取监控配置
   */
  async getMonitorConfig(id: string): Promise<MonitorConfig | null> {
    try {
      const kv = await this.getKV();
      const key = [KV_KEYS.MONITORS, id];
      const result = await kv.get<MonitorConfig>(key);
      
      if (result.value) {
        const config = result.value;
        // 确保日期字段正确转换
        config.createdAt = new Date(config.createdAt);
        config.updatedAt = new Date(config.updatedAt);
        if (config.lastCheck) {
          config.lastCheck = new Date(config.lastCheck);
        }
        return config;
      }
      
      return null;
    } catch (error) {
      console.error('获取监控配置失败:', error);
      return null;
    }
  }

  /**
   * 获取所有监控配置
   */
  async getAllMonitorConfigs(): Promise<MonitorConfig[]> {
    try {
      const kv = await this.getKV();
      const configs: MonitorConfig[] = [];

      const iter = kv.list<MonitorConfig>({ prefix: [KV_KEYS.MONITORS] });

      for await (const entry of iter) {
        if (entry.value) {
          const config = entry.value;
          // 确保日期字段正确转换
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
      console.error('获取所有监控配置失败:', error);
      return [];
    }
  }

  /**
   * 删除监控配置
   */
  async deleteMonitorConfig(id: string): Promise<boolean> {
    try {
      const kv = await this.getKV();
      const key = [KV_KEYS.MONITORS, id];
      await kv.delete(key);
      return true;
    } catch (error) {
      console.error('删除监控配置失败:', error);
      return false;
    }
  }

  // ================================
  // 监控历史记录相关操作
  // ================================

  /**
   * 保存监控历史记录
   */
  async saveMonitorHistory(history: MonitorHistory): Promise<boolean> {
    try {
      const kv = await this.getKV();
      const key = [KV_KEYS.HISTORY, history.monitorId, history.id];
      const result = await kv.set(key, history);
      return result.ok;
    } catch (error) {
      console.error('保存监控历史记录失败:', error);
      return false;
    }
  }

  /**
   * 获取监控历史记录
   */
  async getMonitorHistory(monitorId: string, limit: number = 100): Promise<MonitorHistory[]> {
    try {
      const kv = await this.getKV();
      const histories: MonitorHistory[] = [];

      const iter = kv.list<MonitorHistory>({
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
      console.error('获取监控历史记录失败:', error);
      return [];
    }
  }

  // ================================
  // 会话管理相关操作
  // ================================

  /**
   * 保存会话
   */
  async saveSession(session: Session): Promise<boolean> {
    try {
      const kv = await this.getKV();
      const key = [KV_KEYS.SESSIONS, session.id];
      const result = await kv.set(key, session);
      return result.ok;
    } catch (error) {
      console.error('保存会话失败:', error);
      return false;
    }
  }

  /**
   * 获取会话
   */
  async getSession(sessionId: string): Promise<Session | null> {
    try {
      const kv = await this.getKV();
      const key = [KV_KEYS.SESSIONS, sessionId];
      const result = await kv.get<Session>(key);
      
      if (result.value) {
        const session = result.value;
        // 确保日期字段正确转换
        session.expires = new Date(session.expires);
        session.createdAt = new Date(session.createdAt);
        session.lastAccessAt = new Date(session.lastAccessAt);
        return session;
      }
      
      return null;
    } catch (error) {
      console.error('获取会话失败:', error);
      return null;
    }
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const kv = await this.getKV();
      const key = [KV_KEYS.SESSIONS, sessionId];
      await kv.delete(key);
      return true;
    } catch (error) {
      console.error('删除会话失败:', error);
      return false;
    }
  }

  // ================================
  // 系统日志相关操作
  // ================================

  /**
   * 保存系统日志
   */
  async saveSystemLog(logEntry: SystemLog): Promise<boolean> {
    try {
      const kv = await this.getKV();

      // 使用时间戳作为排序键，便于按时间查询
      const timeKey = logEntry.timestamp.getTime().toString().padStart(20, '0');
      const key = [KV_KEYS.SYSTEM_LOGS, timeKey, logEntry.id];

      const result = await kv.set(key, logEntry);
      return result.ok;
    } catch (error) {
      console.error('保存系统日志失败:', error);
      return false;
    }
  }

  /**
   * 获取系统日志
   */
  async getSystemLogs(limit: number = 100): Promise<SystemLog[]> {
    try {
      const kv = await this.getKV();
      const logs: SystemLog[] = [];

      const iter = kv.list<SystemLog>({
        prefix: [KV_KEYS.SYSTEM_LOGS],
      }, {
        limit,
        reverse: true, // 最新的记录在前
      });

      for await (const entry of iter) {
        if (entry.value) {
          const log = entry.value;
          log.timestamp = new Date(log.timestamp);
          logs.push(log);
        }
      }

      return logs;
    } catch (error) {
      console.error('获取系统日志失败:', error);
      return [];
    }
  }

  /**
   * 清理过期日志
   */
  async cleanupOldLogs(daysToKeep: number = 30): Promise<number> {
    try {
      const kv = await this.getKV();
      const cutoffTime = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
      let deletedCount = 0;

      const iter = kv.list<SystemLog>({
        prefix: [KV_KEYS.SYSTEM_LOGS],
      });

      for await (const entry of iter) {
        if (entry.value) {
          const log = entry.value;
          if (new Date(log.timestamp) < cutoffTime) {
            await kv.delete(entry.key);
            deletedCount++;
          }
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('清理过期日志失败:', error);
      return 0;
    }
  }
}

// 导出单例实例
export const kvService = KVService.getInstance();
