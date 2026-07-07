class PostwomanApp {
    constructor() {
        this.history = [];
        this.isRecording = false;
        this.recordingUrl = '';
        this.timerId = 0;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadHistory();
        this.setupAuthToggle();
        this.initAutoRecord();
    }

    setupEventListeners() {
        document.getElementById('sendRequest').addEventListener('click', () => this.sendRequest());
        document.getElementById('addHeader').addEventListener('click', () => this.addHeaderRow());
        document.getElementById('addParam').addEventListener('click', () => this.addParamRow());
        document.getElementById('authType').addEventListener('change', () => this.setupAuthToggle());
        document.getElementById('bodyType').addEventListener('change', () => this.setupBodyTypeToggle());
        document.getElementById('autoRecordBtn').addEventListener('click', () => this.switchAutoRecord());
        document.getElementById('exportBtn').addEventListener('click', () => this.export())

        // 标签页切换事件
        document.querySelectorAll('.tabs .tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // 响应区域标签页切换
        document.querySelectorAll('.response-tabs .tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchResponseTab(e.target.dataset.tab);
            });
        });

        // 历史记录点击事件
        document.getElementById('historyList').addEventListener('click', (e) => {
            const historyItem = e.target.closest('.history-item');
            if (historyItem) {
                this.loadFromHistory(historyItem.dataset.index);
            }
        });

        // 清除历史按钮
        document.getElementById('clearHistory')?.addEventListener('click', () => this.clearHistory());

        // 删除按钮事件委托 - 修复CSP问题
        document.addEventListener('click', (e) => {

            if (e.target.classList.contains('btn-remove') && e.target.dataset.action === 'remove') {
                const row = e.target.closest('.key-value-row');
                if (row) {
                    row.remove();
                }
            }
        });

    }

    switchTab(tabName) {

        // 移除所有活跃状态
        document.querySelectorAll('.tabs .tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content .tab-panel').forEach(panel => panel.classList.remove('active'));

        // 激活选中的标签
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(tabName).classList.add('active');

    }

    async export() {
        await this.loadHistory();
        const blob = new Blob([JSON.stringify(this.history, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `domain-request-record-${new Date().getTime()}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    async initAutoRecord() {
        const btn = document.getElementById('autoRecordBtn');
        const input = document.getElementById('autoRecordUrl');
        const resp = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: "getMatchRules" }, resolve);
        });
        const currentUrls = resp.data;
        if (currentUrls && currentUrls.length > 0) {
            this.isRecording = true;
            this.recordingUrl = currentUrls[0];
            btn.textContent = '停止记录';
            btn.classList.add('recording');
            input.value = currentUrls[0];
            input.disabled = true;
        } else {
            btn.textContent = '开始记录';
            btn.classList.remove('recording');
            input.disabled = false;
        }
    }

    async switchAutoRecord() {
        const btn = document.getElementById('autoRecordBtn');
        const input = document.getElementById('autoRecordUrl');
        const currentUrl = input.value.trim();

        if (this.isRecording) {
            // 停止记录
            await new Promise((resolve) => {
                chrome.runtime.sendMessage({ action: "saveRule", rules: [] }, resolve);
            });
            this.isRecording = false;
            this.recordingUrl = '';
            btn.textContent = '开始记录';
            btn.classList.remove('recording');
            input.disabled = false;
            this.stopLoopLoadHistory()
            this.loadHistory();
            
        } else {
            // 开始记录
            if (!currentUrl) return;
            await new Promise((resolve) => {
                chrome.runtime.sendMessage({ action: "saveRule", rules: [currentUrl] }, resolve);
            });
            this.isRecording = true;
            this.recordingUrl = currentUrl;
            btn.textContent = '停止记录';
            btn.classList.add('recording');
            input.disabled = true;
            this.startLoopLoadHistory()
        }
    }

    switchResponseTab(tabName) {

        // 移除所有活跃状态
        document.querySelectorAll('.response-tabs .tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.response-content .tab-panel').forEach(panel => panel.classList.remove('active'));

        // 激活选中的标签
        document.querySelector(`.response-tabs [data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(tabName).classList.add('active');

    }

    setupAuthToggle() {
        const authType = document.getElementById('authType').value;
        const authContainer = document.getElementById('authContainer');

        // 清除现有的认证输入
        authContainer.innerHTML = '';

        switch (authType) {
            case 'bearer':
                authContainer.innerHTML = `
                    <div class="form-group">
                        <label>Token:</label>
                        <input type="password" id="bearerToken" placeholder="输入Bearer Token">
                    </div>
                `;
                break;
            case 'basic':
                authContainer.innerHTML = `
                    <div class="form-group">
                        <label>用户名:</label>
                        <input type="text" id="basicUsername" placeholder="输入用户名">
                    </div>
                    <div class="form-group">
                        <label>密码:</label>
                        <input type="password" id="basicPassword" placeholder="输入密码">
                    </div>
                `;
                break;
        }
    }

    setupBodyTypeToggle() {
        const bodyType = document.getElementById('bodyType').value;
        const requestBody = document.getElementById('requestBody');

        switch (bodyType) {
            case 'json':
                requestBody.placeholder = '输入JSON格式的请求体，例如：\n{"name": "John", "age": 30}';
                break;
            case 'form':
                requestBody.placeholder = '输入表单数据，例如：\nname=John&age=30';
                break;
            case 'text':
                requestBody.placeholder = '输入纯文本内容';
                break;
        }
    }

    addHeaderRow() {
        const container = document.getElementById('headersContainer');
        const row = document.createElement('div');
        row.className = 'key-value-row';
        row.innerHTML = `
            <input type="text" class="key-input" placeholder="Header名称">
            <input type="text" class="value-input" placeholder="Header值">
            <button type="button" class="btn-remove" data-action="remove">×</button>
        `;
        container.appendChild(row);
    }

    addParamRow() {
        const container = document.getElementById('paramsContainer');
        const row = document.createElement('div');
        row.className = 'key-value-row';
        row.innerHTML = `
            <input type="text" class="key-input" placeholder="参数名">
            <input type="text" class="value-input" placeholder="参数值">
            <button type="button" class="btn-remove" data-action="remove">×</button>
        `;
        container.appendChild(row);
    }

    collectHeaders() {
        const headers = {};
        const rows = document.querySelectorAll('#headersContainer .key-value-row');

        rows.forEach(row => {
            const key = row.querySelector('.key-input').value.trim();
            const value = row.querySelector('.value-input').value.trim();

            if (key && value) {
                headers[key] = value;
            }
        });

        return headers;
    }

    collectParams() {
        const params = {};
        const rows = document.querySelectorAll('#paramsContainer .key-value-row');

        rows.forEach(row => {
            const key = row.querySelector('.key-input').value.trim();
            const value = row.querySelector('.value-input').value.trim();

            if (key && value) {
                params[key] = value;
            }
        });

        return params;
    }

    collectAuthHeaders() {
        const authType = document.getElementById('authType').value;
        const headers = {};

        switch (authType) {
            case 'bearer':
                const token = document.getElementById('bearerToken')?.value;
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
                break;
            case 'basic':
                const username = document.getElementById('basicUsername')?.value;
                const password = document.getElementById('basicPassword')?.value;
                if (username && password) {
                    const credentials = btoa(`${username}:${password}`);
                    headers['Authorization'] = `Basic ${credentials}`;
                }
                break;
        }

        return headers;
    }

    buildRequestBody() {
        const bodyType = document.getElementById('bodyType').value;
        const bodyContent = document.getElementById('requestBody').value;

        if (!bodyContent.trim()) return null;

        switch (bodyType) {
            case 'json':
                try {
                    return JSON.parse(bodyContent);
                } catch (e) {
                    throw new Error('Invalid JSON format');
                }
            case 'form':
                const formData = new URLSearchParams();
                const pairs = bodyContent.split('&');
                pairs.forEach(pair => {
                    const [key, value] = pair.split('=');
                    if (key && value) {
                        formData.append(decodeURIComponent(key), decodeURIComponent(value));
                    }
                });
                return formData.toString();
            case 'text':
            default:
                return bodyContent;
        }
    }

    async sendRequest() {
        const method = document.getElementById('httpMethod').value;
        let url = document.getElementById('urlInput').value.trim();

        if (!url) {
            this.showError('请输入请求URL');
            return;
        }

        // 添加查询参数
        const params = this.collectParams();
        const queryString = new URLSearchParams(params).toString();
        if (queryString) {
            url += (url.includes('?') ? '&' : '?') + queryString;
        }

        try {
            const headers = {
                ...this.collectHeaders(),
                ...this.collectAuthHeaders()
            };

            let body = null;
            if (['POST', 'PUT', 'PATCH'].includes(method)) {
                body = this.buildRequestBody();
                if (body && typeof body === 'string' && body.includes('=')) {
                    headers['Content-Type'] = 'application/x-www-form-urlencoded';
                } else if (body && typeof body === 'object') {
                    headers['Content-Type'] = 'application/json';
                    body = JSON.stringify(body);
                }
            }

            this.showLoading(true);

            const startTime = Date.now();

            let response;


            // 使用后台脚本发送请求以获取当前页面的Cookie
            const requestData = {
                action: 'fetchWithCookies',
                url: url,
                options: {
                    method,
                    headers,
                    body
                },
                includeCookies: document.getElementById('includeCookies')?.checked
            };

            const responseFromBackground = await new Promise((resolve) => {
                chrome.runtime.sendMessage(requestData, resolve);
            });

            if (responseFromBackground.success) {
                response = {
                    status: responseFromBackground.data.status,
                    statusText: responseFromBackground.data.statusText,
                    headers: {
                        get: (name) => responseFromBackground.data.headers[name.toLowerCase()],
                        entries: () => Object.entries(responseFromBackground.data.headers)
                    },
                    json: async () => {
                        if (typeof responseFromBackground.data.body === 'object') {
                            return responseFromBackground.data.body;
                        }
                        return JSON.parse(responseFromBackground.data.body);
                    },
                    text: async () => {
                        return typeof responseFromBackground.data.body === 'string'
                            ? responseFromBackground.data.body
                            : JSON.stringify(responseFromBackground.data.body);
                    }
                };
            } else {
                throw new Error(responseFromBackground.error);
            }


            const endTime = Date.now();

            const responseData = {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                responseTime: endTime - startTime,
                timestamp: new Date().toISOString()
            };

            // 获取响应内容
            let responseBody;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                try {
                    responseBody = await response.json();
                } catch {
                    responseBody = await response.text();
                }
            } else {
                responseBody = await response.text();
            }

            responseData.body = responseBody;

            this.displayResponse(responseData);
            this.addToHistory(method, url, headers, body, responseData);

        } catch (error) {
            this.showError(`请求失败: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    displayResponse(data) {
        const statusClass = data.status >= 200 && data.status < 300 ? 'success' : 'error';
        const responseBody = document.getElementById('responseBody');
        responseBody.innerText = typeof data.body === 'object' ? JSON.stringify(data.body, null, 2) : data.body;
        const responseHeaders = document.getElementById('responseHeaders');
        responseHeaders.innerText = JSON.stringify(data.headers, null, 2);

        const statusCode = document.getElementById('statusCode');
        statusCode.innerText = "状态" + data.status + " " + data.statusText;
        statusCode.className = `status-code ${statusClass}`;

        const responseTime = document.getElementById('responseTime');
        responseTime.innerText = `响应时间: ${data.responseTime}ms`;

    }

    showError(message) {
        const statusCode = document.getElementById('statusCode');
        statusCode.innerText = '错误';
        statusCode.className = 'status-code error';

        const responseTime = document.getElementById('responseTime');
        responseTime.innerText = '--';

        const responseBody = document.getElementById('responseBody');
        responseBody.innerText = message;

        const responseHeaders = document.getElementById('responseHeaders');
        responseHeaders.innerText = '';
    }

    showLoading(show) {
        const sendButton = document.getElementById('sendRequest');
        sendButton.disabled = show;
        sendButton.textContent = show ? '发送中...' : '发送请求';
    }

    async addToHistory(method, url, headers, body, response) {
        const historyItem = {
            method,
            url,
            headers,
            body,
            response,
            timestamp: new Date().toISOString()
        };

        this.history.unshift(historyItem);
        if (this.history.length > 100) {
            this.history = this.history.slice(0, 100);
        }

        chrome.storage.local.set({ postnomanHistory: this.history });
        this.loadHistory();
    }

    async loadHistory() {
        const data = await chrome.storage.local.get('postnomanHistory');
        this.history = data.postnomanHistory || [];
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = '';

        if (this.history.length === 0) {
            historyList.innerHTML = '<div class="no-history">暂无请求历史</div>';
            return;
        }

        this.history.forEach((item, index) => {
            const historyElement = document.createElement('div');
            historyElement.className = 'history-item';
            historyElement.dataset.index = index;

            const statusClass = item.response.status >= 200 && item.response.status < 300 ? 'success' : 'error';

            historyElement.innerHTML = `
                <div class="history-method">${item.method}</div>
                <div class="history-url" title="${item.url}">${this.truncateUrl(item.url)}</div>
                <div class="history-status ${statusClass}">${item.response.status}</div>
                <div class="history-time">${this.formatTime(item.timestamp)}</div>
            `;

            historyList.appendChild(historyElement);
        });
    }

    loadFromHistory(index) {
        const item = this.history[index];
        if (!item) return;

        // 填充表单
        document.getElementById('httpMethod').value = item.method;
        document.getElementById('urlInput').value = item.url;

        // 清空并重新添加请求头
        document.getElementById('headersContainer').innerHTML = '';
        Object.entries(item.headers || {}).forEach(([key, value]) => {
            if (key !== 'Authorization') {
                this.addHeaderRow();
                const rows = document.querySelectorAll('#headersContainer .key-value-row');
                const lastRow = rows[rows.length - 1];
                lastRow.querySelector('.key-input').value = key;
                lastRow.querySelector('.value-input').value = value;
            }
        });

        // 设置认证信息
        if (item.headers?.Authorization) {
            const authHeader = item.headers.Authorization;
            if (authHeader.startsWith('Bearer ')) {
                document.getElementById('authType').value = 'bearer';
                this.setupAuthToggle();
                document.getElementById('bearerToken').value = authHeader.substring(7);
            }
        }

        // 设置请求体
        if (item.body) {
            if (typeof item.body === 'object') {
                document.getElementById('bodyType').value = 'json';
                document.getElementById('requestBody').value = JSON.stringify(item.body, null, 2);
            } else if (typeof item.body === 'string') {
                // 尝试判断是否为 JSON 字符串
                try {
                    const parsed = JSON.parse(item.body);
                    if (typeof parsed === 'object' && parsed !== null) {
                        document.getElementById('bodyType').value = 'json';
                        document.getElementById('requestBody').value = JSON.stringify(parsed, null, 2);
                    } else {
                        document.getElementById('bodyType').value = 'text';
                        document.getElementById('requestBody').value = item.body;
                    }
                } catch {
                    // 判断是否为 form 格式 (key=value&key=value)
                    if (item.body.includes('=') && !item.body.includes(' ')) {
                        document.getElementById('bodyType').value = 'form';
                    } else {
                        document.getElementById('bodyType').value = 'text';
                    }
                    document.getElementById('requestBody').value = item.body;
                }
            } else {
                document.getElementById('bodyType').value = 'text';
                document.getElementById('requestBody').value = item.body;
            }
            this.setupBodyTypeToggle();
        }

        // 显示响应
        this.displayResponse(item.response);
    }

    async clearHistory() {
        if (confirm('确定要清除所有请求历史吗？')) {
            this.history = [];
            await chrome.storage.local.remove('postnomanHistory');
            await this.loadHistory();
        }
    }

    truncateUrl(url) {
        return url.length > 50 ? url.substring(0, 50) + '...' : url;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) {
            return '刚刚';
        } else if (diff < 3600000) {
            return Math.floor(diff / 60000) + '分钟前';
        } else if (diff < 86400000) {
            return Math.floor(diff / 3600000) + '小时前';
        } else {
            return date.toLocaleDateString();
        }
    }

    startLoopLoadHistory() {
        this.loadHistory()
        this.timerId = setTimeout(() => this.startLoopLoadHistory(), 1000)
    }

    stopLoopLoadHistory() {
        clearTimeout(this.timerId)
        this.timerId = 0
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new PostwomanApp();
});