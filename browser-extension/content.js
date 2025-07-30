// Content script for Downie Enhanced
// Inspired by Downie 4's video detection capabilities

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    detectVideos: true,
    showNotifications: true,
    autoDetectM3U8: true,
    keyboardShortcuts: true
  };

  // Video detection patterns
  const VIDEO_PATTERNS = {
    direct: [
      /\.mp4(\?[^"'\s]*)?/gi,
      /\.webm(\?[^"'\s]*)?/gi,
      /\.m4v(\?[^"'\s]*)?/gi,
      /\.mkv(\?[^"'\s]*)?/gi,
      /\.avi(\?[^"'\s]*)?/gi,
      /\.mov(\?[^"'\s]*)?/gi,
      /\.flv(\?[^"'\s]*)?/gi
    ],
    streaming: [
      /\.m3u8(\?[^"'\s]*)?/gi,
      /\.mpd(\?[^"'\s]*)?/gi,
      /\.f4m(\?[^"'\s]*)?/gi
    ],
    embedded: [
      /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/gi,
      /player\.vimeo\.com\/video\/(\d+)/gi,
      /dailymotion\.com\/embed\/video\/([a-zA-Z0-9]+)/gi
    ]
  };

  // Detected videos storage
  let detectedVideos = new Set();
  let isInjected = false;

  // Initialize content script
  function init() {
    console.log('🎬 Downie Enhanced content script initialized');
    
    if (CONFIG.keyboardShortcuts) {
      setupKeyboardShortcuts();
    }
    
    if (CONFIG.detectVideos) {
      detectVideosOnPage();
      setupVideoObserver();
    }
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener(handleMessage);
    
    // Inject detection script
    injectDetectionScript();
  }

  // Setup keyboard shortcuts (similar to Downie 4)
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      // Ctrl+Shift+D (or Cmd+Shift+D on Mac) - Download current page
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        downloadCurrentPage();
      }
      
      // Ctrl+Shift+Alt+D - Download all detected videos
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.altKey && event.key === 'D') {
        event.preventDefault();
        downloadAllVideos();
      }
    });
  }

  // Detect videos on the current page
  function detectVideosOnPage() {
    const videos = [];
    
    // Method 1: Check video elements
    const videoElements = document.querySelectorAll('video');
    videoElements.forEach((video, index) => {
      const src = video.src || video.currentSrc;
      if (src && !detectedVideos.has(src)) {
        videos.push({
          url: src,
          type: 'video_element',
          element: video,
          title: video.title || `Video ${index + 1}`,
          poster: video.poster
        });
        detectedVideos.add(src);
      }
      
      // Check source elements
      const sources = video.querySelectorAll('source');
      sources.forEach(source => {
        const src = source.src;
        if (src && !detectedVideos.has(src)) {
          videos.push({
            url: src,
            type: 'source_element',
            element: source,
            title: `Video Source ${videos.length + 1}`
          });
          detectedVideos.add(src);
        }
      });
    });

    // Method 2: Scan page content for video URLs
    const pageContent = document.documentElement.innerHTML;
    
    // Check for direct video URLs
    VIDEO_PATTERNS.direct.forEach(pattern => {
      const matches = pageContent.match(pattern);
      if (matches) {
        matches.forEach(match => {
          // Extract full URL from context
          const urlMatch = pageContent.match(new RegExp(`["'](https?://[^"']*${match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"']*)["']`, 'gi'));
          if (urlMatch) {
            urlMatch.forEach(fullMatch => {
              const url = fullMatch.slice(1, -1); // Remove quotes
              if (!detectedVideos.has(url)) {
                videos.push({
                  url: url,
                  type: 'direct_url',
                  title: `Direct Video ${videos.length + 1}`
                });
                detectedVideos.add(url);
              }
            });
          }
        });
      }
    });

    // Check for streaming URLs (M3U8, MPD)
    VIDEO_PATTERNS.streaming.forEach(pattern => {
      const matches = pageContent.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const urlMatch = pageContent.match(new RegExp(`["'](https?://[^"']*${match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"']*)["']`, 'gi'));
          if (urlMatch) {
            urlMatch.forEach(fullMatch => {
              const url = fullMatch.slice(1, -1);
              if (!detectedVideos.has(url)) {
                videos.push({
                  url: url,
                  type: 'streaming_url',
                  title: `Stream ${videos.length + 1}`,
                  encrypted: url.includes('key=') || url.includes('token=')
                });
                detectedVideos.add(url);
              }
            });
          }
        });
      }
    });

    // Method 3: Check for embedded players
    VIDEO_PATTERNS.embedded.forEach(pattern => {
      const matches = pageContent.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (!detectedVideos.has(match)) {
            videos.push({
              url: match,
              type: 'embedded_player',
              title: `Embedded Video ${videos.length + 1}`
            });
            detectedVideos.add(match);
          }
        });
      }
    });

    if (videos.length > 0) {
      console.log(`🎬 Detected ${videos.length} videos:`, videos);
      
      // Show notification if enabled
      if (CONFIG.showNotifications) {
        showVideoDetectionNotification(videos.length);
      }
      
      // Send to background script
      chrome.runtime.sendMessage({
        action: 'videosDetected',
        data: {
          url: window.location.href,
          videos: videos,
          count: videos.length
        }
      });
    }

    return videos;
  }

  // Setup MutationObserver to detect dynamically loaded videos
  function setupVideoObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldRedetect = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Check if any video elements were added
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.tagName === 'VIDEO' || node.querySelector('video')) {
                shouldRedetect = true;
              }
            }
          });
        } else if (mutation.type === 'attributes') {
          // Check if src attributes changed on video elements
          if (mutation.target.tagName === 'VIDEO' && mutation.attributeName === 'src') {
            shouldRedetect = true;
          }
        }
      });
      
      if (shouldRedetect) {
        setTimeout(detectVideosOnPage, 1000); // Delay to allow content to fully load
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });
  }

  // Inject script for deeper video detection
  function injectDetectionScript() {
    if (isInjected) return;
    
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = function() {
      this.remove();
      isInjected = true;
    };
    (document.head || document.documentElement).appendChild(script);
  }

  // Handle messages from background script
  function handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'detectVideos':
        const videos = detectVideosOnPage();
        sendResponse({ videos: videos });
        break;
        
      case 'downloadCurrentPage':
        downloadCurrentPage();
        sendResponse({ success: true });
        break;
        
      case 'getPageInfo':
        sendResponse({
          url: window.location.href,
          title: document.title,
          detectedVideos: Array.from(detectedVideos)
        });
        break;
        
      case 'videoUrlDetected':
        handleVideoUrlDetected(request.url, request.type);
        break;
        
      default:
        sendResponse({ error: 'Unknown action' });
    }
  }

  // Download current page
  function downloadCurrentPage() {
    chrome.runtime.sendMessage({
      action: 'downloadUrl',
      data: {
        url: window.location.href,
        quality: 'best',
        postProcessing: 'none',
        cookies: document.cookie
      }
    }, (response) => {
      if (response.success) {
        showNotification('Download started!', 'success');
      } else {
        showNotification('Download failed: ' + response.error, 'error');
      }
    });
  }

  // Download all detected videos
  function downloadAllVideos() {
    const videos = Array.from(detectedVideos);
    
    if (videos.length === 0) {
      showNotification('No videos detected on this page', 'warning');
      return;
    }

    videos.forEach((videoUrl) => {
      chrome.runtime.sendMessage({
        action: 'downloadUrl',
        data: {
          url: videoUrl,
          quality: 'best',
          postProcessing: 'none',
          cookies: document.cookie
        }
      });
    });

    showNotification(`Started downloading ${videos.length} videos`, 'success');
  }

  // Handle video URL detection from web requests
  function handleVideoUrlDetected(url, type) {
    if (!detectedVideos.has(url)) {
      detectedVideos.add(url);
      console.log(`🎬 New video URL detected: ${url} (${type})`);
      
      // Show subtle notification
      showVideoDetectionNotification(1, type);
    }
  }

  // Show video detection notification
  function showVideoDetectionNotification(count, type = 'general') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
    `;
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center;">
        <span style="margin-right: 8px;">🎬</span>
        <span>${count} video${count > 1 ? 's' : ''} detected! Right-click to download.</span>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    requestAnimationFrame(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    });
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // Show general notification
  function showNotification(message, type = 'info') {
    const colors = {
      success: '#4CAF50',
      error: '#f44336',
      warning: '#ff9800',
      info: '#2196F3'
    };
    
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type]};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 300px;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 4000);
  }

  // Listen for page navigation (SPA support)
  let currentUrl = window.location.href;
  
  function checkForUrlChange() {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      // Reset detected videos for new page
      detectedVideos.clear();
      // Re-detect videos after a short delay
      setTimeout(detectVideosOnPage, 2000);
    }
  }

  // Check for URL changes every second (for SPAs)
  setInterval(checkForUrlChange, 1000);

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Listen for window events
  window.addEventListener('load', () => {
    // Re-detect videos after page fully loads
    setTimeout(detectVideosOnPage, 3000);
  });

  // Export for debugging
  if (typeof window !== 'undefined') {
    window.downieEnhanced = {
      detectedVideos: detectedVideos,
      detectVideos: detectVideosOnPage,
      downloadCurrentPage: downloadCurrentPage,
      downloadAllVideos: downloadAllVideos
    };
  }

})();