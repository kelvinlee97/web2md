// Service worker: trigger → inject on demand → hand off via storage.session → open the UI page.
// The SW only does these things within a single wake cycle; the payload lives in browser
// storage, not SW process memory, so the 30-second SW lifetime is structurally irrelevant.

const MENU = { 'w2m-article': 'article', 'w2m-full': 'full' };

// Menu items persist across SW sleep cycles, so they're only registered in onInstalled
// (removeAll first, to keep dev reloads idempotent).
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'w2m-article', title: 'Web2MD: Convert article to Markdown', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'w2m-full', title: 'Web2MD: Convert full page to Markdown', contexts: ['page'] });
  });
});

async function save(tabId, payload) {
  try {
    await chrome.storage.session.set({ ['t' + tabId]: payload });
  } catch {
    await chrome.storage.session.set({ ['t' + tabId]: { error: 'The conversion result is too large (exceeds storage limits) and could not be saved.' } });
  }
}

function openUi(tabId) {
  chrome.tabs.create({ url: chrome.runtime.getURL('ui/ui.html?tab=' + tabId) });
}

async function run(tab, mode) {
  try {
    // Mode can only be passed via `func`, which can't be combined with `files` in one call,
    // hence two executeScript calls.
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
    await save(tab.id, { error: 'This page cannot be converted (a built-in browser page, or a file:// page without access granted).' });
    openUi(tab.id);
  }
}

chrome.action.onClicked.addListener((tab) => run(tab, 'article'));
chrome.contextMenus.onClicked.addListener((info, tab) => { if (tab) run(tab, MENU[info.menuItemId] || 'article'); });

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== 'WEB2MD_RESULT' || sender.tab == null) return;
  save(sender.tab.id, msg.payload).then(() => openUi(sender.tab.id));
});
