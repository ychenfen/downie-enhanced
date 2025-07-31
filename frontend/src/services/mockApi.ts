// Mock API service for GitHub Pages deployment
export const mockAPI = {
  extract: async (data: any) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      url: data.url,
      title: `Video Title from ${new URL(data.url).hostname}`,
      duration: 300,
      thumbnail: "https://via.placeholder.com/320x180?text=Video+Thumbnail",
      description: "This is a demo video extraction. In production, this would connect to a real backend API.",
      uploader: "Demo Channel",
      formats: [
        {
          format_id: "720p",
          url: data.url,
          ext: "mp4",
          quality: "720p",
          filesize: 52428800 // 50MB
        },
        {
          format_id: "480p", 
          url: data.url,
          ext: "mp4",
          quality: "480p",
          filesize: 31457280 // 30MB
        }
      ]
    };
  },

  add: async (data: any) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      id: Math.random().toString(36).substr(2, 9),
      status: "pending",
      url: data.url,
      title: `Download Task for ${new URL(data.url).hostname}`,
      progress: 0,
      message: "Task added to queue"
    };
  },

  getAll: async () => {
    return {
      tasks: [
        {
          id: "demo1",
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          title: "Rick Astley - Never Gonna Give You Up",
          status: "completed",
          progress: 100,
          filesize: 52428800
        },
        {
          id: "demo2", 
          url: "https://vimeo.com/123456789",
          title: "Sample Vimeo Video",
          status: "downloading",
          progress: 45,
          filesize: 31457280
        }
      ]
    };
  },

  getStats: async () => {
    return {
      total_tasks: 25,
      active_tasks: 3,
      completed_tasks: 20,
      failed_tasks: 2,
      total_downloaded: 1073741824 // 1GB
    };
  },

  // Other methods return demo responses
  delete: async (id: string) => ({ success: true, message: "Demo: Task deleted" }),
  pause: async (id: string) => ({ success: true, message: "Demo: Task paused" }),
  resume: async (id: string) => ({ success: true, message: "Demo: Task resumed" }),
  getTasks: async () => mockAPI.getAll(),
  addDownload: async (data: any) => mockAPI.add(data),
  startDownload: async (id: string) => ({ success: true, message: "Demo: Download started" }),
  pauseDownload: async (id: string) => ({ success: true, message: "Demo: Download paused" }),
  resumeDownload: async (id: string) => ({ success: true, message: "Demo: Download resumed" }),
  cancelDownload: async (id: string) => ({ success: true, message: "Demo: Download cancelled" }),
  deleteTask: async (id: string) => ({ success: true, message: "Demo: Task deleted" }),
  extractVideoInfo: async (data: any) => mockAPI.extract(data)
};