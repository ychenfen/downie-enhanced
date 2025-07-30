"""
Download API Routes
REST API endpoints for download management inspired by Downie 4
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, HttpUrl
import asyncio
import json

from ..core.download_manager import DownloadManager, DownloadTask, DownloadProgress, DownloadStatus
from ..core.video_extractor import VideoQuality, PostProcessing

# Initialize router and download manager
router = APIRouter(prefix="/api/downloads", tags=["downloads"])
download_manager = DownloadManager()

# WebSocket connections for real-time updates
active_connections: List[WebSocket] = []

# Pydantic models for API
class DownloadRequest(BaseModel):
    """Download request model"""
    url: HttpUrl
    quality: VideoQuality = VideoQuality.BEST
    post_processing: PostProcessing = PostProcessing.NONE
    cookies: str = ""
    custom_filename: Optional[str] = None

class DownloadResponse(BaseModel):
    """Download response model"""
    task_id: str
    message: str
    status: str = "created"

class TaskInfo(BaseModel):
    """Task information model"""
    id: str
    url: str
    title: str
    status: str
    progress_percentage: float
    downloaded_bytes: int
    total_bytes: int
    speed: float
    eta: int
    created_at: float
    started_at: Optional[float]
    completed_at: Optional[float]
    error_message: str = ""

class VideoInfoResponse(BaseModel):
    """Video information response"""
    url: str
    title: str
    duration: int
    thumbnail: str
    description: str
    uploader: str
    formats: List[Dict[str, Any]]

# Helper functions
async def broadcast_progress(task_id: str, progress: DownloadProgress):
    """Broadcast progress to all connected WebSocket clients"""
    if active_connections:
        message = {
            "type": "progress",
            "task_id": task_id,
            "progress": {
                "status": progress.status.value,
                "percentage": progress.percentage,
                "downloaded_bytes": progress.downloaded_bytes,
                "total_bytes": progress.total_bytes,
                "speed": progress.speed,
                "eta": progress.eta,
                "progress_text": progress.progress_text,
                "speed_text": progress.speed_text
            }
        }
        
        # Send to all connected clients
        disconnected = []
        for connection in active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except:
                disconnected.append(connection)
        
        # Remove disconnected clients
        for conn in disconnected:
            active_connections.remove(conn)

def task_to_info(task: DownloadTask) -> TaskInfo:
    """Convert DownloadTask to TaskInfo"""
    return TaskInfo(
        id=task.id,
        url=task.url,
        title=task.title,
        status=task.progress.status.value,
        progress_percentage=task.progress.percentage,
        downloaded_bytes=task.progress.downloaded_bytes,
        total_bytes=task.progress.total_bytes,
        speed=task.progress.speed,
        eta=task.progress.eta,
        created_at=task.created_at,
        started_at=task.started_at,
        completed_at=task.completed_at,
        error_message=task.progress.error_message
    )

# API Routes

@router.post("/extract", response_model=VideoInfoResponse)
async def extract_video_info(request: DownloadRequest):
    """Extract video information without downloading"""
    try:
        from ..core.video_extractor import VideoExtractor
        
        async with VideoExtractor() as extractor:
            video_info = await extractor.extract_video_info(str(request.url), request.cookies)
        
        return VideoInfoResponse(
            url=video_info.url,
            title=video_info.title,
            duration=video_info.duration,
            thumbnail=video_info.thumbnail,
            description=video_info.description,
            uploader=video_info.uploader,
            formats=video_info.formats
        )
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract video info: {str(e)}")

@router.post("/add", response_model=DownloadResponse)
async def add_download(request: DownloadRequest, background_tasks: BackgroundTasks):
    """Add a new download task"""
    try:
        # Add download task
        task_id = await download_manager.add_download(
            url=str(request.url),
            quality=request.quality,
            post_processing=request.post_processing,
            cookies=request.cookies,
            custom_filename=request.custom_filename or ""
        )
        
        # Add progress callback for WebSocket broadcasting
        download_manager.add_progress_callback(
            task_id, 
            lambda progress: asyncio.create_task(broadcast_progress(task_id, progress))
        )
        
        return DownloadResponse(
            task_id=task_id,
            message="Download task created successfully"
        )
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to add download: {str(e)}")

@router.post("/start/{task_id}")
async def start_download(task_id: str):
    """Start a download task"""
    success = await download_manager.start_download(task_id)
    
    if not success:
        task = download_manager.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        else:
            raise HTTPException(status_code=400, detail="Unable to start download (may be at max concurrent limit)")
    
    return {"message": "Download started", "task_id": task_id}

@router.post("/cancel/{task_id}")
async def cancel_download(task_id: str):
    """Cancel a download task"""
    success = await download_manager.cancel_download(task_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Task not found or not active")
    
    return {"message": "Download cancelled", "task_id": task_id}

@router.get("/tasks", response_model=List[TaskInfo])
async def get_all_tasks():
    """Get all download tasks"""
    tasks = download_manager.get_all_tasks()
    return [task_to_info(task) for task in tasks]

@router.get("/tasks/active", response_model=List[TaskInfo])
async def get_active_tasks():
    """Get currently active download tasks"""
    tasks = download_manager.get_active_tasks()
    return [task_to_info(task) for task in tasks]

@router.get("/tasks/{task_id}", response_model=TaskInfo)
async def get_task(task_id: str):
    """Get specific task information"""
    task = download_manager.get_task(task_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task_to_info(task)

@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    """Delete a completed task"""
    task = download_manager.get_task(task_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.progress.status in [DownloadStatus.DOWNLOADING, DownloadStatus.PROCESSING]:
        raise HTTPException(status_code=400, detail="Cannot delete active task")
    
    # Remove task
    if task_id in download_manager.tasks:
        del download_manager.tasks[task_id]
    
    if task_id in download_manager.progress_callbacks:
        del download_manager.progress_callbacks[task_id]
    
    return {"message": "Task deleted", "task_id": task_id}

@router.post("/cleanup")
async def cleanup_tasks(max_age_hours: int = 24):
    """Clean up old completed tasks"""
    download_manager.cleanup_completed_tasks(max_age_hours)
    return {"message": f"Cleaned up tasks older than {max_age_hours} hours"}

@router.get("/stats")
async def get_download_stats():
    """Get download statistics"""
    all_tasks = download_manager.get_all_tasks()
    active_tasks = download_manager.get_active_tasks()
    
    stats = {
        "total_tasks": len(all_tasks),
        "active_tasks": len(active_tasks),
        "completed_tasks": len([t for t in all_tasks if t.progress.status == DownloadStatus.COMPLETED]),
        "failed_tasks": len([t for t in all_tasks if t.progress.status == DownloadStatus.FAILED]),
        "pending_tasks": len([t for t in all_tasks if t.progress.status == DownloadStatus.PENDING]),
        "total_downloaded_bytes": sum(t.progress.downloaded_bytes for t in all_tasks),
        "current_speed": sum(t.progress.speed for t in active_tasks)
    }
    
    return stats

# WebSocket endpoint for real-time updates
@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time download progress"""
    await websocket.accept()
    active_connections.append(websocket)
    
    try:
        # Send initial task list
        tasks = download_manager.get_all_tasks()
        initial_data = {
            "type": "initial",
            "tasks": [task_to_info(task).dict() for task in tasks]
        }
        await websocket.send_text(json.dumps(initial_data))
        
        # Keep connection alive
        while True:
            try:
                # Wait for ping/pong or client messages
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                
                # Handle client messages if needed
                try:
                    message = json.loads(data)
                    if message.get("type") == "ping":
                        await websocket.send_text(json.dumps({"type": "pong"}))
                except json.JSONDecodeError:
                    pass
                
            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_text(json.dumps({"type": "heartbeat"}))
                
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        if websocket in active_connections:
            active_connections.remove(websocket)

