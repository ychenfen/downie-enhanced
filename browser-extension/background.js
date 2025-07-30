// Background service worker for Downie Enhanced
// Based on Downie 4's browser extension functionality

const DOWNIE_API_BASE = 'http://localhost:8000/api';

// Create context menus when extension loads
chrome.runtime.onInstalled.addListener(() => {
  // Main download menu
  chrome.contextMenus.create({
    id: 'download-current-page',
    title: 'Download with Downie Enhanced',
    contexts: ['page']
  });

  // Link-specific download menu
  chrome.contextMenus.create({
    id: 'download-link',
    title: 'Download Link with Downie Enhanced',
    contexts: ['link']
  });

  // Video element menu
  chrome.contextMenus.create({
    id: 'download-video',
    title: 'Download Video with Downie Enhanced',
    contexts: ['video']
  });

  // Separator
  chrome.contextMenus.create({
    id: 'separator1',
    type: 'separator',
    contexts: ['page', 'link', 'video']
  });

  // Quality-specific options
  chrome.contextMenus.create({
    id: 'download-best',
    title: 'Download Best Quality',
    contexts: ['page', 'link']
  });

  chrome.contextMenus.create({
    id: 'download-720p',
    title: 'Download 720p',
    contexts: ['page', 'link']
  });

  chrome.contextMenus.create({
    id: 'download-audio',
    title: 'Download Audio Only',
    contexts: ['page', 'link']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const url = info.linkUrl || info.srcUrl || info.pageUrl || tab.url;
  let quality = 'best';
  let postProcessing = 'none';

  // Determine quality and post-processing based on menu item
  switch (info.menuItemId) {
    case 'download-720p':
      quality = '720p';
      break;
    case 'download-audio':
      postProcessing = 'audio';
      break;
    default:
      quality = 'best';
      break;
  }

  // Get cookies for the current tab
  const cookies = await getCookiesForUrl(url);

  // Send download request to Downie Enhanced backend
  try {
    await sendDownloadRequest(url, quality, postProcessing, cookies);
    
    // Show success notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon-48.png',
      title: 'Downie Enhanced',
      message: 'Download started successfully!'
    });
  } catch (error) {
    console.error('Download request failed:', error);
    
    // Show error notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon-48.png',
      title: 'Downie Enhanced',
      message: 'Failed to start download. Make sure Downie Enhanced is running.'
    });
  }
});

// Handle browser action click (extension icon)
chrome.action.onClicked.addListener(async (tab) => {
  const cookies = await getCookiesForUrl(tab.url);
  
  try {
    await sendDownloadRequest(tab.url, 'best', 'none', cookies);
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon-48.png',
      title: 'Downie Enhanced',
      message: 'Download started!'
    });
  } catch (error) {
    console.error('Download failed:', error);
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon-48.png',
      title: 'Downie Enhanced',
      message: 'Download failed. Check if Downie Enhanced is running.'
    });
  }
});

// Keyboard shortcut handler
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'download-current-tab') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const cookies = await getCookiesForUrl(tab.url);
    
    try {
      await sendDownloadRequest(tab.url, 'best', 'none', cookies);
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon-48.png',
        title: 'Downie Enhanced',
        message: 'Download started with keyboard shortcut!'
      });
    } catch (error) {
      console.error('Keyboard shortcut download failed:', error);
    }
  }
});

// Message handler for communication with content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'downloadUrl':
      handleDownloadRequest(request.data)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep message channel open for async response

    case 'getDownloadHistory':
      getDownloadHistory()
        .then(history => sendResponse({ success: true, data: history }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'checkServerStatus':
      checkServerStatus()
        .then(status => sendResponse({ success: true, data: status }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'extractVideoInfo':
      extractVideoInfo(request.data.url, request.data.cookies)
        .then(info => sendResponse({ success: true, data: info }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
  }
});

// Helper functions

async function getCookiesForUrl(url) {
  try {
    const cookies = await chrome.cookies.getAll({ url });
    return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  } catch (error) {
    console.error('Failed to get cookies:', error);
    return '';
  }
}

async function sendDownloadRequest(url, quality = 'best', postProcessing = 'none', cookies = '') {
  const response = await fetch(`${DOWNIE_API_BASE}/downloads/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      quality,
      post_processing: postProcessing,
      cookies
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();
  
  // Start the download
  const startResponse = await fetch(`${DOWNIE_API_BASE}/downloads/start/${result.task_id}`, {
    method: 'POST'
  });

  if (!startResponse.ok) {
    throw new Error('Failed to start download');
  }

  return result;
}

async function handleDownloadRequest(data) {
  const { url, quality = 'best', postProcessing = 'none', cookies = '' } = data;
  return await sendDownloadRequest(url, quality, postProcessing, cookies);
}

async function getDownloadHistory() {
  const response = await fetch(`${DOWNIE_API_BASE}/downloads/tasks`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch download history');
  }

  return await response.json();
}

async function checkServerStatus() {
  try {
    const response = await fetch(`${DOWNIE_API_BASE}/health`, {
      method: 'GET',
      timeout: 5000
    });
    
    if (response.ok) {
      const data = await response.json();
      return { online: true, data };
    } else {
      return { online: false, error: 'Server returned error' };
    }
  } catch (error) {
    return { online: false, error: error.message };
  }
}

async function extractVideoInfo(url, cookies = '') {
  const response = await fetch(`${DOWNIE_API_BASE}/downloads/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      quality: 'best',
      post_processing: 'none',
      cookies
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to extract video info: ${response.statusText}`);
  }

  return await response.json();
}

// Auto-detection of video URLs in tabs
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process when page has finished loading
  if (changeInfo.status !== 'complete' || !tab.url) return;

  // Check if URL might contain video content
  const videoSites = [
    'youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com',
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
    'tiktok.com', 'bilibili.com', 'xiaoeknow.com'
  ];

  const hasVideoSite = videoSites.some(site => tab.url.includes(site));
  
  if (hasVideoSite) {
    // Update extension badge to indicate video detected
    chrome.action.setBadgeText({
      tabId: tabId,
      text: '!'
    });
    
    chrome.action.setBadgeBackgroundColor({
      tabId: tabId,
      color: '#4CAF50'
    });
    
    chrome.action.setTitle({
      tabId: tabId,
      title: 'Video detected! Click to download with Downie Enhanced'
    });
  } else {
    // Clear badge for non-video sites
    chrome.action.setBadgeText({
      tabId: tabId,
      text: ''
    });
    
    chrome.action.setTitle({
      tabId: tabId,
      title: 'Download with Downie Enhanced'
    });
  }
});

// Handle web requests to detect video URLs
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    // Check for video file extensions in URLs
    const videoExtensions = ['.mp4', '.webm', '.m4v', '.mkv', '.avi', '.mov', '.flv', '.m3u8'];
    const hasVideoExtension = videoExtensions.some(ext => details.url.includes(ext));
    
    if (hasVideoExtension && details.tabId > 0) {
      // Notify content script about video URL
      chrome.tabs.sendMessage(details.tabId, {
        action: 'videoUrlDetected',
        url: details.url,
        type: 'direct'
      }).catch(() => {
        // Ignore errors if content script not ready
      });
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// Error handling for failed requests
chrome.runtime.onSuspend.addListener(() => {
  console.log('Downie Enhanced background script suspended');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Downie Enhanced background script started');
});

// Export functions for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getCookiesForUrl,
    sendDownloadRequest,
    checkServerStatus,
    extractVideoInfo
  };
}