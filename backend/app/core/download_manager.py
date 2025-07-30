"""
Download Manager Service
Inspired by Downie 4's download management capabilities
"""
import asyncio
import aiohttp
import aiofiles
import os
import time
import hashlib
from pathlib import Path
from typing import Dict, List, Optional, Callable, Any
from dataclasses import dataclass, field
from enum import Enum
import subprocess
import json
from urllib.parse import urlparse

from .video_extractor import VideoExtractor, VideoInfo, VideoQuality, PostProcessing

class DownloadStatus(Enum):
    """Download status states"""
    PENDING = "pending"
    STARTING = "starting"
    DOWNLOADING = "downloading"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"

@dataclass
class DownloadProgress:
    """Download progress information"""
    downloaded_bytes: int = 0
    total_bytes: int = 0
    speed: float = 0.0  # bytes per second
    eta: int = 0  # estimated time remaining in seconds
    percentage: float = 0.0
    status: DownloadStatus = DownloadStatus.PENDING
    error_message: str = ""
    
    @property
    def progress_text(self) -> str:
        """Human readable progress text"""
        if self.total_bytes > 0:
            return f"{self.percentage:.1f}% ({self._format_bytes(self.downloaded_bytes)}/{self._format_bytes(self.total_bytes)})"
        return f"{self._format_bytes(self.downloaded_bytes)} downloaded"
    
    @property
    def speed_text(self) -> str:
        """Human readable speed text"""
        return f"{self._format_bytes(self.speed)}/s"
    
    def _format_bytes(self, bytes_val: int) -> str:
        """Format bytes to human readable format"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if bytes_val < 1024.0:
                return f"{bytes_val:.1f} {unit}"
            bytes_val /= 1024.0
        return f"{bytes_val:.1f} TB"

@dataclass
class DownloadTask:
    """Download task representation"""
    id: str
    url: str
    title: str
    output_path: str
    video_info: VideoInfo
    quality: VideoQuality = VideoQuality.BEST
    post_processing: PostProcessing = PostProcessing.NONE
    cookies: str = ""
    headers: Dict[str, str] = field(default_factory=dict)
    progress: DownloadProgress = field(default_factory=DownloadProgress)
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    
    @property
    def duration(self) -> float:
        """Get task duration"""
        if self.started_at:
            end_time = self.completed_at or time.time()
            return end_time - self.started_at
        return 0

class DownloadManager:
    """
    Download manager inspired by Downie 4
    Handles video downloads with progress tracking and post-processing
    """
    
    def __init__(self, download_dir: str = "./downloads", max_concurrent: int = 3):
        self.download_dir = Path(download_dir)
        self.download_dir.mkdir(exist_ok=True)
        
        self.max_concurrent = max_concurrent
        self.tasks: Dict[str, DownloadTask] = {}
        self.active_downloads: Dict[str, asyncio.Task] = {}
        self.progress_callbacks: Dict[str, List[Callable]] = {}
        
        # FFmpeg path (similar to Downie 4's embedded FFmpeg)
        self.ffmpeg_path = self._find_ffmpeg()
    
    def _find_ffmpeg(self) -> Optional[str]:
        """Find FFmpeg executable"""
        # Check common locations
        common_paths = [
            "/usr/local/bin/ffmpeg",
            "/usr/bin/ffmpeg",
            "/opt/homebrew/bin/ffmpeg",
            "ffmpeg"  # In PATH
        ]
        
        for path in common_paths:
            try:
                result = subprocess.run([path, "-version"], 
                                      capture_output=True, text=True, timeout=5)
                if result.returncode == 0:
                    return path
            except (subprocess.TimeoutExpired, FileNotFoundError):
                continue
        
        return None
    
    def generate_task_id(self, url: str) -> str:
        """Generate unique task ID"""
        return hashlib.md5(f"{url}{time.time()}".encode()).hexdigest()[:12]
    
    async def add_download(self, 
                          url: str, 
                          quality: VideoQuality = VideoQuality.BEST,
                          post_processing: PostProcessing = PostProcessing.NONE,
                          cookies: str = "",
                          custom_filename: str = "") -> str:
        """Add a new download task"""
        
        # Extract video info
        async with VideoExtractor() as extractor:
            video_info = await extractor.extract_video_info(url, cookies)
        
        if not video_info.formats:
            raise Exception("No video formats found")
        
        # Generate task ID and output path
        task_id = self.generate_task_id(url)
        filename = custom_filename or self._generate_filename(video_info, post_processing)
        output_path = self.download_dir / filename
        
        # Create download task
        task = DownloadTask(
            id=task_id,
            url=url,
            title=video_info.title,
            output_path=str(output_path),
            video_info=video_info,
            quality=quality,
            post_processing=post_processing,
            cookies=cookies
        )
        
        self.tasks[task_id] = task
        return task_id
    
    def _generate_filename(self, video_info: VideoInfo, post_processing: PostProcessing) -> str:
        """Generate output filename"""
        # Clean title for filename
        title = video_info.title or "video"
        title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).strip()
        title = title[:50]  # Limit length
        
        # Determine extension
        if post_processing == PostProcessing.AUDIO_ONLY:
            ext = "mp3"
        elif post_processing == PostProcessing.MP4:
            ext = "mp4"
        else:
            # Use original format extension
            if video_info.formats:
                ext = video_info.formats[0].get('ext', 'mp4')
            else:
                ext = "mp4"
        
        return f"{title}.{ext}"
    
    async def start_download(self, task_id: str) -> bool:
        """Start a download task"""
        if task_id not in self.tasks:
            return False
        
        if len(self.active_downloads) >= self.max_concurrent:
            return False  # Too many active downloads
        
        task = self.tasks[task_id]
        task.progress.status = DownloadStatus.STARTING
        task.started_at = time.time()
        
        # Start download coroutine
        download_coro = self._download_task(task)
        self.active_downloads[task_id] = asyncio.create_task(download_coro)
        
        return True
    
    async def _download_task(self, task: DownloadTask):
        """Execute download task"""
        try:
            # Select best format
            async with VideoExtractor() as extractor:
                selected_format = extractor.select_best_format(
                    task.video_info.formats, task.quality
                )
            
            if not selected_format:
                raise Exception("No suitable format found")
            
            # Download the file
            await self._download_file(task, selected_format)
            
            # Post-processing if needed
            if task.post_processing != PostProcessing.NONE:
                await self._post_process(task)
            
            # Mark as completed
            task.progress.status = DownloadStatus.COMPLETED
            task.completed_at = time.time()
            
        except Exception as e:
            task.progress.status = DownloadStatus.FAILED
            task.progress.error_message = str(e)
        
        finally:
            # Remove from active downloads
            if task.id in self.active_downloads:
                del self.active_downloads[task.id]
    
    async def _download_file(self, task: DownloadTask, format_info: Dict):
        """Download video file"""
        url = format_info['url']
        
        # Handle M3U8 streams
        if url.endswith('.m3u8') or 'm3u8' in url:
            await self._download_m3u8(task, url)
        else:
            await self._download_direct(task, url)
    
    async def _download_direct(self, task: DownloadTask, url: str):
        """Download direct video file"""
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            **task.headers
        }
        
        if task.cookies:
            headers['Cookie'] = task.cookies
        
        task.progress.status = DownloadStatus.DOWNLOADING
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers) as response:
                if response.status != 200:
                    raise Exception(f"HTTP {response.status}: {response.reason}")
                
                total_size = int(response.headers.get('content-length', 0))
                task.progress.total_bytes = total_size
                
                downloaded = 0
                start_time = time.time()
                
                async with aiofiles.open(task.output_path, 'wb') as file:
                    async for chunk in response.content.iter_chunked(8192):
                        await file.write(chunk)
                        downloaded += len(chunk)
                        
                        # Update progress
                        await self._update_progress(task, downloaded, total_size, start_time)
    
    async def _download_m3u8(self, task: DownloadTask, url: str):
        """Download M3U8 stream using FFmpeg"""
        if not self.ffmpeg_path:
            raise Exception("FFmpeg not found - required for M3U8 downloads")
        
        task.progress.status = DownloadStatus.DOWNLOADING
        
        # FFmpeg command for M3U8 download
        cmd = [
            self.ffmpeg_path,
            '-i', url,
            '-c', 'copy',  # Copy without re-encoding
            '-bsf:a', 'aac_adtstoasc',  # Fix AAC streams
            task.output_path
        ]
        
        # Add cookies if available
        if task.cookies:
            cmd.extend(['-headers', f'Cookie: {task.cookies}'])
        
        # Run FFmpeg
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # Monitor progress (simplified - would need to parse FFmpeg output for real progress)
        start_time = time.time()
        while process.returncode is None:
            await asyncio.sleep(1)
            elapsed = time.time() - start_time
            task.progress.percentage = min(elapsed / 60 * 100, 95)  # Rough estimate
            await self._notify_progress(task)
        
        await process.wait()
        
        if process.returncode != 0:
            stderr = await process.stderr.read()
            raise Exception(f"FFmpeg error: {stderr.decode()}")
    
    async def _post_process(self, task: DownloadTask):
        """Post-process downloaded file"""
        if not self.ffmpeg_path:
            return  # Skip if no FFmpeg
        
        task.progress.status = DownloadStatus.PROCESSING
        
        input_path = task.output_path
        temp_path = f"{input_path}.temp"
        
        try:
            if task.post_processing == PostProcessing.AUDIO_ONLY:
                # Extract audio
                cmd = [
                    self.ffmpeg_path,
                    '-i', input_path,
                    '-vn',  # No video
                    '-acodec', 'mp3',
                    '-ab', '192k',
                    temp_path.replace('.temp', '.mp3')
                ]
            elif task.post_processing == PostProcessing.MP4:
                # Convert to MP4
                cmd = [
                    self.ffmpeg_path,
                    '-i', input_path,
                    '-c:v', 'libx264',
                    '-c:a', 'aac',
                    temp_path.replace('.temp', '.mp4')
                ]
            else:
                return  # No processing needed
            
            # Execute FFmpeg
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE
            )
            
            await process.wait()
            
            if process.returncode == 0:
                # Replace original file
                output_path = temp_path.replace('.temp', 
                    '.mp3' if task.post_processing == PostProcessing.AUDIO_ONLY else '.mp4')
                os.rename(output_path, task.output_path)
                # Remove original if different
                if input_path != task.output_path:
                    os.remove(input_path)
            else:
                stderr = await process.stderr.read()
                print(f"Post-processing warning: {stderr.decode()}")
                
        except Exception as e:
            print(f"Post-processing error: {e}")
            # Continue anyway - we have the original file
    
    async def _update_progress(self, task: DownloadTask, downloaded: int, total: int, start_time: float):
        """Update download progress"""
        elapsed = time.time() - start_time
        
        task.progress.downloaded_bytes = downloaded
        task.progress.total_bytes = total
        
        if total > 0:
            task.progress.percentage = (downloaded / total) * 100
        
        if elapsed > 0:
            task.progress.speed = downloaded / elapsed
            
            if task.progress.speed > 0 and total > 0:
                remaining_bytes = total - downloaded
                task.progress.eta = int(remaining_bytes / task.progress.speed)
        
        await self._notify_progress(task)
    
    async def _notify_progress(self, task: DownloadTask):
        """Notify progress callbacks"""
        if task.id in self.progress_callbacks:
            for callback in self.progress_callbacks[task.id]:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(task.progress)
                    else:
                        callback(task.progress)
                except Exception as e:
                    print(f"Progress callback error: {e}")
    
    def add_progress_callback(self, task_id: str, callback: Callable):
        """Add progress callback for a task"""
        if task_id not in self.progress_callbacks:
            self.progress_callbacks[task_id] = []
        self.progress_callbacks[task_id].append(callback)
    
    def remove_progress_callback(self, task_id: str, callback: Callable):
        """Remove progress callback"""
        if task_id in self.progress_callbacks:
            try:
                self.progress_callbacks[task_id].remove(callback)
            except ValueError:
                pass
    
    async def cancel_download(self, task_id: str) -> bool:
        """Cancel a download"""
        if task_id in self.active_downloads:
            self.active_downloads[task_id].cancel()
            del self.active_downloads[task_id]
            
            if task_id in self.tasks:
                self.tasks[task_id].progress.status = DownloadStatus.CANCELLED
            
            return True
        return False
    
    def get_task(self, task_id: str) -> Optional[DownloadTask]:
        """Get download task by ID"""
        return self.tasks.get(task_id)
    
    def get_all_tasks(self) -> List[DownloadTask]:
        """Get all download tasks"""
        return list(self.tasks.values())
    
    def get_active_tasks(self) -> List[DownloadTask]:
        """Get currently active download tasks"""
        return [task for task_id, task in self.tasks.items() 
                if task_id in self.active_downloads]
    
    def cleanup_completed_tasks(self, max_age_hours: int = 24):
        """Clean up old completed tasks"""
        current_time = time.time()
        to_remove = []
        
        for task_id, task in self.tasks.items():
            if (task.progress.status in [DownloadStatus.COMPLETED, DownloadStatus.FAILED] and
                task.completed_at and 
                (current_time - task.completed_at) > (max_age_hours * 3600)):
                to_remove.append(task_id)
        
        for task_id in to_remove:
            del self.tasks[task_id]
            if task_id in self.progress_callbacks:
                del self.progress_callbacks[task_id]

# Example usage
async def test_download_manager():
    """Test the download manager"""
    manager = DownloadManager()
    
    # Add a download
    try:
        task_id = await manager.add_download(
            "https://example.com/video.mp4",
            quality=VideoQuality.P720,
            post_processing=PostProcessing.NONE
        )
        
        # Add progress callback
        def progress_callback(progress: DownloadProgress):
            print(f"Progress: {progress.progress_text}, Speed: {progress.speed_text}")
        
        manager.add_progress_callback(task_id, progress_callback)
        
        # Start download
        await manager.start_download(task_id)
        
        # Wait for completion
        while task_id in manager.active_downloads:
            await asyncio.sleep(1)
        
        task = manager.get_task(task_id)
        print(f"Download completed: {task.progress.status}")
        
    except Exception as e:
        print(f"Download failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_download_manager())