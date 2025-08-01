/**
 * 主应用逻辑
 */

class App {
    constructor() {
        this.currentPage = 'dashboard';
        this.editingMonitorId = null;
        this.refreshInterval = null;
        this.init();
    }

    /**
     * 初始化应用
     */
    async init() {
        this.bindEvents();
        await this.checkAuth();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 登录表单
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin.bind(this));
        }

        // 导航按钮
        document.getElementById('navDashboard')?.addEventListener('click', () => this.showPage('dashboard'));
        document.getElementById('navMonitors')?.addEventListener('click', () => this.showPage('monitors'));
        document.getElementById('navLogs')?.addEventListener('click', () => this.showPage('logs'));
        document.getElementById('navSettings')?.addEventListener('click', () => this.showPage('settings'));

        // 登出按钮
        document.getElementById('logoutBtn')?.addEventListener('click', this.handleLogout.bind(this));

        // 刷新按钮
        document.getElementById('refreshDashboard')?.addEventListener('click', this.refreshDashboard.bind(this));

        // 添加监控按钮
        document.getElementById('addMonitorBtn')?.addEventListener('click', this.showAddMonitorModal.bind(this));
        document.getElementById('addMonitorBtn2')?.addEventListener('click', this.showAddMonitorModal.bind(this));

        // 模态框相关
        document.getElementById('closeModal')?.addEventListener('click', this.hideModal.bind(this));
        document.getElementById('cancelBtn')?.addEventListener('click', this.hideModal.bind(this));
        document.getElementById('monitorForm')?.addEventListener('submit', this.handleMonitorSubmit.bind(this));

        // 点击模态框外部关闭
        document.getElementById('monitorModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'monitorModal') {
                this.hideModal();
            }
        });

        // 系统设置相关
        document.getElementById('clearCacheBtn')?.addEventListener('click', this.handleClearCache.bind(this));
    }

    /**
     * 检查认证状态
     */
    async checkAuth() {
        try {
            const response = await api.checkAuth();
            if (response.success && response.data.authenticated) {
                this.showMainApp();
                await this.loadDashboard();
                this.startAutoRefresh();
            } else {
                this.showLoginPage();
            }
        } catch (error) {
            console.error('认证检查失败:', error);
            this.showLoginPage();
        }
    }

    /**
     * 处理登录
     */
    async handleLogin(e) {
        e.preventDefault();
        
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('loginError');
        
        try {
            const response = await api.login(password);
            if (response.success) {
                utils.showNotification('登录成功', 'success');
                this.showMainApp();
                await this.loadDashboard();
                this.startAutoRefresh();
            } else {
                throw new Error(response.error || '登录失败');
            }
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
            utils.showNotification('登录失败: ' + error.message, 'error');
        }
    }

    /**
     * 处理登出
     */
    async handleLogout() {
        try {
            await api.logout();
            this.stopAutoRefresh();
            this.showLoginPage();
            utils.showNotification('已登出', 'info');
        } catch (error) {
            console.error('登出失败:', error);
            utils.showNotification('登出失败', 'error');
        }
    }

    /**
     * 显示登录页面
     */
    showLoginPage() {
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('password').value = '';
        document.getElementById('loginError').style.display = 'none';
    }

    /**
     * 显示主应用
     */
    showMainApp() {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';
    }

    /**
     * 显示指定页面
     */
    showPage(pageName) {
        // 隐藏所有页面
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // 移除所有导航按钮的激活状态
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // 显示指定页面
        document.getElementById(`${pageName}Page`).classList.add('active');
        document.getElementById(`nav${pageName.charAt(0).toUpperCase() + pageName.slice(1)}`).classList.add('active');

        this.currentPage = pageName;

        // 加载页面数据
        this.loadPageData(pageName);
    }

    /**
     * 加载页面数据
     */
    async loadPageData(pageName) {
        switch (pageName) {
            case 'dashboard':
                await this.loadDashboard();
                break;
            case 'monitors':
                await this.loadMonitors();
                break;
            case 'logs':
                await this.loadLogs();
                break;
            case 'settings':
                await this.loadSettings();
                break;
        }
    }

    /**
     * 加载仪表板数据
     */
    async loadDashboard() {
        try {
            // 加载概览统计
            const overviewResponse = await api.getOverviewStats();
            if (overviewResponse.success) {
                const stats = overviewResponse.data;
                document.getElementById('totalMonitors').textContent = stats.totalMonitors;
                document.getElementById('successMonitors').textContent = stats.successMonitors;
                document.getElementById('errorMonitors').textContent = stats.errorMonitors;
                document.getElementById('pendingMonitors').textContent = stats.pendingMonitors;
            }

            // 加载监控状态
            const statusResponse = await api.getMonitorStatus();
            if (statusResponse.success) {
                this.renderMonitorsList(statusResponse.data);
            }
        } catch (error) {
            console.error('加载仪表板失败:', error);
            utils.showNotification('加载仪表板失败', 'error');
        }
    }

    /**
     * 渲染监控列表
     */
    renderMonitorsList(monitors) {
        const container = document.getElementById('monitorsList');
        
        if (monitors.length === 0) {
            container.innerHTML = '<div class="loading">暂无监控配置</div>';
            return;
        }

        const html = monitors.map(monitor => {
            const statusClass = monitor.status === 'success' ? 'status-success' : 
                               monitor.status === 'error' ? 'status-error' : 'status-pending';
            const statusText = monitor.status === 'success' ? '正常' : 
                              monitor.status === 'error' ? '异常' : '待检查';

            return `
                <div class="monitor-item">
                    <div class="monitor-info">
                        <h4>${monitor.name}</h4>
                        <p>最后检查: ${utils.formatTime(monitor.lastCheck)}</p>
                        ${monitor.lastError ? `<p style="color: #e53e3e;">错误: ${monitor.lastError}</p>` : ''}
                    </div>
                    <div class="monitor-status">
                        <span class="status-badge ${statusClass}">${statusText}</span>
                        <button class="btn btn-secondary" onclick="app.editMonitor('${monitor.id}')">编辑</button>
                        <button class="btn btn-danger" onclick="app.deleteMonitor('${monitor.id}')">删除</button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    /**
     * 刷新仪表板
     */
    async refreshDashboard() {
        const btn = document.getElementById('refreshDashboard');
        const originalText = btn.textContent;
        
        btn.disabled = true;
        btn.textContent = '🔄 刷新中...';
        
        try {
            await this.loadDashboard();
            utils.showNotification('数据已刷新', 'success');
        } catch (error) {
            utils.showNotification('刷新失败', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    /**
     * 开始自动刷新
     */
    startAutoRefresh() {
        // 每2分钟自动刷新
        this.refreshInterval = setInterval(() => {
            if (this.currentPage === 'dashboard') {
                this.loadDashboard();
            }
        }, 120000); // 2分钟
    }

    /**
     * 停止自动刷新
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * 显示添加监控模态框
     */
    showAddMonitorModal() {
        this.editingMonitorId = null;
        document.getElementById('modalTitle').textContent = '添加监控配置';
        document.getElementById('monitorForm').reset();
        document.getElementById('monitorEnabled').checked = true;
        document.getElementById('monitorInterval').value = 5;
        this.showModal();
    }

    /**
     * 显示模态框
     */
    showModal() {
        document.getElementById('monitorModal').classList.add('show');
    }

    /**
     * 隐藏模态框
     */
    hideModal() {
        document.getElementById('monitorModal').classList.remove('show');
    }

    /**
     * 处理监控配置提交
     */
    async handleMonitorSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const config = {
            name: formData.get('name'),
            url: formData.get('url'),
            cookie: formData.get('cookie'),
            method: formData.get('method'),
            interval: parseInt(formData.get('interval')),
            enabled: formData.get('enabled') === 'on'
        };

        try {
            if (this.editingMonitorId) {
                await api.updateMonitor(this.editingMonitorId, config);
                utils.showNotification('监控配置更新成功', 'success');
            } else {
                await api.createMonitor(config);
                utils.showNotification('监控配置创建成功', 'success');
            }
            
            this.hideModal();
            await this.loadDashboard();
        } catch (error) {
            console.error('保存监控配置失败:', error);
            utils.showNotification('保存失败: ' + error.message, 'error');
        }
    }

    /**
     * 编辑监控配置
     */
    async editMonitor(id) {
        try {
            const response = await api.getMonitors();
            if (response.success) {
                const monitor = response.data.find(m => m.id === id);
                if (monitor) {
                    this.editingMonitorId = id;
                    document.getElementById('modalTitle').textContent = '编辑监控配置';
                    document.getElementById('monitorName').value = monitor.name;
                    document.getElementById('monitorUrl').value = monitor.url;
                    document.getElementById('monitorCookie').value = monitor.cookie || '';
                    document.getElementById('monitorMethod').value = monitor.method || 'GET';
                    document.getElementById('monitorInterval').value = monitor.interval;
                    document.getElementById('monitorEnabled').checked = monitor.enabled;
                    this.showModal();
                }
            }
        } catch (error) {
            console.error('获取监控配置失败:', error);
            utils.showNotification('获取监控配置失败', 'error');
        }
    }

    /**
     * 删除监控配置
     */
    async deleteMonitor(id) {
        const confirmed = await utils.confirm('确定要删除这个监控配置吗？');
        if (!confirmed) return;

        try {
            await api.deleteMonitor(id);
            utils.showNotification('监控配置删除成功', 'success');
            await this.loadDashboard();
        } catch (error) {
            console.error('删除监控配置失败:', error);
            utils.showNotification('删除失败: ' + error.message, 'error');
        }
    }

    /**
     * 加载监控配置页面
     */
    async loadMonitors() {
        // TODO: 实现监控配置管理页面
        document.getElementById('monitorsTable').innerHTML = '<div class="loading">功能开发中...</div>';
    }

    /**
     * 加载日志页面
     */
    async loadLogs() {
        // TODO: 实现日志查看页面
        document.getElementById('logsContainer').innerHTML = '<div class="loading">功能开发中...</div>';
    }

    /**
     * 加载设置页面
     */
    async loadSettings() {
        try {
            // 加载缓存统计
            const cacheResponse = await api.getCacheStats();
            if (cacheResponse.success) {
                const stats = cacheResponse.data;
                document.getElementById('cacheStats').innerHTML = `
                    <p>缓存条目数: ${stats.cacheSize}</p>
                    <p>更新时间: ${utils.formatTime(stats.timestamp)}</p>
                `;
            }

            // 加载调度器状态
            const schedulerResponse = await api.getSchedulerStatus();
            if (schedulerResponse.success) {
                const status = schedulerResponse.data;
                document.getElementById('schedulerStatus').innerHTML = `
                    <p>状态: ${status.isRunning ? '运行中' : '已停止'}</p>
                    <p>执行次数: ${status.executionCount}</p>
                    <p>最后执行: ${utils.formatTime(status.lastExecutionTime)}</p>
                `;
            }

            // 加载系统信息
            const systemResponse = await api.getSystemInfo();
            if (systemResponse.success) {
                const info = systemResponse.data;
                document.getElementById('systemInfo').innerHTML = `
                    <p>版本: ${info.version}</p>
                    <p>运行时间: ${utils.formatDuration(info.uptime)}</p>
                    <p>平台: ${info.platform}</p>
                `;
            }
        } catch (error) {
            console.error('加载设置失败:', error);
            utils.showNotification('加载设置失败', 'error');
        }
    }

    /**
     * 清除缓存
     */
    async handleClearCache() {
        const confirmed = await utils.confirm('确定要清除所有缓存吗？');
        if (!confirmed) return;

        try {
            await api.clearCache();
            utils.showNotification('缓存已清除', 'success');
            await this.loadSettings();
        } catch (error) {
            console.error('清除缓存失败:', error);
            utils.showNotification('清除缓存失败', 'error');
        }
    }
}

// 创建全局应用实例
window.app = new App();
