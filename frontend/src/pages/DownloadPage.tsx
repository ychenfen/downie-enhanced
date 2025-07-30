import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import VideoDownloader from '../components/VideoDownloader';
import { 
  ChartBarIcon, 
  CogIcon, 
  CloudDownloadIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';

interface DownloadStats {
  total_tasks: number;
  active_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  pending_tasks: number;
  total_downloaded_bytes: number;
  current_speed: number;
}

const DownloadPage: React.FC = () => {
  const [stats, setStats] = useState<DownloadStats | null>(null);
  const [supportedSites, setSupportedSites] = useState<string[]>([]);

  useEffect(() => {
    // Fetch initial stats
    fetchStats();
    fetchSupportedSites();

    // Update stats every 5 seconds
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/downloads/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchSupportedSites = async () => {
    try {
      const response = await fetch('/api/downloads/supported-sites');
      if (response.ok) {
        const data = await response.json();
        setSupportedSites(data.supported_sites);
      }
    } catch (error) {
      console.error('Failed to fetch supported sites:', error);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatSpeed = (speed: number): string => {
    return `${formatBytes(speed)}/s`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-6">
        {/* Stats Section */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <CloudDownloadIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {stats.active_tasks}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">Active Downloads</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {stats.completed_tasks}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">Completed</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                  <ClockIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {stats.pending_tasks}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">Pending</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <ChartBarIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {formatSpeed(stats.current_speed)}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">Current Speed</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Main Download Interface */}
        <VideoDownloader />

        {/* Supported Sites Section */}
        {supportedSites.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <CogIcon className="w-5 h-5 mr-2" />
              Supported Sites ({supportedSites.length})
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {supportedSites.map((site) => (
                <div
                  key={site}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm text-gray-700 dark:text-gray-300 text-center"
                >
                  {site}
                </div>
              ))}
            </div>
            
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                💡 <strong>Tip:</strong> Downie Enhanced supports many popular video sites including YouTube, Vimeo, 
                TikTok, Instagram, and many more. Simply paste any video URL to get started!
              </p>
            </div>
          </motion.div>
        )}

        {/* Usage Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6"
        >
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            📖 How to Use Downie Enhanced
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                1
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                Paste URL
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Copy and paste any video URL from supported sites into the input field above.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                2
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                Analyze & Configure
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Click "Analyze" to extract video info, then choose quality and post-processing options.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                3
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                Download
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Click "Download" and watch the progress in real-time. Files are saved to your downloads folder.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Feature Highlights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
        >
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            ✨ Key Features
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    High-Quality Downloads
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Download videos in the highest available quality, up to 4K resolution.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Format Conversion
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Convert videos to MP4 or extract audio to MP3 automatically.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Real-time Progress
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Watch download progress with speed, ETA, and completion percentage.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Batch Downloads
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Queue multiple downloads and manage them efficiently.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Encrypted Streams
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Handle encrypted M3U8 streams and protected content automatically.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Cross-Platform
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Works on any device with a web browser - no installation required.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DownloadPage;