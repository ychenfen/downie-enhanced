"""
Downie Enhanced Backend Server
基于FastAPI的现代化视频下载服务
"""

import asyncio
from contextlib import asynccontextmanager
from typing import List

import structlog
import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, HttpUrl

# Internal imports
from core.video_extractor import VideoExtractor
from core.download_manager import DownloadManager
from core.websocket_manager import WebSocketManager
from models.download import DownloadRequest, DownloadResponse, DownloadStatus
from database.connection import database
from utils.logger import setup_logger

# Setup structured logging
logger = setup_logger()

# Global managers
video_extractor = VideoExtractor()
download_manager = DownloadManager()
websocket_manager = WebSocketManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("🚀 Starting Downie Enhanced Backend...")
    await database.connect()
    await download_manager.initialize()
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down Downie Enhanced Backend...")
    await database.disconnect()
    await download_manager.cleanup()


# Create FastAPI app
app = FastAPI(
    title="Downie Enhanced API",
    description="Modern Web Video Downloader Backend",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")


# Pydantic models
class URLAnalyzeRequest(BaseModel):
    url: HttpUrl
    extract_playlist: bool = False
    quality_preference: str = "best"


class URLAnalyzeResponse(BaseModel):
    title: str
    duration: int
    thumbnail: str
    formats: List[dict]
    is_playlist: bool
    playlist_count: int = 0


# API Routes
@app.get("/", response_class=HTMLResponse)
async def root():
    """Root endpoint - API info"""
    return """
    <html>
        <head><title>Downie Enhanced API</title></head>
        <body>
            <h1>🚀 Downie Enhanced Backend</h1>
            <p>Modern Web Video Downloader API</p>
            <ul>
                <li><a href="/api/docs">📖 API Documentation</a></li>
                <li><a href="/api/health">💚 Health Check</a></li>
                <li><a href="/api/stats">📊 Server Stats</a></li>
            </ul>
        </body>
    </html>
    """


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "message": "Downie Enhanced Backend is running",
        "version": "1.0.0",
        "database": "connected" if database.is_connected else "disconnected"
    }


@app.get("/api/stats")
async def get_stats():
    """Get server statistics"""
    return {
        "active_downloads": download_manager.get_active_count(),
        "completed_downloads": await download_manager.get_completed_count(),
        "supported_sites": len(video_extractor.get_supported_sites()),
        "websocket_connections": websocket_manager.get_connection_count()
    }


@app.post("/api/analyze", response_model=URLAnalyzeResponse)
async def analyze_url(request: URLAnalyzeRequest):
    """Analyze video URL and extract metadata"""
    try:
        logger.info("Analyzing URL", url=str(request.url))
        
        result = await video_extractor.extract_info(
            url=str(request.url),
            extract_playlist=request.extract_playlist
        )
        
        if not result:
            raise HTTPException(status_code=400, detail="Unable to extract video information")
        
        return URLAnalyzeResponse(
            title=result.get("title", "Unknown"),
            duration=result.get("duration", 0),
            thumbnail=result.get("thumbnail", ""),
            formats=result.get("formats", []),
            is_playlist=result.get("_type") == "playlist",
            playlist_count=len(result.get("entries", [])) if result.get("_type") == "playlist" else 0
        )
        
    except Exception as e:
        logger.error("Failed to analyze URL", url=str(request.url), error=str(e))
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/api/download", response_model=DownloadResponse)
async def create_download(request: DownloadRequest, background_tasks: BackgroundTasks):
    """Create a new download task"""
    try:
        logger.info("Creating download task", url=request.url)
        
        # Create download task
        task_id = await download_manager.create_task(
            url=request.url,
            quality=request.quality,
            format=request.format,
            output_path=request.output_path
        )
        
        # Start download in background
        background_tasks.add_task(
            download_manager.start_download,
            task_id=task_id,
            websocket_manager=websocket_manager
        )
        
        return DownloadResponse(
            task_id=task_id,
            status=DownloadStatus.QUEUED,
            message="Download task created successfully"
        )
        
    except Exception as e:
        logger.error("Failed to create download", url=request.url, error=str(e))
        raise HTTPException(status_code=500, detail=f"Download creation failed: {str(e)}")


@app.get("/api/download/{task_id}/status")
async def get_download_status(task_id: str):
    """Get download task status"""
    try:
        status = await download_manager.get_task_status(task_id)
        if not status:
            raise HTTPException(status_code=404, detail="Download task not found")
        
        return status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get download status", task_id=task_id, error=str(e))
        raise HTTPException(status_code=500, detail=f"Status retrieval failed: {str(e)}")


@app.delete("/api/download/{task_id}")
async def cancel_download(task_id: str):
    """Cancel a download task"""
    try:
        success = await download_manager.cancel_task(task_id)
        if not success:
            raise HTTPException(status_code=404, detail="Download task not found")
        
        return {"message": "Download cancelled successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to cancel download", task_id=task_id, error=str(e))
        raise HTTPException(status_code=500, detail=f"Cancellation failed: {str(e)}")


@app.get("/api/downloads")
async def list_downloads(limit: int = 50, offset: int = 0):
    """List all downloads with pagination"""
    try:
        downloads = await download_manager.list_downloads(limit=limit, offset=offset)
        return {
            "downloads": downloads,
            "total": await download_manager.get_total_count(),
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        logger.error("Failed to list downloads", error=str(e))
        raise HTTPException(status_code=500, detail=f"List retrieval failed: {str(e)}")


@app.websocket("/ws/download/{task_id}")
async def websocket_download_progress(websocket: WebSocket, task_id: str):
    """WebSocket endpoint for real-time download progress"""
    await websocket_manager.connect(websocket, task_id)
    
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
            
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket, task_id)


@app.get("/api/supported-sites")
async def get_supported_sites():
    """Get list of supported video sites"""
    return {
        "sites": video_extractor.get_supported_sites(),
        "total": len(video_extractor.get_supported_sites())
    }


# Error handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return {"error": "Endpoint not found", "detail": str(exc)}


@app.exception_handler(500)
async def internal_error_handler(request, exc):
    logger.error("Internal server error", error=str(exc))
    return {"error": "Internal server error", "detail": "Please try again later"}


if __name__ == "__main__":
    # Development server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )