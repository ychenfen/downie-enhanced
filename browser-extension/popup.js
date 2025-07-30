// Popup script for Downie Enhanced browser extension

class DowniePopup {
  constructor() {
    this.currentTab = null;
    this.selectedQuality = 'best';
    this.selectedPostProcessing = 'none';
    this.serverOnline = false;
    this.detectedVideos = [];
    
    this.init();
  }

  async init() {
    // Get current tab info
    await this.getCurrentTab();
    
    // Check server status
    await this.checkServerStatus();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Load detected videos
    await this.loadDetectedVideos();
    
    // Auto-fill current tab URL
    this.fillCurrentTabUrl();
  }

  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
    } catch (error) {
      console.error('Failed to get current tab:', error);
    }
  }

  async checkServerStatus() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'checkServerStatus'
      });
      
      if (response.success && response.data.online) {
        this.serverOnline = true;
        statusDot.className = 'status-dot status-online';
        statusText.textContent = 'Server Online';
      } else {
        this.serverOnline = false;
        statusDot.className = 'status-dot status-offline';
        statusText.textContent = 'Server Offline';
      }
    } catch (error) {
      this.serverOnline = false;
      statusDot.className = 'status-dot status-offline';
      statusText.textContent = 'Server Offline';
    }
  }

  setupEventListeners() {
    // Use current tab button
    document.getElementById('useCurrentTab').addEventListener('click', () => {
      this.fillCurrentTabUrl();
    });

    // Analyze button
    document.getElementById('analyzeBtn').addEventListener('click', () => {
      this.analyzeUrl();
    });

    // Download button
    document.getElementById('downloadBtn').addEventListener('click', () => {
      this.startDownload();
    });

    // Open dashboard button
    document.getElementById('openDashboard').addEventListener('click', () => {
      chrome.tabs.create({ url: 'http://localhost:3000' });
      window.close();
    });

    // Quality selection
    document.getElementById('qualityGrid').addEventListener('click', (e) => {
      if (e.target.classList.contains('quality-option')) {
        this.selectQuality(e.target);
      }
    });

    // URL input enter key
    document.getElementById('urlInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.analyzeUrl();
      }
    });

    // Settings and help links
    document.getElementById('settingsLink').addEventListener('click', (e) => {
      e.preventDefault();
      this.showNotification('Settings coming soon!', 'info');
    });

    document.getElementById('helpLink').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://github.com/your-repo/downie-enhanced' });
    });
  }

  fillCurrentTabUrl() {
    if (this.currentTab && this.currentTab.url) {
      document.getElementById('urlInput').value = this.currentTab.url;
      
      // Auto-analyze if it's a video site
      const videoSites = ['youtube.com', 'vimeo.com', 'dailymotion.com', 'tiktok.com'];
      const isVideoSite = videoSites.some(site => this.currentTab.url.includes(site));
      
      if (isVideoSite) {
        setTimeout(() => this.analyzeUrl(), 500);
      }
    }
  }

  selectQuality(element) {
    // Remove previous selection
    document.querySelectorAll('.quality-option').forEach(opt => {
      opt.classList.remove('selected');
    });
    
    // Add selection to clicked element
    element.classList.add('selected');
    
    const quality = element.dataset.quality;
    
    // Map quality selection to internal format
    if (quality === 'audio') {
      this.selectedQuality = 'best';
      this.selectedPostProcessing = 'audio';
    } else if (quality === 'mp4') {
      this.selectedQuality = 'best';
      this.selectedPostProcessing = 'mp4';
    } else {
      this.selectedQuality = quality;
      this.selectedPostProcessing = 'none';
    }
  }

  async analyzeUrl() {
    const urlInput = document.getElementById('urlInput');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const url = urlInput.value.trim();

    if (!url) {
      this.showNotification('Please enter a URL', 'error');
      return;
    }

    if (!this.serverOnline) {
      this.showNotification('Server is offline', 'error');
      return;
    }

    // Show loading state
    analyzeBtn.innerHTML = '<div class="loading"></div> Analyzing...';
    analyzeBtn.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'extractVideoInfo',
        data: {
          url: url,
          cookies: await this.getCookiesForUrl(url)
        }
      });

      if (response.success) {
        const videoInfo = response.data;
        this.showVideoInfo(videoInfo);
        this.showNotification('Video analyzed successfully!', 'success');
      } else {
        this.showNotification(`Analysis failed: ${response.error}`, 'error');
      }
    } catch (error) {
      this.showNotification(`Analysis failed: ${error.message}`, 'error');
    } finally {
      analyzeBtn.innerHTML = '🔍 Analyze';
      analyzeBtn.disabled = false;
    }
  }

  showVideoInfo(videoInfo) {
    const detectedVideos = document.getElementById('detectedVideos');
    const videosList = document.getElementById('videosList');
    
    // Clear previous results
    videosList.innerHTML = '';
    
    if (videoInfo.formats && videoInfo.formats.length > 0) {
      // Show the detected videos section
      detectedVideos.style.display = 'block';
      
      // Create video item
      const videoItem = document.createElement('div');
      videoItem.className = 'video-item';
      videoItem.innerHTML = `
        <div class="video-title">${videoInfo.title || 'Video'}</div>
        <div class="video-url">${videoInfo.url}</div>
        <div style="margin-top: 8px; font-size: 11px;">
          📹 ${videoInfo.formats.length} format${videoInfo.formats.length > 1 ? 's' : ''} available
          ${videoInfo.duration ? ` • ${this.formatDuration(videoInfo.duration)}` : ''}
        </div>
      `;
      
      videosList.appendChild(videoItem);
    } else {
      detectedVideos.style.display = 'none';
    }
  }

  async loadDetectedVideos() {
    if (!this.currentTab) return;

    try {
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'detectVideos'
      });

      if (response && response.videos && response.videos.length > 0) {
        this.detectedVideos = response.videos;
        this.showDetectedVideos();
      }
    } catch (error) {
      // Content script might not be ready or page doesn't allow it
      console.log('Could not detect videos from page:', error);
    }
  }

  showDetectedVideos() {
    if (this.detectedVideos.length === 0) return;

    const detectedVideos = document.getElementById('detectedVideos');
    const videosList = document.getElementById('videosList');
    
    detectedVideos.style.display = 'block';
    videosList.innerHTML = '';

    this.detectedVideos.slice(0, 3).forEach((video, index) => { // Show max 3 videos
      const videoItem = document.createElement('div');
      videoItem.className = 'video-item';
      videoItem.style.cursor = 'pointer';
      videoItem.innerHTML = `
        <div class="video-title">${video.title}</div>
        <div class="video-url">${this.truncateUrl(video.url)}</div>
        <div style="margin-top: 4px; font-size: 10px; opacity: 0.8;">
          Type: ${video.type} • Click to download
        </div>
      `;
      
      videoItem.addEventListener('click', () => {
        document.getElementById('urlInput').value = video.url;
        this.startDownload();
      });
      
      videosList.appendChild(videoItem);
    });

    if (this.detectedVideos.length > 3) {
      const moreItem = document.createElement('div');
      moreItem.className = 'video-item';
      moreItem.style.textAlign = 'center';
      moreItem.style.opacity = '0.8';
      moreItem.innerHTML = `+${this.detectedVideos.length - 3} more videos detected`;
      videosList.appendChild(moreItem);
    }
  }

  async startDownload() {
    const urlInput = document.getElementById('urlInput');
    const downloadBtn = document.getElementById('downloadBtn');
    const url = urlInput.value.trim();

    if (!url) {
      this.showNotification('Please enter a URL', 'error');
      return;
    }

    if (!this.serverOnline) {
      this.showNotification('Server is offline. Please start Downie Enhanced.', 'error');
      return;
    }

    // Show loading state
    downloadBtn.innerHTML = '<div class="loading"></div> Starting...';
    downloadBtn.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'downloadUrl',
        data: {
          url: url,
          quality: this.selectedQuality,
          postProcessing: this.selectedPostProcessing,
          cookies: await this.getCookiesForUrl(url)
        }
      });

      if (response.success) {
        this.showNotification('Download started!', 'success');
        
        // Open dashboard to show progress
        setTimeout(() => {
          chrome.tabs.create({ url: 'http://localhost:3000' });
          window.close();
        }, 1000);
      } else {
        this.showNotification(`Download failed: ${response.error}`, 'error');
      }
    } catch (error) {
      this.showNotification(`Download failed: ${error.message}`, 'error');
    } finally {
      downloadBtn.innerHTML = '⬇️ Download';
      downloadBtn.disabled = false;
    }
  }

  async getCookiesForUrl(url) {
    try {
      const cookies = await chrome.cookies.getAll({ url });
      return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    } catch (error) {
      console.error('Failed to get cookies:', error);
      return '';
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    
    // Trigger reflow to ensure the class is applied
    notification.offsetHeight;
    
    notification.classList.add('show');
    
    setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  }

  formatDuration(seconds) {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  truncateUrl(url, maxLength = 40) {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new DowniePopup();
});