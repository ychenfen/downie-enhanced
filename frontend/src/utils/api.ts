const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export const downloadAPI = {
  extract: async (data: any) => {
    const response = await fetch(`${API_BASE}/downloads/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },

  add: async (data: any) => {
    const response = await fetch(`${API_BASE}/downloads/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },

  getAll: async () => {
    const response = await fetch(`${API_BASE}/downloads`);
    return response.json();
  },

  delete: async (id: string) => {
    const response = await fetch(`${API_BASE}/downloads/${id}`, {
      method: 'DELETE'
    });
    return response.json();
  },

  getStats: async () => {
    const response = await fetch(`${API_BASE}/downloads/stats`);
    return response.json();
  },

  pause: async (id: string) => {
    const response = await fetch(`${API_BASE}/downloads/${id}/pause`, {
      method: 'POST'
    });
    return response.json();
  },

  resume: async (id: string) => {
    const response = await fetch(`${API_BASE}/downloads/${id}/resume`, {
      method: 'POST'
    });
    return response.json();
  },

  getTasks: async () => {
    const response = await fetch(`${API_BASE}/downloads`);
    return response.json();
  },

  addDownload: async (data: any) => {
    const response = await fetch(`${API_BASE}/downloads/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },

  startDownload: async (id: string) => {
    const response = await fetch(`${API_BASE}/downloads/${id}/start`, {
      method: 'POST'
    });
    return response.json();
  },

  pauseDownload: async (id: string) => {
    const response = await fetch(`${API_BASE}/downloads/${id}/pause`, {
      method: 'POST'
    });
    return response.json();
  },

  resumeDownload: async (id: string) => {
    const response = await fetch(`${API_BASE}/downloads/${id}/resume`, {
      method: 'POST'
    });
    return response.json();
  },

  cancelDownload: async (id: string) => {
    const response = await fetch(`${API_BASE}/downloads/${id}/cancel`, {
      method: 'POST'
    });
    return response.json();
  },

  deleteTask: async (id: string) => {
    const response = await fetch(`${API_BASE}/downloads/${id}`, {
      method: 'DELETE'
    });
    return response.json();
  },

  extractVideoInfo: async (data: any) => {
    const response = await fetch(`${API_BASE}/downloads/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }
};