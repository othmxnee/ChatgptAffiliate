//background.js
console.log('ChatGPT Product Detector background script loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('ChatGPT Product Detector extension installed');
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStatus') {
    sendResponse({ status: 'active' });
  }
});