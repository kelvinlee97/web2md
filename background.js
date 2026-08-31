// Service worker:触发 → 按需注入 → storage.session 交接 → 打开 UI 页。
// SW 只在一个唤醒周期内做这几件事,payload 存浏览器内存而非 SW 进程,
// 30 秒生命周期被结构性消除。

const MENU = { 'w2m-article': 'article', 'w2m-full': 'full' };

// 菜单项跨 SW 休眠持久存在,只在 onInstalled 注册(先 removeAll 保证开发期重载确定)。
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'w2m-article', title: 'Web2MD:转换文章为 Markdown', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'w2m-full', title: 'Web2MD:转换整页为 Markdown', contexts: ['page'] });
  });
});

async function save(tabId, payload) {
  try {
    await chrome.storage.session.set({ ['t' + tabId]: payload });
  } catch {
    await chrome.storage.session.set({ ['t' + tabId]: { error: '转换结果过大(超过存储上限),无法保存。' } });
  }
}

function openUi(tabId) {
  chrome.tabs.create({ url: chrome.runtime.getURL('ui/ui.html?tab=' + tabId) });
}

async function run(tab, mode) {
  try {
    // 模式只能通过 func 传参,与 files 不能同调用,故两次 executeScript。
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (m) => { globalThis.__WEB2MD_MODE = m; },
      args: [mode],
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['core/extract.js', 'core/serialize.js', 'core/article.js', 'core/integrity.js', 'content.js'],
    });
  } catch {
    await save(tab.id, { error: '此页面无法转换(浏览器内置页面,或 file:// 页面未授权访问)。' });
    openUi(tab.id);
  }
}

chrome.action.onClicked.addListener((tab) => run(tab, 'article'));
chrome.contextMenus.onClicked.addListener((info, tab) => { if (tab) run(tab, MENU[info.menuItemId] || 'article'); });

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== 'WEB2MD_RESULT' || sender.tab == null) return;
  save(sender.tab.id, msg.payload).then(() => openUi(sender.tab.id));
});
