import { useState, useEffect, useCallback } from 'react';
import { 
  DownloadTask, 
  DownloadStats, 
  DownloadRequest, 
  VideoInfo, 
  WebSocketMessage,
  UseDownloadReturn 
} from '../types';
import { downloadAPI } from '../utils/api';
import { useWebSocket } from './useWebSocket';

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/api/downloads/ws';

export const useDownload = (): UseDownloadReturn => {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [stats, setStats] = useState<DownloadStats | null>(null);
  
  const { isConnected, lastMessage } = useWebSocket(WS_URL);

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    const message = lastMessage as WebSocketMessage;
    
    switch (message.type) {
      case 'initial':
        if (message.tasks) {
          setTasks(message.tasks);
        }
        break;
        
      case 'progress':
        if (message.task_id && message.progress) {
          setTasks(prevTasks => 
            prevTasks.map(task => 
              task.id === message.task_id 
                ? { 
                    ...task, 
                    status: message.progress!.status,
                    progress_percentage: message.progress!.percentage,
                    downloaded_bytes: message.progress!.downloaded_bytes,
                    total_bytes: message.progress!.total_bytes,
                    speed: message.progress!.speed,
                    eta: message.progress!.eta,
                    error_message: message.progress!.error_message || ''
                  }
                : task
            )
          );
        }
        break;
        
      case 'heartbeat':
        // Handle heartbeat if needed
        break;
        
      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
  }, [lastMessage]);

  // Fetch initial data and stats
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch tasks if WebSocket is not connected
        if (!isConnected) {
          const tasksData = await downloadAPI.getTasks();
          setTasks(tasksData);
        }
        
        // Fetch stats
        const statsData = await downloadAPI.getStats();
        setStats(statsData);
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
      }
    };

    fetchInitialData();
    
    // Set up periodic stats refresh
    const interval = setInterval(async () => {
      try {
        const statsData = await downloadAPI.getStats();
        setStats(statsData);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isConnected]);

  // Add download task
  const addDownload = useCallback(async (request: DownloadRequest): Promise<string> => {
    try {
      const response = await downloadAPI.addDownload(request);
      
      // Optimistically add task to local state
      const newTask: DownloadTask = {
        id: response.task_id,
        url: request.url,
        title: 'Loading...',
        status: 'pending',
        progress_percentage: 0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed: 0,
        eta: 0,
        created_at: Date.now() / 1000
      };
      
      setTasks(prevTasks => [newTask, ...prevTasks]);
      
      return response.task_id;
    } catch (error) {
      console.error('Failed to add download:', error);
      throw error;
    }
  }, []);

  // Start download
  const startDownload = useCallback(async (taskId: string): Promise<void> => {
    try {
      await downloadAPI.startDownload(taskId);
      
      // Update task status optimistically
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId
            ? { ...task, status: 'starting', started_at: Date.now() / 1000 }
            : task
        )
      );
    } catch (error) {
      console.error('Failed to start download:', error);
      throw error;
    }
  }, []);

  // Cancel download
  const cancelDownload = useCallback(async (taskId: string): Promise<void> => {
    try {
      await downloadAPI.cancelDownload(taskId);
      
      // Update task status optimistically
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId
            ? { ...task, status: 'cancelled' }
            : task
        )
      );
    } catch (error) {
      console.error('Failed to cancel download:', error);
      throw error;
    }
  }, []);

  // Remove task
  const removeTask = useCallback(async (taskId: string): Promise<void> => {
    try {
      await downloadAPI.deleteTask(taskId);
      
      // Remove task from local state
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
    } catch (error) {
      console.error('Failed to remove task:', error);
      throw error;
    }
  }, []);

  // Extract video info
  const extractVideoInfo = useCallback(async (url: string, cookies = ''): Promise<VideoInfo> => {
    try {
      const videoInfo = await downloadAPI.extractVideoInfo({
        url,
        quality: 'best',
        post_processing: 'none',
        cookies
      });
      
      return videoInfo;
    } catch (error) {
      console.error('Failed to extract video info:', error);
      throw error;
    }
  }, []);

  return {
    tasks,
    stats,
    isConnected,
    addDownload,
    startDownload,
    cancelDownload,
    removeTask,
    extractVideoInfo
  };
};