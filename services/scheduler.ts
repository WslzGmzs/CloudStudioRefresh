/**
 * 监控任务调度器服务
 */

import { INTERVALS } from '@/config/constants.ts';
import type { MonitorConfig, MonitorResult } from '@/models/monitor.ts';
import { kvService } from '@/services/kv.ts';
import { monitorService } from '@/services/monitor.ts';
import { globalCache, CacheUtils } from '@/services/cache.ts';

/**
 * 监控任务调度器
 */
export class MonitorScheduler {
  private static instance: MonitorScheduler;
  private isRunning: boolean = false;
  private lastExecutionTime: Date | null = null;
  private executionCount: number = 0;
  private cronJob: any = null;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): MonitorScheduler {
    if (!MonitorScheduler.instance) {
      MonitorScheduler.instance = new MonitorScheduler();
    }
    return MonitorScheduler.instance;
  }

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

      // 获取所有监控配置（使用缓存）
      const configs = await kvService.getAllMonitorConfigs();
      const enabledConfigs = configs.filter((config) => config.enabled);

      if (enabledConfigs.length === 0) {
        console.log('📝 没有启用的监控配置，跳过本次执行');
        return;
      }

      console.log(`📊 发现 ${enabledConfigs.length} 个启用的监控配置`);

      // 检查哪些监控任务需要执行（基于间隔时间）
      const configsToExecute = enabledConfigs.filter((config) => 
        monitorService.shouldExecuteMonitor(config)
      );
      const skippedConfigs = enabledConfigs.filter((config) => 
        !monitorService.shouldExecuteMonitor(config)
      );

      // 输出执行计划
      if (configsToExecute.length > 0) {
        console.log(`🚀 需要执行 ${configsToExecute.length} 个监控任务:`);
        configsToExecute.forEach((config) => {
          const lastCheckStr = config.lastCheck 
            ? new Date(config.lastCheck).toLocaleString('zh-CN')
            : '从未执行';
          console.log(`  - ${config.name} (间隔: ${config.interval}分钟, 上次检查: ${lastCheckStr})`);
        });
      }

      if (skippedConfigs.length > 0) {
        console.log(`⏭️ 跳过 ${skippedConfigs.length} 个监控任务 (未到执行时间):`);
        skippedConfigs.forEach((config) => {
          const nextExecution = monitorService.getNextExecutionTime(config);
          const nextExecutionStr = nextExecution.toLocaleString('zh-CN');
          console.log(`  - ${config.name} (下次执行: ${nextExecutionStr})`);
        });
      }

      if (configsToExecute.length === 0) {
        console.log('⏸️ 本次周期无需执行任何监控任务');
        return;
      }

      // 执行监控任务
      const results = await this.executeMonitorTasks(configsToExecute);

      // 更新监控配置状态
      await this.updateMonitorStatuses(results);

      // 统计结果
      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.length - successCount;

      console.log(`✅ 监控周期完成: 执行 ${results.length} 个任务，成功 ${successCount} 个，失败 ${failureCount} 个`);
      console.log(`📊 总配置: ${enabledConfigs.length} 个启用，${skippedConfigs.length} 个跳过\n`);
    } catch (error) {
      console.error('❌ 监控周期执行错误:', error);
    }
  }

  /**
   * 执行监控任务
   */
  private async executeMonitorTasks(
    configs: MonitorConfig[],
  ): Promise<Array<MonitorResult & { configId: string }>> {
    const results: Array<MonitorResult & { configId: string }> = [];

    // 限制并发数量
    const maxConcurrent = Math.min(configs.length, 10);

    for (let i = 0; i < configs.length; i += maxConcurrent) {
      const batch = configs.slice(i, i + maxConcurrent);

      console.log(
        `🔄 执行批次 ${Math.floor(i / maxConcurrent) + 1}/${
          Math.ceil(configs.length / maxConcurrent)
        } (${batch.length} 个任务)`,
      );

      const batchPromises = batch.map(async (config) => {
        const result = await monitorService.executeMonitor(config);
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
   */
  private async updateMonitorStatuses(
    results: Array<MonitorResult & { configId: string }>,
  ): Promise<void> {
    for (const result of results) {
      try {
        const config = await kvService.getMonitorConfig(result.configId);
        if (config) {
          config.lastCheck = result.timestamp;
          config.status = result.status;
          config.lastError = result.error;
          config.updatedAt = new Date();

          await kvService.saveMonitorConfig(config);
          
          // 清除相关缓存
          CacheUtils.clearByPrefix('all_monitor_configs');
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

// 导出单例实例
export const monitorScheduler = MonitorScheduler.getInstance();
