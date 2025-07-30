import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CloudDownloadIcon, 
  PlayIcon, 
  PauseIcon, 
  StopIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  CogIcon,
  ClipboardCopyIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// Types based on Downie 4 functionality
interface VideoFormat {
  format_id: string;
  url: string;
  ext: string;
  quality: string;
  filesize?: number;
  width?: number;
  height?: number;
  fps?: number;
}

interface VideoInfo {
  url: string;
  title: string;
  duration: number;
  thumbnail: string;
  description: string;
  uploader: string;
  formats: VideoFormat[];
}

interface DownloadTask {
  id: string;
  url: string;
  title: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  progress_percentage: number;
  downloaded_bytes: number;
  total_bytes: number;
  speed: number;
  eta: number;
  error_message?: string;
}

const VideoDownloader: React.FC = () => {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [selectedQuality, setSelectedQuality] = useState('best');
  const [postProcessing, setPostProcessing] = useState('none');
  const [downloads, setDownloads] = useState<DownloadTask[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/api/downloads/ws');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'progress') {
        setDownloads(prev => prev.map(task => 
          task.id === data.task_id 
            ? { ...task, ...data.progress }
            : task
        ));
      } else if (data.type === 'initial') {
        setDownloads(data.tasks);
      }
    };

    return () => ws.close();
  }, []);

  const analyzeUrl = async () => {
    if (!url.trim()) {
      toast.error('Please enter a valid URL');
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/downloads/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, quality: 'best', post_processing: 'none', cookies: '' })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze URL');
      }

      const data = await response.json();
      setVideoInfo(data);
      toast.success('Video information extracted successfully!');
    } catch (error) {
      toast.error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startDownload = async () => {
    if (!videoInfo) return;

    try {
      const response = await fetch('/api/downloads/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: videoInfo.url,
          quality: selectedQuality,
          post_processing: postProcessing,
          cookies: ''
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create download task');
      }

      const data = await response.json();
      
      // Start the download
      await fetch(`/api/downloads/start/${data.task_id}`, { method: 'POST' });
      
      toast.success('Download started!');
      setVideoInfo(null);
      setUrl('');
    } catch (error) {
      toast.error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const cancelDownload = async (taskId: string) => {
    try {
      await fetch(`/api/downloads/cancel/${taskId}`, { method: 'POST' });
      toast.success('Download cancelled');
    } catch (error) {
      toast.error('Failed to cancel download');
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
        <p className="text-gray-600 dark:text-gray-400">
          Modern Web Video Downloader
        </p>
      </div>

      {/* URL Input Section */}
      <motion.div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="space-y-4">
          <div className="flex space-x-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste video URL here..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              onKeyPress={(e) => e.key === 'Enter' && analyzeUrl()}
            />
            <button
              onClick={analyzeUrl}
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
        </div>
      </motion.div>

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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Downloads
          </h2>

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
                          onClick={() => cancelDownload(task.id)}
                          className="p-1 text-red-500 hover:text-red-700"
                        >
                          <StopIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => navigator.clipboard.writeText(task.url)}
                        className="p-1 text-gray-500 hover:text-gray-700"
                      >
                        <ClipboardCopyIcon className="w-4 h-4" />
                      </button>
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