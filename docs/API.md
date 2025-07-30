# 🚀 API 文档

Downie Enhanced 提供完整的 RESTful API 和 WebSocket 接口，支持所有核心功能。

## 📚 目录

- [基础信息](#基础信息)
- [认证](#认证)
- [视频提取 API](#视频提取-api)
- [下载管理 API](#下载管理-api)
- [WebSocket 接口](#websocket-接口)
- [错误处理](#错误处理)
- [示例代码](#示例代码)

## 🔧 基础信息

### Base URL
```
http://localhost:8000/api
```

### 内容类型
```
Content-Type: application/json
```

### 响应格式
所有 API 响应都使用 JSON 格式，包含统一的结构：

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功",
  "timestamp": "2025-01-30T10:00:00Z"
}
```

## 🔐 认证

当前版本暂不需要认证，后续版本将支持 API Key 认证。

## 🎬 视频提取 API

### 提取视频信息

从给定 URL 提取视频信息，不进行下载。

**端点**: `POST /downloads/extract`

**请求体**:
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "quality": "best",
  "post_processing": "none",
  "cookies": ""
}
```

**参数说明**:
- `url` (string, 必需): 视频页面 URL
- `quality` (string, 可选): 视频质量偏好 (`best`, `1080p`, `720p`, `480p`, `360p`)
- `post_processing` (string, 可选): 后处理选项 (`none`, `audio`, `mp4`)
- `cookies` (string, 可选): 网站 Cookie

**响应示例**:
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up",
  "duration": 212,
  "thumbnail": "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  "description": "Official video...",
  "uploader": "Rick Astley",
  "formats": [
    {
      "format_id": "22",
      "url": "https://...",
      "ext": "mp4",
      "quality": "720p",
      "filesize": 25165824,
      "width": 1280,
      "height": 720,
      "fps": 30
    }
  ]
}
```

### 获取支持的网站

**端点**: `GET /downloads/supported-sites`

**响应示例**:
```json
{
  "supported_sites": [
    "youtube.com",
    "youtu.be",
    "vimeo.com",
    "dailymotion.com",
    "tiktok.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "facebook.com",
    "bilibili.com",
    "xiaoeknow.com",
    "hjw01.com"
  ],
  "total_sites": 12
}
```

## 📥 下载管理 API

### 创建下载任务

**端点**: `POST /downloads/add`

**请求体**:
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "quality": "720p",
  "post_processing": "mp4",
  "cookies": "",
  "custom_filename": "my_video.mp4"
}
```

**响应示例**:
```json
{
  "task_id": "abc123def456",
  "message": "Download task created successfully",
  "status": "created"
}
```

### 启动下载

**端点**: `POST /downloads/start/{task_id}`

**响应示例**:
```json
{
  "message": "Download started",
  "task_id": "abc123def456"
}
```

### 获取任务状态

**端点**: `GET /downloads/tasks/{task_id}`

**响应示例**:
```json
{
  "id": "abc123def456",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up",
  "status": "downloading",
  "progress_percentage": 45.7,
  "downloaded_bytes": 11534336,
  "total_bytes": 25165824,
  "speed": 1048576,
  "eta": 13,
  "created_at": 1706616000.0,
  "started_at": 1706616005.0,
  "completed_at": null,
  "error_message": ""
}
```

### 获取所有任务

**端点**: `GET /downloads/tasks`

**查询参数**:
- `limit` (int, 可选): 返回任务数量限制，默认 50
- `offset` (int, 可选): 偏移量，默认 0
- `status` (string, 可选): 过滤状态 (`pending`, `downloading`, `completed`, `failed`)

**响应示例**:
```json
[
  {
    "id": "abc123def456",
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up",
    "status": "completed",
    "progress_percentage": 100.0,
    "downloaded_bytes": 25165824,
    "total_bytes": 25165824,
    "speed": 0,
    "eta": 0,
    "created_at": 1706616000.0,
    "started_at": 1706616005.0,
    "completed_at": 1706616089.0
  }
]
```

### 获取活跃任务

**端点**: `GET /downloads/tasks/active`

返回当前正在下载的任务列表。

### 取消下载

**端点**: `POST /downloads/cancel/{task_id}`

**响应示例**:
```json
{
  "message": "Download cancelled",
  "task_id": "abc123def456"
}
```

### 删除任务

**端点**: `DELETE /downloads/tasks/{task_id}`

**响应示例**:
```json
{
  "message": "Task deleted",
  "task_id": "abc123def456"
}
```

### 批量操作

#### 批量添加下载

**端点**: `POST /downloads/batch/add`

**请求体**:
```json
[
  {
    "url": "https://www.youtube.com/watch?v=video1",
    "quality": "720p",
    "post_processing": "none"
  },
  {
    "url": "https://www.youtube.com/watch?v=video2",
    "quality": "1080p", 
    "post_processing": "audio"
  }
]
```

**响应示例**:
```json
{
  "results": [
    {
      "task_id": "task1",
      "url": "https://www.youtube.com/watch?v=video1",
      "status": "created"
    },
    {
      "task_id": "task2", 
      "url": "https://www.youtube.com/watch?v=video2",
      "status": "created"
    }
  ]
}
```

#### 批量启动下载

**端点**: `POST /downloads/batch/start`

**请求体**:
```json
["task1", "task2", "task3"]
```

### 获取下载统计

**端点**: `GET /downloads/stats`

**响应示例**:
```json
{
  "total_tasks": 150,
  "active_tasks": 3,
  "completed_tasks": 142,
  "failed_tasks": 5,
  "pending_tasks": 0,
  "total_downloaded_bytes": 10737418240,
  "current_speed": 3145728
}
```

### 清理旧任务

**端点**: `POST /downloads/cleanup`

**查询参数**:
- `max_age_hours` (int, 可选): 保留时间（小时），默认 24

**响应示例**:
```json
{
  "message": "Cleaned up tasks older than 24 hours"
}
```

## 🌐 WebSocket 接口

### 实时进度更新

**端点**: `WebSocket /downloads/ws`

连接后会接收以下类型的消息：

#### 初始数据
```json
{
  "type": "initial",
  "tasks": [
    // 所有任务的当前状态
  ]
}
```

#### 进度更新  
```json
{
  "type": "progress",
  "task_id": "abc123def456",
  "progress": {
    "status": "downloading",
    "percentage": 45.7,
    "downloaded_bytes": 11534336,
    "total_bytes": 25165824,
    "speed": 1048576,
    "eta": 13,
    "progress_text": "45.7% (11.0 MB/24.0 MB)",
    "speed_text": "1.0 MB/s"
  }
}
```

#### 心跳消息
```json
{
  "type": "heartbeat"
}
```

#### 客户端消息
客户端可以发送 ping 消息保持连接：
```json
{
  "type": "ping"
}
```

服务器会响应：
```json
{
  "type": "pong"
}
```

## 🔧 系统 API

### 健康检查

**端点**: `GET /health`

**响应示例**:
```json
{
  "status": "healthy",
  "message": "Downie Enhanced Backend is running",
  "version": "1.0.0"
}
```

### 服务器统计

**端点**: `GET /stats`

**响应示例**:
```json
{
  "active_downloads": 3,
  "total_downloads": 150,
  "supported_sites": 12
}
```

### 获取质量选项

**端点**: `GET /downloads/qualities`

**响应示例**:
```json
{
  "qualities": ["auto", "best", "1080p", "720p", "480p", "360p", "worst"],
  "post_processing": ["none", "audio", "mp4", "permute"]
}
```

## ❌ 错误处理

### 错误响应格式

```json
{
  "detail": "错误描述",
  "error_code": "INVALID_URL",
  "timestamp": "2025-01-30T10:00:00Z"
}
```

### 常见错误码

| HTTP 状态码 | 错误码 | 描述 |
|------------|--------|------|
| 400 | `INVALID_URL` | 无效的视频 URL |
| 400 | `UNSUPPORTED_SITE` | 不支持的网站 |
| 404 | `TASK_NOT_FOUND` | 任务不存在 |
| 409 | `TASK_ALREADY_RUNNING` | 任务已在运行 |
| 422 | `VALIDATION_ERROR` | 请求参数验证失败 |
| 500 | `EXTRACTION_FAILED` | 视频信息提取失败 |
| 500 | `DOWNLOAD_FAILED` | 下载失败 |
| 500 | `PROCESSING_FAILED` | 视频处理失败 |

## 💡 示例代码

### JavaScript/TypeScript

```javascript
// 创建下载任务
async function createDownload(url, quality = 'best') {
  const response = await fetch('/api/downloads/add', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      quality,
      post_processing: 'none',
      cookies: ''
    })
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(result.detail);
  }
  
  return result.task_id;
}

// 启动下载
async function startDownload(taskId) {
  const response = await fetch(`/api/downloads/start/${taskId}`, {
    method: 'POST'
  });
  
  if (!response.ok) {
    throw new Error('Failed to start download');
  }
}

// WebSocket 监听进度
function connectWebSocket() {
  const ws = new WebSocket('ws://localhost:8000/api/downloads/ws');
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    switch (data.type) {
      case 'initial':
        console.log('Initial tasks:', data.tasks);
        break;
      case 'progress':
        console.log(`Task ${data.task_id}: ${data.progress.percentage}%`);
        break;
      case 'heartbeat':
        // 心跳消息
        break;
    }
  };
  
  // 发送心跳
  setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 30000);
  
  return ws;
}
```

### Python

```python
import asyncio
import aiohttp
import json

class DownieClient:
    def __init__(self, base_url='http://localhost:8000/api'):
        self.base_url = base_url
        
    async def extract_video_info(self, url, cookies=''):
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f'{self.base_url}/downloads/extract',
                json={
                    'url': url,
                    'quality': 'best',
                    'post_processing': 'none',
                    'cookies': cookies
                }
            ) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    error = await response.json()
                    raise Exception(error['detail'])
    
    async def create_download(self, url, quality='best', post_processing='none'):
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f'{self.base_url}/downloads/add',
                json={
                    'url': url,
                    'quality': quality,
                    'post_processing': post_processing,
                    'cookies': ''
                }
            ) as response:
                result = await response.json()
                return result['task_id']
    
    async def start_download(self, task_id):
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f'{self.base_url}/downloads/start/{task_id}'
            ) as response:
                return response.status == 200

# 使用示例
async def main():
    client = DownieClient()
    
    # 提取视频信息
    video_info = await client.extract_video_info(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    )
    print(f"视频标题: {video_info['title']}")
    
    # 创建并启动下载
    task_id = await client.create_download(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        quality='720p'
    )
    
    await client.start_download(task_id)
    print(f"下载已启动: {task_id}")

# 运行
asyncio.run(main())
```

### cURL 示例

```bash
# 提取视频信息
curl -X POST "http://localhost:8000/api/downloads/extract" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "quality": "best",
    "post_processing": "none",
    "cookies": ""
  }'

# 创建下载任务
curl -X POST "http://localhost:8000/api/downloads/add" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "quality": "720p",
    "post_processing": "mp4"
  }'

# 启动下载
curl -X POST "http://localhost:8000/api/downloads/start/abc123def456"

# 获取任务状态
curl "http://localhost:8000/api/downloads/tasks/abc123def456"

# 获取所有任务
curl "http://localhost:8000/api/downloads/tasks?limit=10&status=completed"
```

## 🔗 相关链接

- **OpenAPI 规范**: http://localhost:8000/api/docs
- **ReDoc 文档**: http://localhost:8000/api/redoc
- **项目仓库**: https://github.com/ychenfen/downie-enhanced
- **问题反馈**: https://github.com/ychenfen/downie-enhanced/issues

---

如有疑问或建议，欢迎在 [GitHub Issues](https://github.com/ychenfen/downie-enhanced/issues) 中提出！