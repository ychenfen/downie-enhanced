// Global type definitions for Downie Enhanced

export interface VideoFormat {
  format_id: string;
  url: string;
  ext: string;
  quality: string;
  filesize?: number;
  width?: number;
  height?: number;
  fps?: number;
  vcodec?: string;
  acodec?: string;
  tbr?: number;
  vbr?: number;
  abr?: number;
}

export interface VideoInfo {
  url: string;
  title: string;
  duration: number;
  thumbnail: string;
  description: string;
  uploader: string;
  upload_date: string;
  view_count: number;
  like_count: number;
  formats: VideoFormat[];
}

export type DownloadStatus = 
  | 'pending'
  | 'starting'
  | 'downloading'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export interface DownloadProgress {
  downloaded_bytes: number;
  total_bytes: number;
  speed: number;
  eta: number;
  percentage: number;
  status: DownloadStatus;
  error_message?: string;
}

export interface DownloadTask {
  id: string;
  url: string;
  title: string;
  status: DownloadStatus;
  progress_percentage: number;
  downloaded_bytes: number;
  total_bytes: number;
  speed: number;
  eta: number;
  created_at: number;
  started_at?: number;
  completed_at?: number;
  error_message?: string;
}

export type VideoQuality = 
  | 'auto'
  | 'best'
  | '1080p'
  | '720p'
  | '480p'
  | '360p'
  | 'worst';

export type PostProcessing = 
  | 'none'
  | 'audio'
  | 'mp4'
  | 'permute';

export interface DownloadRequest {
  url: string;
  quality: VideoQuality;
  post_processing: PostProcessing;
  cookies?: string;
  custom_filename?: string;
}

export interface DownloadResponse {
  task_id: string;
  message: string;
  status: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface DownloadStats {
  total_tasks: number;
  active_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  pending_tasks: number;
  total_downloaded_bytes: number;
  current_speed: number;
}

export interface WebSocketMessage {
  type: 'initial' | 'progress' | 'heartbeat' | 'ping' | 'pong';
  task_id?: string;
  progress?: DownloadProgress;
  tasks?: DownloadTask[];
}

export interface ServerStatus {
  online: boolean;
  data?: {
    status: string;
    message: string;
    version: string;
  };
  error?: string;
}

export interface SupportedSites {
  supported_sites: string[];
  total_sites: number;
}

export interface QualityOptions {
  qualities: VideoQuality[];
  post_processing: PostProcessing[];
}

// Theme types
export type Theme = 'light' | 'dark' | 'system';

// Component props types
export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  className?: string;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

// Hook types
export interface UseDownloadReturn {
  tasks: DownloadTask[];
  stats: DownloadStats | null;
  isConnected: boolean;
  addDownload: (request: DownloadRequest) => Promise<string>;
  startDownload: (taskId: string) => Promise<void>;
  cancelDownload: (taskId: string) => Promise<void>;
  removeTask: (taskId: string) => Promise<void>;
  extractVideoInfo: (url: string, cookies?: string) => Promise<VideoInfo>;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: any) => void;
  disconnect: () => void;
}

// Utility types
export type Nullable<T> = T | null;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Error types
export interface ApiError {
  detail: string;
  error_code?: string;
  timestamp?: string;
}

export class DownloadError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'DownloadError';
  }
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

// Constants
export const VIDEO_QUALITIES: VideoQuality[] = [
  'best',
  '1080p', 
  '720p',
  '480p',
  '360p'
];

export const POST_PROCESSING_OPTIONS: PostProcessing[] = [
  'none',
  'audio',
  'mp4'
];

export const SUPPORTED_VIDEO_EXTENSIONS = [
  'mp4',
  'webm',
  'm4v',
  'mkv',
  'avi',
  'mov',
  'flv',
  'm3u8',
  'ts'
] as const;

export const DOWNLOAD_STATUSES: DownloadStatus[] = [
  'pending',
  'starting', 
  'downloading',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'paused'
];

// Configuration types
export interface AppConfig {
  apiUrl: string;
  wsUrl: string;
  maxConcurrentDownloads: number;
  downloadTimeout: number;
  enableNotifications: boolean;
  theme: Theme;
}

export interface UserPreferences {
  defaultQuality: VideoQuality;
  defaultPostProcessing: PostProcessing;
  downloadPath: string;
  notifications: boolean;
  autoStart: boolean;
  theme: Theme;
}

// Extension types (for browser extension)
export interface ExtensionMessage {
  action: string;
  data?: any;
}

export interface TabInfo {
  id: number;
  url: string;
  title: string;
  favIconUrl?: string;
}

export interface DetectedVideo {
  url: string;
  title: string;
  type: 'video_element' | 'source_element' | 'direct_url' | 'streaming_url' | 'embedded_player';
  element?: HTMLElement;
  poster?: string;
  encrypted?: boolean;
}