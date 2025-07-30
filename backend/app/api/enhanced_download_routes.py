"""
Enhanced Download API Routes with improved error handling, rate limiting, and security
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, HttpUrl, validator
import asyncio
import json
import time
import hashlib
from datetime import datetime, timedelta
import logging

from ..core.download_manager import DownloadManager, DownloadTask, DownloadProgress, DownloadStatus
from ..core.video_extractor import VideoQuality, PostProcessing

# Initialize router and download manager
router = APIRouter(prefix="/api/downloads", tags=["downloads"])
download_manager = DownloadManager()
download_manager.start_time = time.time()  # Track server start time

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Rate limiting
RATE_LIMIT_REQUESTS = 100  # requests per minute
RATE_LIMIT_WINDOW = 60  # seconds
rate_limit_store: Dict[str, List[float]] = {}

# WebSocket connections for real-time updates
active_connections: List[WebSocket] = []

# Enhanced Pydantic models
class DownloadRequest(BaseModel):
    """Enhanced download request model with validation"""
    url: HttpUrl
    quality: VideoQuality = VideoQuality.BEST
    post_processing: PostProcessing = PostProcessing.NONE
    cookies: str = ""
    custom_filename: Optional[str] = None
    
    @validator('url')
    def validate_url(cls, v):
        """Validate URL format and security"""
        url_str = str(v)
        if not (url_str.startswith('http://') or url_str.startswith('https://')):
            raise ValueError('URL must start with http:// or https://')
        
        # Block dangerous protocols
        dangerous_protocols = ['file://', 'ftp://', 'data:', 'javascript:']
        for protocol in dangerous_protocols:
            if url_str.lower().startswith(protocol):
                raise ValueError(f'Protocol {protocol} is not allowed')
        
        return v
    
    @validator('custom_filename')
    def validate_filename(cls, v):
        """Validate custom filename for security"""
        if v:
            # Remove potentially dangerous characters
            dangerous_chars = ['..', '/', '\\', ':', '*', '?', '"', '<', '>', '|']
            for char in dangerous_chars:
                if char in v:
                    raise ValueError(f'Filename contains invalid character: {char}')
        return v

class DownloadResponse(BaseModel):
    """Enhanced download response model"""
    task_id: str
    message: str
    status: str = "created"
    estimated_size: Optional[int] = None
    estimated_duration: Optional[int] = None

class TaskInfo(BaseModel):
    """Enhanced task information model"""
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
    file_path: Optional[str] = None
    thumbnail: Optional[str] = None

class VideoInfoResponse(BaseModel):
    """Enhanced video information response"""
    url: str
    title: str
    duration: int
    thumbnail: str
    description: str
    uploader: str
    upload_date: Optional[str] = None
    view_count: Optional[int] = None
    like_count: Optional[int] = None
    formats: List[Dict[str, Any]]

class BatchResponse(BaseModel):
    """Batch operation response"""
    results: List[Dict[str, Any]]
    summary: Dict[str, int]
    processing_time: float

# Helper functions
def get_client_ip(request: Request) -> str:
    """Get client IP address for rate limiting"""
    forwarded = request.headers.get('X-Forwarded-For')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.client.host if request.client else 'unknown'

def check_rate_limit(client_ip: str) -> bool:
    """Check if client is within rate limits"""
    now = time.time()
    
    if client_ip not in rate_limit_store:
        rate_limit_store[client_ip] = []
    
    # Clean old requests
    rate_limit_store[client_ip] = [
        req_time for req_time in rate_limit_store[client_ip]
        if now - req_time < RATE_LIMIT_WINDOW
    ]
    
    # Check if under limit
    if len(rate_limit_store[client_ip]) >= RATE_LIMIT_REQUESTS:
        return False
    
    # Add current request
    rate_limit_store[client_ip].append(now)
    return True

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
                "speed_text": progress.speed_text,
                "error_message": progress.error_message
            },
            "timestamp": time.time()
        }
        
        # Send to all connected clients
        disconnected = []
        for connection in active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                logger.warning(f"Failed to send WebSocket message: {e}")
                disconnected.append(connection)
        
        # Remove disconnected clients
        for conn in disconnected:
            if conn in active_connections:
                active_connections.remove(conn)

def task_to_info(task: DownloadTask) -> TaskInfo:
    """Convert DownloadTask to enhanced TaskInfo"""
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
        error_message=task.progress.error_message,
        file_path=getattr(task, 'output_path', None),
        thumbnail=getattr(task, 'thumbnail', None)
    )

# Enhanced API Routes

@router.post("/extract", response_model=VideoInfoResponse)
async def extract_video_info(request: DownloadRequest, http_request: Request):
    """Extract video information with enhanced error handling"""
    # Rate limiting
    client_ip = get_client_ip(http_request)
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")
    
    start_time = time.time()
    
    try:
        logger.info(f"Extracting video info for URL: {request.url}")
        
        from ..core.video_extractor import VideoExtractor
        
        async with VideoExtractor() as extractor:
            video_info = await extractor.extract_video_info(str(request.url), request.cookies)
        
        processing_time = time.time() - start_time
        logger.info(f"Successfully extracted info for: {video_info.title} (took {processing_time:.2f}s)")
        
        return VideoInfoResponse(
            url=video_info.url,
            title=video_info.title,
            duration=video_info.duration,
            thumbnail=video_info.thumbnail,
            description=video_info.description,
            uploader=video_info.uploader,
            upload_date=getattr(video_info, 'upload_date', None),
            view_count=getattr(video_info, 'view_count', None),
            like_count=getattr(video_info, 'like_count', None),
            formats=video_info.formats
        )
    
    except Exception as e:
        processing_time = time.time() - start_time
        logger.error(f"Failed to extract video info for {request.url} (took {processing_time:.2f}s): {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to extract video info: {str(e)}")

@router.post("/add", response_model=DownloadResponse)
async def add_download(request: DownloadRequest, background_tasks: BackgroundTasks, http_request: Request):
    """Add download with duplicate detection and enhanced validation"""
    # Rate limiting
    client_ip = get_client_ip(http_request)
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")
    
    try:
        logger.info(f"Adding download task for URL: {request.url}")
        
        # Check if URL is already being downloaded
        existing_tasks = download_manager.get_all_tasks()
        for task in existing_tasks:
            if task.url == str(request.url) and task.progress.status in [
                DownloadStatus.PENDING, DownloadStatus.DOWNLOADING, DownloadStatus.PROCESSING
            ]:
                raise HTTPException(
                    status_code=409, 
                    detail="This URL is already being downloaded"
                )
        
        # Pre-extract info for better estimates
        estimated_size = None
        estimated_duration = None
        
        try:
            from ..core.video_extractor import VideoExtractor
            async with VideoExtractor() as extractor:
                video_info = await extractor.extract_video_info(str(request.url), request.cookies)
                # Get size from best format
                if video_info.formats:
                    best_format = max(video_info.formats, key=lambda f: f.get('filesize', 0))
                    estimated_size = best_format.get('filesize')
                estimated_duration = video_info.duration
        except Exception as e:
            logger.warning(f"Could not pre-extract info: {e}")
        
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
        
        logger.info(f"Successfully created download task: {task_id}")
        
        return DownloadResponse(
            task_id=task_id,
            message="Download task created successfully",
            estimated_size=estimated_size,
            estimated_duration=estimated_duration
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add download for {request.url}: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to add download: {str(e)}")

@router.post("/batch/add", response_model=BatchResponse)
async def batch_add_downloads(requests: List[DownloadRequest], http_request: Request):
    """Enhanced batch download with duplicate detection and progress tracking"""
    start_time = time.time()
    
    # Enhanced rate limiting for batch operations
    client_ip = get_client_ip(http_request)
    if len(requests) > 50:  # Limit batch size
        raise HTTPException(status_code=400, detail="Batch size too large. Maximum 50 URLs per request.")
    
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")
    
    logger.info(f"Processing batch download with {len(requests)} URLs")
    results = []
    
    # Pre-process to find duplicates
    seen_urls = set()
    
    for i, request in enumerate(requests):
        url_str = str(request.url)
        
        try:
            # Check for duplicates in current batch
            if url_str in seen_urls:
                results.append({"url": url_str, "status": "skipped", "reason": "Duplicate in batch"})
                continue
            seen_urls.add(url_str)
            
            # Check if URL is already being downloaded
            existing_tasks = download_manager.get_all_tasks()
            duplicate_existing = any(
                task.url == url_str and task.progress.status in [
                    DownloadStatus.PENDING, DownloadStatus.DOWNLOADING, DownloadStatus.PROCESSING
                ] for task in existing_tasks
            )
            if duplicate_existing:
                results.append({"url": url_str, "status": "skipped", "reason": "Already downloading"})
                continue
            
            task_id = await download_manager.add_download(
                url=url_str,
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
            
            results.append({"task_id": task_id, "url": url_str, "status": "created"})
            
        except Exception as e:
            logger.error(f"Failed to add batch download for {url_str}: {str(e)}")
            results.append({"url": url_str, "status": "error", "error": str(e)})
    
    processing_time = time.time() - start_time
    successful = len([r for r in results if r["status"] == "created"])
    skipped = len([r for r in results if r["status"] == "skipped"])
    failed = len([r for r in results if r["status"] == "error"])
    
    logger.info(f"Batch download completed in {processing_time:.2f}s: {successful} created, {skipped} skipped, {failed} failed")
    
    return BatchResponse(
        results=results,
        summary={
            "total": len(requests),
            "successful": successful,
            "skipped": skipped,
            "failed": failed
        },
        processing_time=processing_time
    )

@router.get("/stats")
async def get_enhanced_stats():
    """Get comprehensive download statistics"""
    try:
        all_tasks = download_manager.get_all_tasks()
        active_tasks = download_manager.get_active_tasks()
        
        # Calculate detailed statistics
        completed_tasks = [t for t in all_tasks if t.progress.status == DownloadStatus.COMPLETED]
        failed_tasks = [t for t in all_tasks if t.progress.status == DownloadStatus.FAILED]
        
        total_size = sum(t.progress.total_bytes for t in completed_tasks if t.progress.total_bytes > 0)
        total_downloaded = sum(t.progress.downloaded_bytes for t in all_tasks)
        
        # Calculate speeds and success rate
        current_speeds = [t.progress.speed for t in active_tasks if t.progress.speed > 0]
        average_speed = sum(current_speeds) / len(current_speeds) if current_speeds else 0
        
        total_finished = len(completed_tasks) + len(failed_tasks)
        success_rate = (len(completed_tasks) / total_finished * 100) if total_finished > 0 else 0
        
        # System information
        uptime = time.time() - getattr(download_manager, 'start_time', time.time())
        
        stats = {
            "total_tasks": len(all_tasks),
            "active_tasks": len(active_tasks),
            "completed_tasks": len(completed_tasks),
            "failed_tasks": len(failed_tasks),
            "pending_tasks": len([t for t in all_tasks if t.progress.status == DownloadStatus.PENDING]),
            "total_downloaded_bytes": total_downloaded,
            "total_size_bytes": total_size,
            "current_speed": sum(t.progress.speed for t in active_tasks),
            "average_speed": average_speed,
            "success_rate": round(success_rate, 2),
            "connected_clients": len(active_connections),
            "server_uptime": uptime,
            "rate_limit_clients": len(rate_limit_store),
            "last_updated": time.time()
        }
        
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get enhanced stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get statistics: {str(e)}")

# Enhanced WebSocket endpoint
@router.websocket("/ws")
async def enhanced_websocket_endpoint(websocket: WebSocket):
    """Enhanced WebSocket endpoint with better connection management"""
    client_id = hashlib.md5(f"{websocket.client.host}:{time.time()}".encode()).hexdigest()[:8]
    logger.info(f"WebSocket client connected: {client_id}")
    
    await websocket.accept()
    active_connections.append(websocket)
    
    try:
        # Send enhanced initial data
        tasks = download_manager.get_all_tasks()
        stats = await get_enhanced_stats()
        
        initial_data = {
            "type": "initial",
            "tasks": [task_to_info(task).dict() for task in tasks],
            "stats": stats,
            "client_id": client_id,
            "server_time": datetime.now().isoformat(),
            "features": {
                "batch_download": True,
                "real_time_stats": True,
                "progress_notifications": True
            }
        }
        await websocket.send_text(json.dumps(initial_data))
        
        # Enhanced connection management
        last_ping = time.time()
        
        while True:
            try:
                # Wait for client messages or timeout for heartbeat
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                
                try:
                    message = json.loads(data)
                    message_type = message.get("type")
                    
                    if message_type == "ping":
                        await websocket.send_text(json.dumps({
                            "type": "pong",
                            "timestamp": time.time(),
                            "client_id": client_id
                        }))
                        last_ping = time.time()
                    
                    elif message_type == "get_stats":
                        # Send current stats
                        current_stats = await get_enhanced_stats()
                        await websocket.send_text(json.dumps({
                            "type": "stats_update",
                            "stats": current_stats,
                            "timestamp": time.time()
                        }))
                    
                    elif message_type == "subscribe_task":
                        # Client can subscribe to specific task updates
                        task_id = message.get("task_id")
                        if task_id:
                            logger.info(f"Client {client_id} subscribed to task {task_id}")
                            # Could implement task-specific subscriptions here
                        
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON from client {client_id}")
                    
            except asyncio.TimeoutError:
                # Send heartbeat with useful info
                current_time = time.time()
                if current_time - last_ping > 60:  # 1 minute without ping
                    await websocket.send_text(json.dumps({
                        "type": "heartbeat",
                        "timestamp": current_time,
                        "active_tasks": len(download_manager.get_active_tasks()),
                        "total_connections": len(active_connections)
                    }))
                    last_ping = current_time
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected: {client_id}")
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
    finally:
        if websocket in active_connections:
            active_connections.remove(websocket)
        logger.info(f"WebSocket client {client_id} cleanup completed")

# Health check endpoint
@router.get("/health")
async def health_check():
    """Enhanced health check with system status"""
    try:
        stats = await get_enhanced_stats()
        
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "uptime": stats["server_uptime"],
            "active_tasks": stats["active_tasks"],
            "total_tasks": stats["total_tasks"],
            "websocket_connections": stats["connected_clients"],
            "memory_usage": "unknown",  # Could add psutil for memory info
            "version": "1.0.0"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }