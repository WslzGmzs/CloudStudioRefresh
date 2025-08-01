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
        try {
            const response = await api.getMonitors();
            if (response.success) {
                this.renderMonitorsTable(response.data);
            } else {
                throw new Error(response.error || '获取监控配置失败');
            }
        } catch (error) {
            console.error('加载监控配置失败:', error);
            document.getElementById('monitorsTable').innerHTML =
                '<div class="error-message">加载监控配置失败: ' + error.message + '</div>';
        }
    }

    /**
     * 渲染监控配置表格
     */
    renderMonitorsTable(monitors) {
        const container = document.getElementById('monitorsTable');

        if (monitors.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无监控配置</div>';
            return;
        }

        const html = `
            <div class="table-controls">
                <div class="search-box">
                    <input type="text" id="monitorSearch" placeholder="搜索监控配置..." />
                    <button id="searchBtn" class="btn btn-secondary">搜索</button>
                </div>
                <div class="table-actions">
                    <button id="selectAllBtn" class="btn btn-secondary">全选</button>
                    <button id="batchEnableBtn" class="btn btn-primary">批量启用</button>
                    <button id="batchDisableBtn" class="btn btn-warning">批量禁用</button>
                    <button id="batchDeleteBtn" class="btn btn-danger">批量删除</button>
                </div>
            </div>
            <div class="table-wrapper">
                <table class="monitors-table">
                    <thead>
                        <tr>
                            <th><input type="checkbox" id="selectAllCheckbox"></th>
                            <th>名称</th>
                            <th>URL</th>
                            <th>方法</th>
                            <th>间隔</th>
                            <th>状态</th>
                            <th>最后检查</th>
                            <th>响应时间</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${monitors.map(monitor => this.renderMonitorRow(monitor)).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
        this.bindMonitorsTableEvents();
    }

    /**
     * 渲染监控配置行
     */
    renderMonitorRow(monitor) {
        const statusClass = monitor.status === 'success' ? 'status-success' :
                           monitor.status === 'error' ? 'status-error' : 'status-pending';
        const statusText = monitor.status === 'success' ? '正常' :
                          monitor.status === 'error' ? '异常' : '待检查';
        const enabledText = monitor.enabled ? '启用' : '禁用';
        const enabledClass = monitor.enabled ? 'enabled' : 'disabled';

        return `
            <tr data-monitor-id="${monitor.id}">
                <td><input type="checkbox" class="monitor-checkbox" value="${monitor.id}"></td>
                <td class="monitor-name">${monitor.name}</td>
                <td class="monitor-url" title="${monitor.url}">${this.truncateUrl(monitor.url)}</td>
                <td>${monitor.method || 'GET'}</td>
                <td>${monitor.interval}分钟</td>
                <td>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                    <span class="enabled-badge ${enabledClass}">${enabledText}</span>
                </td>
                <td>${utils.formatTime(monitor.lastCheck)}</td>
                <td>${monitor.lastResponseTime ? monitor.lastResponseTime + 'ms' : '-'}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-secondary" onclick="app.editMonitor('${monitor.id}')">编辑</button>
                    <button class="btn btn-sm ${monitor.enabled ? 'btn-warning' : 'btn-primary'}"
                            onclick="app.toggleMonitor('${monitor.id}', ${!monitor.enabled})">
                        ${monitor.enabled ? '禁用' : '启用'}
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteMonitor('${monitor.id}')">删除</button>
                </td>
            </tr>
        `;
    }

    /**
     * 截断URL显示
     */
    truncateUrl(url) {
        return url.length > 50 ? url.substring(0, 47) + '...' : url;
    }

    /**
     * 绑定监控表格事件
     */
    bindMonitorsTableEvents() {
        // 搜索功能
        const searchInput = document.getElementById('monitorSearch');
        const searchBtn = document.getElementById('searchBtn');

        if (searchInput && searchBtn) {
            const handleSearch = () => {
                const searchTerm = searchInput.value.toLowerCase();
                const rows = document.querySelectorAll('.monitors-table tbody tr');

                rows.forEach(row => {
                    const text = row.textContent.toLowerCase();
                    row.style.display = text.includes(searchTerm) ? '' : 'none';
                });
            };

            searchBtn.addEventListener('click', handleSearch);
            searchInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') handleSearch();
            });
        }

        // 全选功能
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const checkboxes = document.querySelectorAll('.monitor-checkbox');
                checkboxes.forEach(cb => cb.checked = e.target.checked);
            });
        }

        // 批量操作
        document.getElementById('batchEnableBtn')?.addEventListener('click', () => this.batchOperation('enable'));
        document.getElementById('batchDisableBtn')?.addEventListener('click', () => this.batchOperation('disable'));
        document.getElementById('batchDeleteBtn')?.addEventListener('click', () => this.batchOperation('delete'));
    }

    /**
     * 批量操作
     */
    async batchOperation(operation) {
        const selectedIds = Array.from(document.querySelectorAll('.monitor-checkbox:checked'))
            .map(cb => cb.value);

        if (selectedIds.length === 0) {
            utils.showNotification('请选择要操作的监控配置', 'warning');
            return;
        }

        const operationText = {
            enable: '启用',
            disable: '禁用',
            delete: '删除'
        }[operation];

        const confirmed = await utils.confirm(`确定要${operationText} ${selectedIds.length} 个监控配置吗？`);
        if (!confirmed) return;

        try {
            for (const id of selectedIds) {
                if (operation === 'delete') {
                    await api.deleteMonitor(id);
                } else {
                    const enabled = operation === 'enable';
                    await api.updateMonitor(id, { enabled });
                }
            }

            utils.showNotification(`批量${operationText}成功`, 'success');
            await this.loadMonitors();
        } catch (error) {
            console.error(`批量${operationText}失败:`, error);
            utils.showNotification(`批量${operationText}失败: ` + error.message, 'error');
        }
    }

    /**
     * 切换监控启用状态
     */
    async toggleMonitor(id, enabled) {
        try {
            await api.updateMonitor(id, { enabled });
            utils.showNotification(`监控已${enabled ? '启用' : '禁用'}`, 'success');
            await this.loadMonitors();
        } catch (error) {
            console.error('切换监控状态失败:', error);
            utils.showNotification('操作失败: ' + error.message, 'error');
        }
    }

    /**
     * 加载日志页面
     */
    async loadLogs() {
        this.currentLogPage = 1;
        this.logFilters = {
            level: '',
            search: '',
            monitorId: ''
        };
        await this.loadLogsData();
        this.bindLogsEvents();
    }

    /**
     * 加载日志数据
     */
    async loadLogsData() {
        try {
            const options = {
                page: this.currentLogPage || 1,
                limit: 20,
                ...this.logFilters
            };

            const response = await api.getLogs(options);
            if (response.success) {
                this.renderLogsTable(response.data);
            } else {
                throw new Error(response.error || '获取系统日志失败');
            }
        } catch (error) {
            console.error('加载系统日志失败:', error);
            document.getElementById('logsContainer').innerHTML =
                '<div class="error-message">加载系统日志失败: ' + error.message + '</div>';
        }
    }

    /**
     * 渲染日志表格
     */
    renderLogsTable(data) {
        const container = document.getElementById('logsContainer');
        const { items: logs, total, page, totalPages, hasNext, hasPrev } = data;

        if (logs.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无日志记录</div>';
            return;
        }

        const html = `
            <div class="logs-controls">
                <div class="logs-filters">
                    <select id="logLevelFilter">
                        <option value="">所有级别</option>
                        <option value="INFO">信息</option>
                        <option value="WARN">警告</option>
                        <option value="ERROR">错误</option>
                        <option value="DEBUG">调试</option>
                    </select>
                    <input type="text" id="logSearchInput" placeholder="搜索日志内容..." />
                    <button id="logSearchBtn" class="btn btn-secondary">搜索</button>
                    <button id="logClearBtn" class="btn btn-secondary">清除</button>
                </div>
                <div class="logs-actions">
                    <button id="refreshLogsBtn" class="btn btn-primary">刷新</button>
                    <button id="exportLogsBtn" class="btn btn-secondary">导出</button>
                    <button id="autoRefreshBtn" class="btn btn-secondary" data-auto="false">
                        <span class="auto-text">自动刷新</span>
                    </button>
                </div>
            </div>
            <div class="logs-stats">
                <span>共 ${total} 条日志，第 ${page}/${totalPages} 页</span>
            </div>
            <div class="logs-table-wrapper">
                <table class="logs-table">
                    <thead>
                        <tr>
                            <th>时间</th>
                            <th>级别</th>
                            <th>消息</th>
                            <th>监控</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logs.map(log => this.renderLogRow(log)).join('')}
                    </tbody>
                </table>
            </div>
            <div class="logs-pagination">
                <button class="btn btn-secondary" ${!hasPrev ? 'disabled' : ''}
                        onclick="app.loadLogPage(${page - 1})">上一页</button>
                <span class="page-info">第 ${page} 页，共 ${totalPages} 页</span>
                <button class="btn btn-secondary" ${!hasNext ? 'disabled' : ''}
                        onclick="app.loadLogPage(${page + 1})">下一页</button>
            </div>
        `;

        container.innerHTML = html;

        // 设置当前过滤器值
        if (this.logFilters.level) {
            document.getElementById('logLevelFilter').value = this.logFilters.level;
        }
        if (this.logFilters.search) {
            document.getElementById('logSearchInput').value = this.logFilters.search;
        }
    }

    /**
     * 渲染日志行
     */
    renderLogRow(log) {
        const levelClass = {
            'ERROR': 'log-error',
            'WARN': 'log-warning',
            'INFO': 'log-info',
            'DEBUG': 'log-debug'
        }[log.level] || 'log-info';

        const monitorInfo = log.monitorName ?
            `<span class="monitor-info" title="${log.monitorId}">${log.monitorName}</span>` :
            '<span class="monitor-info">-</span>';

        return `
            <tr class="log-row ${levelClass}">
                <td class="log-time">${utils.formatTime(log.timestamp)}</td>
                <td class="log-level">
                    <span class="level-badge level-${log.level.toLowerCase()}">${log.level}</span>
                </td>
                <td class="log-message" title="${log.message}">${this.truncateMessage(log.message)}</td>
                <td class="log-monitor">${monitorInfo}</td>
            </tr>
        `;
    }

    /**
     * 截断消息显示
     */
    truncateMessage(message) {
        return message.length > 100 ? message.substring(0, 97) + '...' : message;
    }

    /**
     * 绑定日志页面事件
     */
    bindLogsEvents() {
        // 级别过滤
        document.getElementById('logLevelFilter')?.addEventListener('change', (e) => {
            this.logFilters.level = e.target.value;
            this.currentLogPage = 1;
            this.loadLogsData();
        });

        // 搜索功能
        const searchInput = document.getElementById('logSearchInput');
        const searchBtn = document.getElementById('logSearchBtn');

        const handleSearch = () => {
            this.logFilters.search = searchInput?.value || '';
            this.currentLogPage = 1;
            this.loadLogsData();
        };

        searchBtn?.addEventListener('click', handleSearch);
        searchInput?.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') handleSearch();
        });

        // 清除过滤
        document.getElementById('logClearBtn')?.addEventListener('click', () => {
            this.logFilters = { level: '', search: '', monitorId: '' };
            this.currentLogPage = 1;
            this.loadLogsData();
        });

        // 刷新日志
        document.getElementById('refreshLogsBtn')?.addEventListener('click', () => {
            this.loadLogsData();
        });

        // 导出日志
        document.getElementById('exportLogsBtn')?.addEventListener('click', () => {
            this.exportLogs();
        });

        // 自动刷新
        document.getElementById('autoRefreshBtn')?.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            const isAuto = btn.dataset.auto === 'true';

            if (isAuto) {
                this.stopAutoRefreshLogs();
                btn.dataset.auto = 'false';
                btn.querySelector('.auto-text').textContent = '自动刷新';
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-secondary');
            } else {
                this.startAutoRefreshLogs();
                btn.dataset.auto = 'true';
                btn.querySelector('.auto-text').textContent = '停止刷新';
                btn.classList.remove('btn-secondary');
                btn.classList.add('btn-primary');
            }
        });
    }

    /**
     * 加载指定页的日志
     */
    async loadLogPage(page) {
        this.currentLogPage = page;
        await this.loadLogsData();
    }

    /**
     * 开始自动刷新日志
     */
    startAutoRefreshLogs() {
        this.stopAutoRefreshLogs(); // 先停止现有的
        this.logRefreshInterval = setInterval(() => {
            this.loadLogsData();
        }, 10000); // 每10秒刷新
    }

    /**
     * 停止自动刷新日志
     */
    stopAutoRefreshLogs() {
        if (this.logRefreshInterval) {
            clearInterval(this.logRefreshInterval);
            this.logRefreshInterval = null;
        }
    }

    /**
     * 导出日志
     */
    async exportLogs() {
        try {
            const options = {
                format: 'csv',
                ...this.logFilters
            };

            const response = await api.exportLogs(options);

            if (response.success) {
                // 创建下载链接
                const blob = new Blob([response.data], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `system-logs-${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);

                utils.showNotification('日志导出成功', 'success');
            } else {
                throw new Error(response.error || '导出失败');
            }
        } catch (error) {
            console.error('导出日志失败:', error);
            utils.showNotification('导出日志失败: ' + error.message, 'error');
        }
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
