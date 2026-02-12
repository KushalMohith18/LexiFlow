// Background service worker for LexiFlow

chrome.runtime.onInstalled.addListener(() => {
  console.log('LexiFlow extension installed');
  
  // Set default settings
  chrome.storage.sync.set({
    speed: 1.0,
    voice: 0
  });
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Forward status updates to popup if open
  if (request.action === 'statusUpdate') {
    chrome.runtime.sendMessage(request);
  }
  return true;
});