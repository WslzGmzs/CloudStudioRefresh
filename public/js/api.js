/**
 * API 调用模块
 */

class API {
    constructor() {
        this.baseURL = '';
    }

    /**
     * 发送 HTTP 请求
     */
    async request(url, options = {}) {
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(this.baseURL + url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API请求失败:', error);
            throw error;
        }
    }

    /**
     * GET 请求
     */
    async get(url) {
        return this.request(url, { method: 'GET' });
    }

    /**
     * POST 请求
     */
    async post(url, data) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT 请求
     */
    async put(url, data) {
        return this.request(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE 请求
     */
    async delete(url) {
        return this.request(url, { method: 'DELETE' });
    }

    // ================================
    // 认证相关 API
    // ================================

    /**
     * 登录
     */
    async login(password) {
        return this.post('/api/login', { password });
    }

    /**
     * 登出
     */
    async logout() {
        return this.post('/api/logout');
    }

    /**
     * 检查认证状态
     */
    async checkAuth() {
        return this.get('/api/auth/status');
    }

    // ================================
    // 监控配置相关 API
    // ================================

    /**
     * 获取所有监控配置
     */
    async getMonitors() {
        return this.get('/api/monitors');
    }

    /**
     * 创建监控配置
     */
    async createMonitor(config) {
        return this.post('/api/monitors', config);
    }

    /**
     * 更新监控配置
     */
    async updateMonitor(id, config) {
        return this.put(`/api/monitors/${id}`, config);
    }

    /**
     * 删除监控配置
     */
    async deleteMonitor(id) {
        return this.delete(`/api/monitors/${id}`);
    }

    /**
     * 获取监控状态
     */
    async getMonitorStatus() {
        return this.get('/api/monitors/status');
    }

    // ================================
    // 统计数据相关 API
    // ================================

    /**
     * 获取监控统计
     */
    async getMonitorStats(period = '24h') {
        return this.get(`/api/stats?period=${period}`);
    }

    /**
     * 获取概览统计
     */
    async getOverviewStats() {
        return this.get('/api/stats/overview');
    }

    // ================================
    // 系统相关 API
    // ================================

    /**
     * 获取系统信息
     */
    async getSystemInfo() {
        return this.get('/api/system/info');
    }

    /**
     * 获取系统健康状态
     */
    async getSystemHealth() {
        return this.get('/api/system/health');
    }

    /**
     * 获取缓存统计
     */
    async getCacheStats() {
        return this.get('/api/system/cache');
    }

    /**
     * 清除缓存
     */
    async clearCache() {
        return this.post('/api/system/cache/clear');
    }

    /**
     * 获取调度器状态
     */
    async getSchedulerStatus() {
        return this.get('/api/system/scheduler');
    }
}

// 创建全局 API 实例
window.api = new API();

/**
 * 工具函数
 */
window.utils = {
    /**
     * 格式化时间
     */
    formatTime(date) {
        if (!date) return '-';
        return new Date(date).toLocaleString('zh-CN');
    },

    /**
     * 格式化持续时间
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}天 ${hours % 24}小时`;
        } else if (hours > 0) {
            return `${hours}小时 ${minutes % 60}分钟`;
        } else if (minutes > 0) {
            return `${minutes}分钟 ${seconds % 60}秒`;
        } else {
            return `${seconds}秒`;
        }
    },

    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        // 添加样式
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

        // 根据类型设置背景色
        const colors = {
            info: '#3182ce',
            success: '#38a169',
            warning: '#d69e2e',
            error: '#e53e3e'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        // 添加到页面
        document.body.appendChild(notification);

        // 3秒后自动移除
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    },

    /**
     * 确认对话框
     */
    async confirm(message) {
        return new Promise((resolve) => {
            const result = window.confirm(message);
            resolve(result);
        });
    },

    /**
     * 防抖函数
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
