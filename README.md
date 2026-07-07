# PostNoman - Chrome API 测试插件

一个运行在 Chrome 侧边面板（Side Panel）中的 HTTP API 测试工具，类似于 Postman，支持手动发送请求和自动录制页面网络请求。

## 功能特性

### 手动请求发送
- **多种 HTTP 方法**：GET、POST、PUT、DELETE、PATCH、HEAD、OPTIONS
- **自定义请求头**：支持动态添加/删除多组 Header
- **查询参数**：支持键值对形式添加 URL 查询参数
- **请求体**：支持 JSON、Form Data、Raw Text 三种格式
- **认证方式**：支持 Bearer Token 和 Basic Auth
- **Cookie 携带**：可选择携带当前活动页面的 Cookie 发送请求

### 响应展示
- 显示 HTTP 状态码与状态文本
- 显示请求响应时间
- 分标签展示响应 Body 和响应 Headers
- JSON 响应自动格式化

### 网络请求自动录制
- 输入域名规则（支持 `*` 开头的通配符匹配），开始自动录制匹配的网络请求
- 录制内容包括：请求方法、URL、请求头、请求体、响应状态码、响应头、响应时间
- 录制期间自动刷新历史列表（每秒轮询）
- 支持将录制的请求历史导出为 JSON 文件

### 请求历史
- 自动保存所有手动/录制的请求（最多 100 条手动，50 条录制）
- 点击历史记录可快速回填请求参数并重放
- 支持一键清除历史记录
- 智能时间显示（刚刚、几分钟前、几小时前）

## 安装方法

1. 下载插件代码到本地
2. 打开 Chrome 浏览器，进入 `chrome://extensions/`
3. 开启右上角的「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择 `postnoman-extension` 目录
6. 点击浏览器工具栏上的插件图标，侧边面板将自动打开

## 使用说明

### 手动发送请求
1. 选择 HTTP 方法并输入请求 URL
2. 根据需要配置 Headers、Params、Body、Auth
3. 点击「发送」按钮
4. 在下方查看响应结果

### 自动录制请求
1. 在「请求历史」区域的输入框中输入要录制的域名（如 `example.com` 或 `*.example.com`）
2. 点击「开始记录」按钮
3. 在浏览器中正常操作，匹配域名的网络请求将被自动录制
4. 点击「停止记录」结束录制
5. 点击「下载记录」可导出 JSON 文件

## 文件结构

```
postnoman-extension/
├── manifest.json      # 插件配置文件（Manifest V3）
├── sidepanel.html     # 侧边面板界面
├── sidepanel.js       # 核心业务逻辑
├── sidepanel.css      # 界面样式
├── background.js      # 后台服务脚本（请求转发、网络录制）
├── icons/             # 插件图标
└── README.md          # 说明文档
```

## 技术实现

- **Manifest V3**：使用 Chrome 最新扩展规范
- **Side Panel API**：以侧边面板形式运行，不遮挡页面内容
- **chrome.webRequest API**：监听和录制浏览器网络请求
- **chrome.storage API**：使用 local 和 session storage 持久化数据
- **chrome.cookies API**：获取当前页面 Cookie 用于请求转发
- **纯原生实现**：无第三方框架依赖，纯 HTML/CSS/JS

## 权限说明

| 权限 | 用途 |
|------|------|
| `activeTab` | 获取当前活动标签页信息 |
| `cookies` | 读取当前页面 Cookie 用于请求携带 |
| `tabs` | 查询标签页信息 |
| `sidePanel` | 使用侧边面板展示 UI |
| `webRequest` | 监听网络请求用于自动录制 |
| `storage` | 保存历史记录和配置 |
| `<all_urls>` | 支持向任意 URL 发送请求和监听请求 |

## 浏览器兼容性

- Chrome 114+（需要 Side Panel API 支持）
- Edge 114+
- 其他支持 Manifest V3 和 Side Panel 的 Chromium 浏览器

## 许可证

MIT License