"""
Video URL Extraction Service
Based on Downie 4's video detection capabilities
"""
import re
import asyncio
import aiohttp
import json
from typing import List, Dict, Optional, Any
from urllib.parse import urljoin, urlparse
from dataclasses import dataclass
from enum import Enum

class VideoQuality(Enum):
    """Video quality options matching Downie 4"""
    AUTO = "auto"
    BEST = "best"
    P1080 = "1080p"
    P720 = "720p"
    P480 = "480p"
    P360 = "360p"
    WORST = "worst"

class PostProcessing(Enum):
    """Post-processing options from Downie 4"""
    NONE = "none"
    AUDIO_ONLY = "audio"
    MP4 = "mp4"
    PERMUTE = "permute"

@dataclass
class VideoInfo:
    """Video information structure"""
    url: str
    title: str = ""
    duration: int = 0
    thumbnail: str = ""
    description: str = ""
    uploader: str = ""
    upload_date: str = ""
    view_count: int = 0
    like_count: int = 0
    formats: List[Dict] = None
    
    def __post_init__(self):
        if self.formats is None:
            self.formats = []

@dataclass
class VideoFormat:
    """Video format information"""
    format_id: str
    url: str
    ext: str
    quality: str
    filesize: Optional[int] = None
    fps: Optional[int] = None
    vcodec: Optional[str] = None
    acodec: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    tbr: Optional[float] = None  # Total bitrate
    vbr: Optional[float] = None  # Video bitrate
    abr: Optional[float] = None  # Audio bitrate

