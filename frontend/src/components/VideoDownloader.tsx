import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CloudDownloadIcon, 
  PlayIcon, 
  PauseIcon, 
  StopIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  CogIcon,
  ClipboardCopyIcon,
  TrashIcon,
  FolderIcon,
  DocumentDuplicateIcon,
  Cog6ToothIcon,
  QueueListIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useDownload } from '../hooks/useDownload';
import { DownloadRequest } from '../types';

// Additional interfaces for enhanced features
interface BatchDownload {
  urls: string[];
  quality: string;
  postProcessing: string;
}

interface DownloadStats {
  total: number;
  active: number;
  completed: number;
  failed: number;
  totalSize: number;
  currentSpeed: number;
}

interface UserSettings {
  defaultQuality: string;
  defaultPostProcessing: string;
  autoStart: boolean;
  maxConcurrent: number;
  downloadPath: string;
  theme: 'light' | 'dark' | 'system';
}

const VideoDownloader: React.FC = () => {
  const [url, setUrl] = useState('');
  const [batchUrls, setBatchUrls] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [selectedQuality, setSelectedQuality] = useState('best');
  const [postProcessing, setPostProcessing] = useState('none');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<'single' | 'batch' | 'settings'>('single');
  const [userSettings, setUserSettings] = useState<UserSettings>({
    defaultQuality: 'best',
    defaultPostProcessing: 'none',
    autoStart: false,
    maxConcurrent: 3,
    downloadPath: './downloads',
    theme: 'system'
  });
  const [showStats, setShowStats] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);
  
  const {
    tasks: downloads,
    stats,
    isConnected,
    addDownload,
    startDownload: startTask,
    cancelDownload,
    removeTask,
    extractVideoInfo
  } = useDownload();

  // Load user settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('downie-settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setUserSettings(settings);
        setSelectedQuality(settings.defaultQuality);
        setPostProcessing(settings.defaultPostProcessing);
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = (newSettings: UserSettings) => {
    setUserSettings(newSettings);
    localStorage.setItem('downie-settings', JSON.stringify(newSettings));
  };

  // Auto-focus URL input
  useEffect(() => {
    if (activeTab === 'single' && urlInputRef.current) {
      urlInputRef.current.focus();
    }
  }, [activeTab]);

  const analyzeUrl = async (urlToAnalyze?: string) => {
    const targetUrl = urlToAnalyze || url;
    if (!targetUrl.trim()) {
      toast.error('Please enter a valid URL');
      return;
    }

    setIsAnalyzing(true);
    try {
      const videoInfo = await extractVideoInfo(targetUrl);
      setVideoInfo(videoInfo);
      toast.success('Video information extracted successfully!');
    } catch (error) {
      toast.error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
        setUrl(text);
        if (userSettings.autoStart) {
          analyzeUrl(text);
        }
        toast.success('URL pasted from clipboard!');
      } else {
        toast.error('No valid URL found in clipboard');
      }
    } catch (error) {
      toast.error('Failed to read from clipboard');
    }
  };

  const startDownload = async () => {
    if (!videoInfo) return;

    try {
      const request: DownloadRequest = {
        url: videoInfo.url,
        quality: selectedQuality as any,
        post_processing: postProcessing as any,
        cookies: ''
      };
      
      const taskId = await addDownload(request);
      await startTask(taskId);
      
      toast.success('Download started!');
      setVideoInfo(null);
      setUrl('');
    } catch (error) {
      toast.error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleBatchDownload = async () => {
    const urls = batchUrls.split('\n').filter(url => url.trim());
    if (urls.length === 0) {
      toast.error('Please enter at least one URL');
      return;
    }

    const loadingToast = toast.loading(`Processing ${urls.length} URLs...`);
    let successCount = 0;
    let failCount = 0;

    for (const url of urls) {
      try {
        const request: DownloadRequest = {
          url: url.trim(),
          quality: selectedQuality as any,
          post_processing: postProcessing as any,
          cookies: ''
        };
        
        const taskId = await addDownload(request);
        if (userSettings.autoStart) {
          await startTask(taskId);
        }
        successCount++;
      } catch (error) {
        failCount++;
      }
    }

    toast.dismiss(loadingToast);
    
    if (failCount === 0) {
      toast.success(`All ${successCount} downloads added successfully!`);
    } else {
      toast.error(`${successCount} successful, ${failCount} failed`);
    }
    
    setBatchUrls('');
  };

  const handleCancelDownload = async (taskId: string) => {
    try {
      await cancelDownload(taskId);
      toast.success('Download cancelled');
    } catch (error) {
      toast.error('Failed to cancel download');
    }
  };

  const handleRemoveTask = async (taskId: string) => {
    try {
      await removeTask(taskId);
      toast.success('Task removed');
    } catch (error) {
      toast.error('Failed to remove task');
    }
  };

  const clearCompletedTasks = async () => {
    const completedTasks = downloads.filter(task => task.status === 'completed' || task.status === 'failed');
    if (completedTasks.length === 0) {
      toast.error('No completed tasks to clear');
      return;
    }

    const loadingToast = toast.loading('Clearing completed tasks...');
    try {
      for (const task of completedTasks) {
        await removeTask(task.id);
      }
      toast.dismiss(loadingToast);
      toast.success(`Cleared ${completedTasks.length} completed tasks`);
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Failed to clear some tasks');
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatSpeed = (speed: number): string => {
    return `${formatBytes(speed)}/s`;
  };

  const formatETA = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'downloading':
        return <CloudDownloadIcon className="w-5 h-5 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <ExclamationCircleIcon className="w-5 h-5 text-red-500" />;
      default:
        return <PlayIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          🎬 Downie Enhanced
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Modern Web Video Downloader
        </p>
        
        {/* Connection Status */}
        <div className="flex items-center justify-center space-x-4 text-sm">
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
            isConnected 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          
          {stats && (
            <button
              onClick={() => setShowStats(!showStats)}
              className="flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors"
            >
              <ChartBarIcon className="w-4 h-4" />
              <span>Stats</span>
            </button>
          )}
        </div>
      </div>

      {/* Statistics Panel */}
      <AnimatePresence>
        {showStats && stats && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Download Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.total_tasks}</div>
                <div className="text-sm text-gray-500">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.completed_tasks}</div>
                <div className="text-sm text-gray-500">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.active_tasks}</div>
                <div className="text-sm text-gray-500">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.failed_tasks}</div>
                <div className="text-sm text-gray-500">Failed</div>
              </div>
            </div>
            {stats.current_speed > 0 && (
              <div className="mt-4 text-center">
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  Current Speed: {formatSpeed(stats.current_speed)}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('single')}
            className={`flex-1 px-4 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
              activeTab === 'single'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <PlayIcon className="w-4 h-4 inline mr-2" />
            Single Download
          </button>
          <button
            onClick={() => setActiveTab('batch')}
            className={`flex-1 px-4 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
              activeTab === 'batch'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <QueueListIcon className="w-4 h-4 inline mr-2" />
            Batch Download
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 px-4 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Cog6ToothIcon className="w-4 h-4 inline mr-2" />
            Settings
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'single' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex space-x-2">
                <input
                  ref={urlInputRef}
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste video URL here..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  onKeyPress={(e) => e.key === 'Enter' && analyzeUrl()}
                />
                <button
                  onClick={handlePasteFromClipboard}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center space-x-2"
                  title="Paste from clipboard"
                >
                  <DocumentDuplicateIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => analyzeUrl()}
                  disabled={isAnalyzing}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isAnalyzing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <PlayIcon className="w-4 h-4" />
                  )}
                  <span>{isAnalyzing ? 'Analyzing...' : 'Analyze'}</span>
                </button>
              </div>

              {/* Advanced Options Toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                <CogIcon className="w-4 h-4" />
                <span>Advanced Options</span>
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Quality
                      </label>
                      <select
                        value={selectedQuality}
                        onChange={(e) => setSelectedQuality(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      >
                        <option value="best">Best Quality</option>
                        <option value="1080p">1080p</option>
                        <option value="720p">720p</option>
                        <option value="480p">480p</option>
                        <option value="360p">360p</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Post-processing
                      </label>
                      <select
                        value={postProcessing}
                        onChange={(e) => setPostProcessing(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      >
                        <option value="none">None</option>
                        <option value="audio">Extract Audio Only</option>
                        <option value="mp4">Convert to MP4</option>
                      </select>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTab === 'batch' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Video URLs (one per line)
                </label>
                <textarea
                  value={batchUrls}
                  onChange={(e) => setBatchUrls(e.target.value)}
                  placeholder="https://example.com/video1\nhttps://example.com/video2\nhttps://example.com/video3"
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Quality
                  </label>
                  <select
                    value={selectedQuality}
                    onChange={(e) => setSelectedQuality(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    <option value="best">Best Quality</option>
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                    <option value="480p">480p</option>
                    <option value="360p">360p</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Post-processing
                  </label>
                  <select
                    value={postProcessing}
                    onChange={(e) => setPostProcessing(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    <option value="none">None</option>
                    <option value="audio">Extract Audio Only</option>
                    <option value="mp4">Convert to MP4</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={handleBatchDownload}
                  disabled={!batchUrls.trim()}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <QueueListIcon className="w-4 h-4" />
                  <span>Add Batch Downloads</span>
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Default Quality
                  </label>
                  <select
                    value={userSettings.defaultQuality}
                    onChange={(e) => saveSettings({...userSettings, defaultQuality: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    <option value="best">Best Quality</option>
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                    <option value="480p">480p</option>
                    <option value="360p">360p</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Default Post-processing
                  </label>
                  <select
                    value={userSettings.defaultPostProcessing}
                    onChange={(e) => saveSettings({...userSettings, defaultPostProcessing: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    <option value="none">None</option>
                    <option value="audio">Extract Audio Only</option>
                    <option value="mp4">Convert to MP4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Concurrent Downloads
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={userSettings.maxConcurrent}
                    onChange={(e) => saveSettings({...userSettings, maxConcurrent: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Download Path
                  </label>
                  <input
                    type="text"
                    value={userSettings.downloadPath}
                    onChange={(e) => saveSettings({...userSettings, downloadPath: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="autoStart"
                    checked={userSettings.autoStart}
                    onChange={(e) => saveSettings({...userSettings, autoStart: e.target.checked})}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="autoStart" className="text-sm text-gray-700 dark:text-gray-300">
                    Auto-start downloads when pasting URLs
                  </label>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Video Info Section */}
      <AnimatePresence>
        {videoInfo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
          >
            <div className="flex items-start space-x-4">
              {videoInfo.thumbnail && (
                <img
                  src={videoInfo.thumbnail}
                  alt={videoInfo.title}
                  className="w-32 h-20 object-cover rounded-lg"
                />
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {videoInfo.title}
                </h3>
                {videoInfo.uploader && (
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    by {videoInfo.uploader}
                  </p>
                )}
                <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                  {videoInfo.duration > 0 && (
                    <span>Duration: {Math.floor(videoInfo.duration / 60)}:{String(videoInfo.duration % 60).padStart(2, '0')}</span>
                  )}
                  <span>Formats: {videoInfo.formats.length}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setVideoInfo(null)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={startDownload}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
              >
                <CloudDownloadIcon className="w-4 h-4" />
                <span>Download</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Downloads List */}
      {downloads.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Downloads ({downloads.length})
            </h2>
            <div className="flex space-x-2">
              <button
                onClick={clearCompletedTasks}
                className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center space-x-1"
              >
                <TrashIcon className="w-4 h-4" />
                <span>Clear Completed</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <AnimatePresence>
              {downloads.map((task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(task.status)}
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {task.title}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-md">
                          {task.url}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {task.status === 'downloading' && (
                        <button
                          onClick={() => handleCancelDownload(task.id)}
                          className="p-1 text-red-500 hover:text-red-700"
                          title="Cancel download"
                        >
                          <StopIcon className="w-4 h-4" />
                        </button>
                      )}
                      {(task.status === 'completed' || task.status === 'failed') && (
                        <button
                          onClick={() => handleRemoveTask(task.id)}
                          className="p-1 text-red-500 hover:text-red-700"
                          title="Remove task"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => navigator.clipboard.writeText(task.url)}
                        className="p-1 text-gray-500 hover:text-gray-700"
                        title="Copy URL"
                      >
                        <ClipboardCopyIcon className="w-4 h-4" />
                      </button>
                      {task.status === 'completed' && (
                        <button
                          onClick={() => {
                            // Open file location (if supported by browser)
                            if ('showDirectoryPicker' in window) {
                              toast.success('Feature coming soon: Open file location');
                            } else {
                              toast.info('File saved to: ' + userSettings.downloadPath);
                            }
                          }}
                          className="p-1 text-blue-500 hover:text-blue-700"
                          title="Show in folder"
                        >
                          <FolderIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {task.status === 'downloading' && (
                    <div className="space-y-2">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${task.progress_percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>
                          {task.progress_percentage.toFixed(1)}% - {formatBytes(task.downloaded_bytes)}
                          {task.total_bytes > 0 && ` / ${formatBytes(task.total_bytes)}`}
                        </span>
                        <span>
                          {task.speed > 0 && `${formatSpeed(task.speed)}`}
                          {task.eta > 0 && ` - ETA: ${formatETA(task.eta)}`}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Error Message */}
                  {task.status === 'failed' && task.error_message && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
                      {task.error_message}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default VideoDownloader;