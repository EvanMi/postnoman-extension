// 后台脚本用于处理跨域请求和Cookie管理
const REQ_CACHE_PREFIX = "req_";
const REQ_START_TIME_PREFIX = "req_start_time_";
const STORAGE_KEY_RULES = "domainMatchRules";

// 点击扩展图标时打开侧边面板
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
  if (request.action === 'fetchWithCookies') {
    handleFetchWithCookies(request, sendResponse);
    return true; // 保持消息通道开放
  }
  if (request.action === 'saveRule') {
    saveRule(request.rules).then(() => {
      sendResponse({ success: true });
    })
    return true;
  }
  if (request.action === 'getMatchRules') {
    getMatchRules().then((data) => {
      sendResponse({ data });
    })
    return true;
  }
});

function matchDomain(targetDomain, rule) {
  if (rule.startsWith("*.")) {
    const suffix = rule.slice(2);
    return targetDomain.endsWith(suffix);
  }
  return targetDomain === rule;
}

function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname
  } catch (e) {
    return ""
  }
}

async function getMatchRules() {
  const data = await chrome.storage.local.get(STORAGE_KEY_RULES)
  return data[STORAGE_KEY_RULES] || []
}

async function saveRule(rules) {
  await chrome.storage.local.set({ [STORAGE_KEY_RULES]: rules })
}

async function getReqCache(requestId) {
  const key = REQ_CACHE_PREFIX + requestId;
  const cache = await chrome.storage.session.get(key);
  return cache[key] || null;
}

async function setReqCache(requestId, record) {
  const key = REQ_CACHE_PREFIX + requestId;
  await chrome.storage.session.set({ [key]: record });
}

async function delReqCache(requestId) {
  const key = REQ_CACHE_PREFIX + requestId;
  await chrome.storage.session.remove(key);
}

chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    const rules = await getMatchRules()
    const reqDomain = getDomainFromUrl(details.url)
    const isMatch = rules.some(rule => matchDomain(reqDomain, rule))
    if (!isMatch) {
      return
    }
    const record = {
      id: details.requestId,
      time: new Date().toLocaleString(),
      url: details.url,
      method: details.method,
      domain: reqDomain,
      initiator: details.initiator || "unknown",
      requestBody: null,
      requestHeaders: null,
      responseStatus: null,
      responseHeaders: null
    }

    if (details.requestBody) {
      if (details.requestBody.raw) {
        record.requestBody = new TextDecoder().decode(details.requestBody.raw[0].bytes)
      } else if (details.requestBody.formData) {
        record.requestBody = JSON.stringify(details.requestBody.formData)
      }
    }

    await setReqCache(details.requestId, record)
    const startTime = Date.now();

    const key = REQ_START_TIME_PREFIX + details.requestId;
    await chrome.storage.session.set({ [key]: startTime });

  }, { urls: ["<all_urls>"] }, ["requestBody"]
);

chrome.webRequest.onBeforeSendHeaders.addListener(
  async (details) => {
    const rules = await getMatchRules()
    const reqDomain = getDomainFromUrl(details.url)
    const isMatch = rules.some(rule => matchDomain(reqDomain, rule))
    if (!isMatch) {
      return
    }

    const record = await getReqCache(details.requestId)
    if (!record) {
      return
    }
    record.requestHeaders = details.requestHeaders.map(header => {
      return {
        name: header.name,
        value: header.value
      }
    })
    await setReqCache(details.requestId, record)
  }, { urls: ["<all_urls>"] }, ["requestHeaders", "extraHeaders"]
);

chrome.webRequest.onCompleted.addListener(
  async (details) => {
    const endTime = Date.now();
    const record = await getReqCache(details.requestId)

    const key = REQ_START_TIME_PREFIX + details.requestId
    const cache = await chrome.storage.session.get(key);
    const startTimeStr = cache[key];

    if (!record || !startTimeStr) {
      return
    }

    const startTime = Number(startTimeStr)

    record.responseStatus = details.statusCode
    record.responseHeaders = details.responseHeaders

    const storageData = await chrome.storage.local.get('postnomanHistory');
    let history = storageData.postnomanHistory || [];

    const responseData = {
      status: details.statusCode,
      statusText: details.statusText,
      headers: details.responseHeaders ? Object.fromEntries(details.responseHeaders.map(h => [h.name, h.value]))
        : {},
      body: '',
      responseTime: endTime - startTime,
      timestamp: new Date().toISOString()
    };

    const historyItem = {
      method: record.method,
      url: record.url,
      headers: record.requestHeaders
        ? Object.fromEntries(record.requestHeaders.map(h => [h.name, h.value]))
        : {},
      body: record.requestBody,
      response: responseData,
      timestamp: new Date().toISOString()
    };

    history.unshift(historyItem);
    if (history.length > 50) {
      history = history.slice(0, 50);
    }

    await chrome.storage.local.set({ postnomanHistory: history });

    await delReqCache(details.requestId)
  }, { urls: ["<all_urls>"] }, ["responseHeaders"]
);

// 处理带Cookie的请求
async function handleFetchWithCookies(request, sendResponse) {
  try {
    const { url, options, includeCookies } = request;

    if (includeCookies) {
      // 获取当前活动标签页的Cookie
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        const cookies = await chrome.cookies.getAll({ url: tabs[0].url });

        if (cookies.length > 0) {
          // 构建Cookie头
          const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

          // 添加到请求头
          if (!options.headers) {
            options.headers = {};
          }
          options.headers['Cookie'] = cookieHeader;
        }
      }
    }

    // 发送请求
    const response = await fetch(url, options);
    const responseData = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
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

    sendResponse({ success: true, data: responseData });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}