# Batch operations
@router.post("/batch/add")
async def batch_add_downloads(requests: List[DownloadRequest]):
    """Add multiple downloads"""
    results = []
    
    for request in requests:
        try:
            task_id = await download_manager.add_download(
                url=str(request.url),
                quality=request.quality,
                post_processing=request.post_processing,
                cookies=request.cookies,
                custom_filename=request.custom_filename or ""
            )
            
            # Add progress callback
            download_manager.add_progress_callback(
                task_id, 
                lambda progress, tid=task_id: asyncio.create_task(broadcast_progress(tid, progress))
            )
            
            results.append({"task_id": task_id, "url": str(request.url), "status": "created"})
            
        except Exception as e:
            results.append({"url": str(request.url), "status": "error", "error": str(e)})
    
    return {"results": results}

@router.post("/batch/start")
async def batch_start_downloads(task_ids: List[str]):
    """Start multiple downloads"""
    results = []
    
    for task_id in task_ids:
        try:
            success = await download_manager.start_download(task_id)
            results.append({
                "task_id": task_id, 
                "status": "started" if success else "failed"
            })
        except Exception as e:
            results.append({"task_id": task_id, "status": "error", "error": str(e)})
    
    return {"results": results}

# Quality and format utilities
@router.get("/qualities")
async def get_available_qualities():
    """Get available video qualities"""
    return {
        "qualities": [q.value for q in VideoQuality],
        "post_processing": [p.value for p in PostProcessing]
    }

@router.get("/supported-sites")
async def get_supported_sites():
    """Get list of supported sites"""
    from ..core.video_extractor import VideoExtractor
    
    extractor = VideoExtractor()
    return {
        "supported_sites": extractor.supported_sites,
        "total_sites": len(extractor.supported_sites)
    }