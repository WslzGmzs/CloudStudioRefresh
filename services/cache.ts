/**
 * 内存缓存服务
 */

import { CACHE_TTL, INTERVALS } from '@/config/constants.ts';

/**
 * 缓存条目接口
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // 生存时间（毫秒）
}

/**
 * 内存缓存管理器
 */
export class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTTL = CACHE_TTL.DEFAULT;

  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    };
    this.cache.set(key, entry);
  }

  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清理过期缓存
   */
  cleanup(): number {
    let cleanedCount = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * 获取缓存统计
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 检查缓存是否存在
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 获取缓存剩余TTL
   */
  getTTL(key: string): number {
    const entry = this.cache.get(key);
    if (!entry) {
      return -1;
    }

    const remaining = entry.ttl - (Date.now() - entry.timestamp);
    return remaining > 0 ? remaining : -1;
  }
}

// 全局缓存实例
export const globalCache = new MemoryCache();

// 定期清理过期缓存
setInterval(() => {
  const cleaned = globalCache.cleanup();
  if (cleaned > 0) {
    console.log(`🧹 清理了 ${cleaned} 个过期缓存条目`);
  }
}, INTERVALS.CACHE_CLEANUP);

/**
 * 缓存工具函数
 */
export class CacheUtils {
  /**
   * 生成缓存键
   */
  static generateKey(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}_${parts.join('_')}`;
  }

  /**
   * 清除指定前缀的所有缓存
   */
  static clearByPrefix(prefix: string): number {
    const stats = globalCache.getStats();
    let cleared = 0;

    for (const key of stats.keys) {
      if (key.startsWith(prefix)) {
        globalCache.delete(key);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * 获取缓存命中率统计
   */
  static getHitRateStats(): { hits: number; misses: number; hitRate: number } {
    // 这里可以实现更复杂的统计逻辑
    // 目前返回模拟数据
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
    };
  }
}