class VideoExtractor:
    """
    Core video extraction service inspired by Downie 4
    Handles multiple video sites and formats
    """
    
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.supported_sites = [
            "youtube.com", "youtu.be",
            "vimeo.com",
            "dailymotion.com",
            "facebook.com",
            "instagram.com",
            "twitter.com", "x.com",
            "tiktok.com",
            "bilibili.com",
            "xiaoeknow.com",  # 小鹅通
            "hjw01.com",      # 海角网站
        ]
        
        # Patterns for video URL detection
        self.video_patterns = {
            'direct': [
                r'\.mp4(\?[^"\s]*)?',
                r'\.webm(\?[^"\s]*)?',
                r'\.m4v(\?[^"\s]*)?',
                r'\.mkv(\?[^"\s]*)?',
                r'\.avi(\?[^"\s]*)?',
                r'\.mov(\?[^"\s]*)?',
                r'\.flv(\?[^"\s]*)?',
            ],
            'streaming': [
                r'\.m3u8(\?[^"\s]*)?',
                r'\.mpd(\?[^"\s]*)?',
                r'\.f4m(\?[^"\s]*)?',
            ],
            'embed': [
                r'youtube\.com/embed/([a-zA-Z0-9_-]+)',
                r'vimeo\.com/video/(\d+)',
                r'player\.vimeo\.com/video/(\d+)',
            ]
        }
    
    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()
    
    def is_supported_site(self, url: str) -> bool:
        """Check if the site is supported"""
        domain = urlparse(url).netloc.lower()
        return any(site in domain for site in self.supported_sites)
    
    async def extract_video_info(self, url: str, cookies: str = "") -> VideoInfo:
        """
        Extract video information from URL
        Main entry point for video extraction
        """
        if not self.session:
            raise RuntimeError("VideoExtractor must be used as async context manager")
        
        # Normalize URL
        url = self._normalize_url(url)
        
        # Try different extraction methods
        try:
            # Method 1: Direct video file detection
            if await self._is_direct_video(url):
                return await self._extract_direct_video(url)
            
            # Method 2: Site-specific extraction
            video_info = await self._extract_from_site(url, cookies)
            if video_info:
                return video_info
            
            # Method 3: Generic page parsing
            return await self._extract_from_page(url, cookies)
            
        except Exception as e:
            raise Exception(f"Failed to extract video info: {str(e)}")
    
    def _normalize_url(self, url: str) -> str:
        """Normalize URL for processing"""
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        return url
    
    async def _is_direct_video(self, url: str) -> bool:
        """Check if URL points directly to a video file"""
        for pattern in self.video_patterns['direct']:
            if re.search(pattern, url, re.IGNORECASE):
                return True
        return False
    
    async def _extract_direct_video(self, url: str) -> VideoInfo:
        """Extract info from direct video URL"""
        try:
            async with self.session.head(url) as response:
                content_type = response.headers.get('content-type', '')
                content_length = response.headers.get('content-length')
                
                # Get filename from URL
                filename = url.split('/')[-1].split('?')[0]
                ext = filename.split('.')[-1] if '.' in filename else 'mp4'
                
                video_format = VideoFormat(
                    format_id="direct",
                    url=url,
                    ext=ext,
                    quality="unknown",
                    filesize=int(content_length) if content_length else None
                )
                
                return VideoInfo(
                    url=url,
                    title=filename,
                    formats=[video_format.__dict__]
                )
        except Exception as e:
            raise Exception(f"Failed to extract direct video: {str(e)}")
    
    async def _extract_from_site(self, url: str, cookies: str = "") -> Optional[VideoInfo]:
        """Extract video from specific sites"""
        domain = urlparse(url).netloc.lower()
        
        # YouTube
        if 'youtube.com' in domain or 'youtu.be' in domain:
            return await self._extract_youtube(url)
        
        # Xiaoeknow (小鹅通)
        elif 'xiaoeknow.com' in domain:
            return await self._extract_xiaoeknow(url, cookies)
        
        # Generic M3U8 detection
        elif any(pattern in url.lower() for pattern in ['.m3u8', 'playlist']):
            return await self._extract_m3u8(url, cookies)
        
        return None
    
    async def _extract_youtube(self, url: str) -> VideoInfo:
        """Extract YouTube video info"""
        # Extract video ID
        video_id_match = re.search(r'(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})', url)
        if not video_id_match:
            raise Exception("Invalid YouTube URL")
        
        video_id = video_id_match.group(1)
        
        # For now, return basic info (would need yt-dlp integration for full extraction)
        return VideoInfo(
            url=url,
            title=f"YouTube Video {video_id}",
            formats=[{
                'format_id': 'youtube_best',
                'url': url,
                'ext': 'mp4',
                'quality': 'best'
            }]
        )
    
    async def _extract_xiaoeknow(self, url: str, cookies: str = "") -> VideoInfo:
        """Extract from Xiaoeknow (小鹅通) platform"""
        headers = {
            'Referer': url,
            'Cookie': cookies
        }
        
        try:
            async with self.session.get(url, headers=headers) as response:
                content = await response.text()
                
                # Look for M3U8 playlist URLs
                m3u8_pattern = r'https?://[^"\s]+\.m3u8[^"\s]*'
                m3u8_urls = re.findall(m3u8_pattern, content)
                
                if m3u8_urls:
                    formats = []
                    for m3u8_url in m3u8_urls[:5]:  # Limit to first 5
                        formats.append({
                            'format_id': f'm3u8_{len(formats)}',
                            'url': m3u8_url,
                            'ext': 'mp4',
                            'quality': 'unknown'
                        })
                    
                    # Try to extract title
                    title_match = re.search(r'<title>([^<]+)</title>', content)
                    title = title_match.group(1) if title_match else "Xiaoeknow Video"
                    
                    return VideoInfo(
                        url=url,
                        title=title,
                        formats=formats
                    )
                
        except Exception as e:
            print(f"Error extracting from Xiaoeknow: {e}")
        
        return None
    
    async def _extract_m3u8(self, url: str, cookies: str = "") -> VideoInfo:
        """Extract M3U8 playlist info"""
        headers = {'Cookie': cookies} if cookies else {}
        
        try:
            async with self.session.get(url, headers=headers) as response:
                content = await response.text()
                
                # Parse M3U8 playlist
                if '#EXTM3U' in content:
                    formats = [{
                        'format_id': 'm3u8',
                        'url': url,
                        'ext': 'mp4',
                        'quality': 'hls'
                    }]
                    
                    # Check if encrypted
                    encrypted = '#EXT-X-KEY' in content
                    
                    return VideoInfo(
                        url=url,
                        title="M3U8 Stream",
                        formats=formats
                    )
                    
        except Exception as e:
            print(f"Error extracting M3U8: {e}")
        
        return None
    
    async def _extract_from_page(self, url: str, cookies: str = "") -> VideoInfo:
        """Generic page parsing for video detection"""
        headers = {
            'Cookie': cookies,
            'Referer': url
        } if cookies else {'Referer': url}
        
        try:
            async with self.session.get(url, headers=headers) as response:
                content = await response.text()
                
                formats = []
                
                # Look for video sources
                for pattern_type, patterns in self.video_patterns.items():
                    for pattern in patterns:
                        matches = re.findall(f'["\']([^"\']*{pattern})', content, re.IGNORECASE)
                        for match in matches[:3]:  # Limit results
                            full_url = urljoin(url, match)
                            formats.append({
                                'format_id': f'{pattern_type}_{len(formats)}',
                                'url': full_url,
                                'ext': self._guess_extension(full_url),
                                'quality': 'unknown'
                            })
                
                if formats:
                    # Try to extract title
                    title_match = re.search(r'<title>([^<]+)</title>', content)
                    title = title_match.group(1) if title_match else "Extracted Video"
                    
                    return VideoInfo(
                        url=url,
                        title=title,
                        formats=formats
                    )
                    
        except Exception as e:
            print(f"Error in generic extraction: {e}")
        
        # Return empty result if nothing found
        return VideoInfo(url=url, title="No video found")
    
    def _guess_extension(self, url: str) -> str:
        """Guess file extension from URL"""
        for ext in ['mp4', 'webm', 'm4v', 'mkv', 'avi', 'mov', 'flv']:
            if f'.{ext}' in url.lower():
                return ext
        return 'mp4'  # Default
    
    def select_best_format(self, formats: List[Dict], quality: VideoQuality = VideoQuality.BEST) -> Dict:
        """Select best format based on quality preference"""
        if not formats:
            return {}
        
        if quality == VideoQuality.AUTO or quality == VideoQuality.BEST:
            # Prefer higher quality and common formats
            def format_score(fmt):
                score = 0
                if fmt.get('height'):
                    score += fmt['height']
                if fmt.get('ext') == 'mp4':
                    score += 100
                if 'audio' not in fmt.get('format_id', '').lower():
                    score += 50
                return score
            
            return max(formats, key=format_score)
        
        # Quality-specific selection
        quality_heights = {
            VideoQuality.P360: 360,
            VideoQuality.P480: 480,
            VideoQuality.P720: 720,
            VideoQuality.P1080: 1080
        }
        
        if quality in quality_heights:
            target_height = quality_heights[quality]
            # Find closest quality
            best_format = min(formats, 
                            key=lambda f: abs((f.get('height') or 0) - target_height))
            return best_format
        
        return formats[0]  # Return first if no preference

# Example usage and testing
async def test_extractor():
    """Test the video extractor"""
    test_urls = [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://v-tos-k.xiaoeknow.com/test.m3u8",
        "https://example.com/video.mp4"
    ]
    
    async with VideoExtractor() as extractor:
        for url in test_urls:
            try:
                info = await extractor.extract_video_info(url)
                print(f"URL: {url}")
                print(f"Title: {info.title}")
                print(f"Formats: {len(info.formats)}")
                print("---")
            except Exception as e:
                print(f"Error with {url}: {e}")
                print("---")

if __name__ == "__main__":
    asyncio.run(test_extractor())