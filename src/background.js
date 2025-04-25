// Track the active state per tab
const activeTabs = new Set();

// Helper function to check if content script is active
const checkContentScriptState = (tabId) => {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, 1000);

    chrome.tabs.sendMessage(tabId, { action: 'getState' }, (response) => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        resolve(false);
      } else {
        resolve(response?.isActive || false);
      }
    });
  });
};

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url?.startsWith('http')) return;

  const tabId = tab.id;
  const isContentScriptActive = await checkContentScriptState(tabId);

  if (isContentScriptActive) {
    chrome.tabs.sendMessage(tabId, { action: 'deactivate' });
    activeTabs.delete(tabId);
    chrome.action.setIcon({ path: 'icons/icon@3x.png', tabId });
  } else {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/content.js'],
      });
    } catch (error) {
      // If already injected, it will fail. That's okay!
    }
    chrome.tabs.sendMessage(tabId, { action: 'activate' });
    activeTabs.add(tabId);
    chrome.action.setIcon({ path: 'icons/icon-active@3x.png', tabId });
  }
});

// Clean up activeTabs when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  activeTabs.delete(tabId);
});

// Clean up activeTabs when a tab navigates to a new URL
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    activeTabs.delete(tabId);
  }
});
