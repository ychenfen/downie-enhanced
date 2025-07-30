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
from app.core.video_extractor import VideoExtractor
from app.core.download_manager import DownloadManager
from app.api.download_routes import router as download_router

# Setup basic logging
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global managers
video_extractor = VideoExtractor()
download_manager = DownloadManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("🚀 Starting Downie Enhanced Backend...")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down Downie Enhanced Backend...")


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

# Include API routers
app.include_router(download_router)


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
        "version": "1.0.0"
    }


@app.get("/api/stats")
async def get_stats():
    """Get server statistics"""
    return {
        "active_downloads": len(download_manager.get_active_tasks()),
        "total_downloads": len(download_manager.get_all_tasks()),
        "supported_sites": len(video_extractor.supported_sites)
    }


@app.post("/api/analyze", response_model=URLAnalyzeResponse)
async def analyze_url(request: URLAnalyzeRequest):
    """Analyze video URL and extract metadata"""
    try:
        logger.info(f"Analyzing URL: {str(request.url)}")
        
        async with video_extractor as extractor:
            result = await extractor.extract_video_info(str(request.url))
        
        if not result:
            raise HTTPException(status_code=400, detail="Unable to extract video information")
        
        return URLAnalyzeResponse(
            title=result.title or "Unknown",
            duration=result.duration,
            thumbnail=result.thumbnail,
            formats=result.formats,
            is_playlist=len(result.formats) > 1,
            playlist_count=len(result.formats)
        )
        
    except Exception as e:
        logger.error(f"Failed to analyze URL {str(request.url)}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.get("/api/supported-sites")
async def get_supported_sites():
    """Get list of supported video sites"""
    return {
        "sites": video_extractor.supported_sites,
        "total": len(video_extractor.supported_sites)
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