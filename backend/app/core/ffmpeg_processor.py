"""
FFmpeg Video Processing Service
Enhanced video processing capabilities inspired by Downie 4's FFmpeg integration
"""
import asyncio
import subprocess
import os
import json
import tempfile
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass
from enum import Enum
import re

class VideoCodec(Enum):
    """Video codec options"""
    H264 = "libx264"
    H265 = "libx265"
    VP9 = "libvpx-vp9"
    AV1 = "libaom-av1"
    COPY = "copy"

class AudioCodec(Enum):
    """Audio codec options"""
    AAC = "aac"
    MP3 = "libmp3lame"
    OPUS = "libopus"
    FLAC = "flac"
    COPY = "copy"

class VideoFormat(Enum):
    """Output video formats"""
    MP4 = "mp4"
    MKV = "mkv"
    WEBM = "webm"
    AVI = "avi"
    MOV = "mov"
    M4V = "m4v"

class AudioFormat(Enum):
    """Output audio formats"""
    MP3 = "mp3"
    AAC = "aac"
    FLAC = "flac"
    OGG = "ogg"
    WAV = "wav"
    M4A = "m4a"

class VideoQuality(Enum):
    """Video quality presets"""
    ULTRA = "ultra"      # 4K, high bitrate
    HIGH = "high"        # 1080p, good bitrate
    MEDIUM = "medium"    # 720p, medium bitrate
    LOW = "low"          # 480p, low bitrate
    MOBILE = "mobile"    # 360p, very low bitrate

@dataclass
class ProcessingOptions:
    """Video processing options"""
    # Basic options
    output_format: VideoFormat = VideoFormat.MP4
    video_codec: VideoCodec = VideoCodec.H264
    audio_codec: AudioCodec = AudioCodec.AAC
    quality: VideoQuality = VideoQuality.HIGH
    
    # Resolution and scaling
    width: Optional[int] = None
    height: Optional[int] = None
    scale_filter: Optional[str] = None
    
    # Bitrate settings
    video_bitrate: Optional[str] = None
    audio_bitrate: Optional[str] = None
    
    # Frame rate
    fps: Optional[int] = None
    
    # Audio processing
    audio_only: bool = False
    normalize_audio: bool = False
    audio_volume: Optional[float] = None
    
    # Video filters
    denoise: bool = False
    deinterlace: bool = False
    crop: Optional[str] = None  # Format: "w:h:x:y"
    rotate: Optional[int] = None  # Degrees: 90, 180, 270
    
    # Subtitle options
    embed_subtitles: bool = False
    subtitle_language: Optional[str] = None
    
    # Advanced options
    hardware_acceleration: bool = False
    two_pass_encoding: bool = False
    custom_filters: List[str] = None
    
    def __post_init__(self):
        if self.custom_filters is None:
            self.custom_filters = []

@dataclass
class MediaInfo:
    """Media file information"""
    filename: str
    duration: float
    bitrate: int
    size: int
    
    # Video info
    video_codec: Optional[str] = None
    video_bitrate: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    fps: Optional[float] = None
    aspect_ratio: Optional[str] = None
    
    # Audio info
    audio_codec: Optional[str] = None
    audio_bitrate: Optional[int] = None
    sample_rate: Optional[int] = None
    channels: Optional[int] = None
    
    # Additional info
    format_name: Optional[str] = None
    streams: List[Dict] = None
    
    def __post_init__(self):
        if self.streams is None:
            self.streams = []

class FFmpegProcessor:
    """
    Enhanced FFmpeg video processor inspired by Downie 4
    Provides comprehensive video processing capabilities
    """
    
    def __init__(self, ffmpeg_path: Optional[str] = None, ffprobe_path: Optional[str] = None):
        self.ffmpeg_path = ffmpeg_path or self._find_ffmpeg()
        self.ffprobe_path = ffprobe_path or self._find_ffprobe()
        
        if not self.ffmpeg_path:
            raise RuntimeError("FFmpeg not found. Please install FFmpeg.")
        
        if not self.ffprobe_path:
            raise RuntimeError("FFprobe not found. Please install FFmpeg.")
        
        # Quality presets
        self.quality_presets = {
            VideoQuality.ULTRA: {
                'video_bitrate': '8000k',
                'audio_bitrate': '320k',
                'crf': '18'
            },
            VideoQuality.HIGH: {
                'video_bitrate': '4000k',
                'audio_bitrate': '192k',
                'crf': '20'
            },
            VideoQuality.MEDIUM: {
                'video_bitrate': '2000k',
                'audio_bitrate': '128k',
                'crf': '23'
            },
            VideoQuality.LOW: {
                'video_bitrate': '1000k',
                'audio_bitrate': '96k',
                'crf': '26'
            },
            VideoQuality.MOBILE: {
                'video_bitrate': '500k',
                'audio_bitrate': '64k',
                'crf': '28'
            }
        }
    
    def _find_ffmpeg(self) -> Optional[str]:
        """Find FFmpeg executable"""
        common_paths = [
            "/usr/local/bin/ffmpeg",
            "/usr/bin/ffmpeg",
            "/opt/homebrew/bin/ffmpeg",
            "ffmpeg",
            # Downie 4's embedded FFmpeg path
            "/Applications/Downie 4.app/Contents/Resources/ffmpeg"
        ]
        
        for path in common_paths:
            if self._is_executable(path):
                return path
        return None
    
    def _find_ffprobe(self) -> Optional[str]:
        """Find FFprobe executable"""
        common_paths = [
            "/usr/local/bin/ffprobe",
            "/usr/bin/ffprobe",
            "/opt/homebrew/bin/ffprobe",
            "ffprobe"
        ]
        
        for path in common_paths:
            if self._is_executable(path):
                return path
        return None
    
    def _is_executable(self, path: str) -> bool:
        """Check if path is executable"""
        try:
            result = subprocess.run([path, "-version"], 
                                  capture_output=True, text=True, timeout=5)
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError, PermissionError):
            return False
    
    async def get_media_info(self, input_path: str) -> MediaInfo:
        """Get comprehensive media information"""
        cmd = [
            self.ffprobe_path,
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            input_path
        ]
        
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                raise Exception(f"FFprobe failed: {stderr.decode()}")
            
            data = json.loads(stdout.decode())
            return self._parse_media_info(data, input_path)
            
        except Exception as e:
            raise Exception(f"Failed to get media info: {str(e)}")
    
    def _parse_media_info(self, data: Dict, filename: str) -> MediaInfo:
        """Parse FFprobe output to MediaInfo object"""
        format_info = data.get('format', {})
        streams = data.get('streams', [])
        
        # Get basic info
        media_info = MediaInfo(
            filename=filename,
            duration=float(format_info.get('duration', 0)),
            bitrate=int(format_info.get('bit_rate', 0)),
            size=int(format_info.get('size', 0)),
            format_name=format_info.get('format_name'),
            streams=streams
        )
        
        # Parse video stream info
        video_stream = next((s for s in streams if s.get('codec_type') == 'video'), None)
        if video_stream:
            media_info.video_codec = video_stream.get('codec_name')
            media_info.video_bitrate = int(video_stream.get('bit_rate', 0))
            media_info.width = int(video_stream.get('width', 0))
            media_info.height = int(video_stream.get('height', 0))
            
            # Parse frame rate
            fps_str = video_stream.get('r_frame_rate', '0/1')
            if '/' in fps_str:
                num, den = fps_str.split('/')
                if int(den) != 0:
                    media_info.fps = int(num) / int(den)
            
            # Parse aspect ratio
            dar = video_stream.get('display_aspect_ratio')
            if dar:
                media_info.aspect_ratio = dar
        
        # Parse audio stream info
        audio_stream = next((s for s in streams if s.get('codec_type') == 'audio'), None)
        if audio_stream:
            media_info.audio_codec = audio_stream.get('codec_name')
            media_info.audio_bitrate = int(audio_stream.get('bit_rate', 0))
            media_info.sample_rate = int(audio_stream.get('sample_rate', 0))
            media_info.channels = int(audio_stream.get('channels', 0))
        
        return media_info
    
    async def process_video(self, 
                          input_path: str, 
                          output_path: str, 
                          options: ProcessingOptions,
                          progress_callback: Optional[callable] = None) -> bool:
        """
        Process video with specified options
        Returns True if successful, raises exception on error
        """
        
        # Get input media info
        media_info = await self.get_media_info(input_path)
        
        # Build FFmpeg command
        cmd = self._build_ffmpeg_command(input_path, output_path, options, media_info)
        
        # Execute FFmpeg
        return await self._execute_ffmpeg(cmd, media_info.duration, progress_callback)
    
    def _build_ffmpeg_command(self, 
                            input_path: str, 
                            output_path: str, 
                            options: ProcessingOptions,
                            media_info: MediaInfo) -> List[str]:
        """Build FFmpeg command based on options"""
        cmd = [self.ffmpeg_path]
        
        # Hardware acceleration
        if options.hardware_acceleration:
            cmd.extend(["-hwaccel", "auto"])
        
        # Input
        cmd.extend(["-i", input_path])
        
        # Video processing
        if not options.audio_only:
            cmd.extend(self._get_video_options(options, media_info))
        else:
            cmd.extend(["-vn"])  # No video
        
        # Audio processing
        cmd.extend(self._get_audio_options(options, media_info))
        
        # Filters
        filters = self._build_filter_chain(options, media_info)
        if filters:
            cmd.extend(["-filter_complex", filters])
        
        # Output options
        cmd.extend(["-f", options.output_format.value])
        
        # Overwrite output file
        cmd.extend(["-y"])
        
        # Output path
        cmd.append(output_path)
        
        return cmd
    
    def _get_video_options(self, options: ProcessingOptions, media_info: MediaInfo) -> List[str]:
        """Get video encoding options"""
        cmd = []
        
        # Video codec
        cmd.extend(["-c:v", options.video_codec.value])
        
        if options.video_codec != VideoCodec.COPY:
            # Quality settings
            preset = self.quality_presets[options.quality]
            
            if options.video_codec in [VideoCodec.H264, VideoCodec.H265]:
                # Use CRF for constant quality
                cmd.extend(["-crf", preset['crf']])
                cmd.extend(["-preset", "medium"])
                
                # Bitrate if specified
                if options.video_bitrate:
                    cmd.extend(["-maxrate", options.video_bitrate])
                    cmd.extend(["-bufsize", f"{int(options.video_bitrate.rstrip('k')) * 2}k"])
            else:
                # Use bitrate for other codecs
                bitrate = options.video_bitrate or preset['video_bitrate']
                cmd.extend(["-b:v", bitrate])
            
            # Frame rate
            if options.fps:
                cmd.extend(["-r", str(options.fps)])
            
            # Resolution
            if options.width and options.height:
                cmd.extend(["-s", f"{options.width}x{options.height}"])
        
        return cmd
    
    def _get_audio_options(self, options: ProcessingOptions, media_info: MediaInfo) -> List[str]:
        """Get audio encoding options"""
        cmd = []
        
        # Audio codec
        cmd.extend(["-c:a", options.audio_codec.value])
        
        if options.audio_codec != AudioCodec.COPY:
            # Quality settings
            preset = self.quality_presets[options.quality]
            bitrate = options.audio_bitrate or preset['audio_bitrate']
            cmd.extend(["-b:a", bitrate])
            
            # Audio volume
            if options.audio_volume and options.audio_volume != 1.0:
                cmd.extend(["-af", f"volume={options.audio_volume}"])
        
        return cmd
    
    def _build_filter_chain(self, options: ProcessingOptions, media_info: MediaInfo) -> Optional[str]:
        """Build video filter chain"""
        filters = []
        
        # Scaling
        if options.width and options.height:
            filters.append(f"scale={options.width}:{options.height}")
        elif options.scale_filter:
            filters.append(f"scale={options.scale_filter}")
        
        # Cropping
        if options.crop:
            filters.append(f"crop={options.crop}")
        
        # Rotation
        if options.rotate:
            if options.rotate == 90:
                filters.append("transpose=1")
            elif options.rotate == 180:
                filters.append("transpose=2,transpose=2")
            elif options.rotate == 270:
                filters.append("transpose=2")
        
        # Denoising
        if options.denoise:
            filters.append("bm3d")
        
        # Deinterlacing
        if options.deinterlace:
            filters.append("yadif")
        
        # Custom filters
        filters.extend(options.custom_filters)
        
        return ",".join(filters) if filters else None
    
    async def _execute_ffmpeg(self, 
                            cmd: List[str], 
                            duration: float,
                            progress_callback: Optional[callable] = None) -> bool:
        """Execute FFmpeg command with progress tracking"""
        
        print(f"Executing FFmpeg: {' '.join(cmd)}")
        
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # Monitor progress
            if progress_callback:
                await self._monitor_progress(process, duration, progress_callback)
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown FFmpeg error"
                raise Exception(f"FFmpeg failed: {error_msg}")
            
            return True
            
        except Exception as e:
            raise Exception(f"FFmpeg execution failed: {str(e)}")
    
    async def _monitor_progress(self, 
                              process: asyncio.subprocess.Process,
                              duration: float,
                              progress_callback: callable):
        """Monitor FFmpeg progress and call callback"""
        
        while process.returncode is None:
            try:
                # Read stderr line by line
                if process.stderr:
                    line = await asyncio.wait_for(process.stderr.readline(), timeout=1.0)
                    if line:
                        line_str = line.decode().strip()
                        
                        # Parse time progress
                        time_match = re.search(r'time=(\d+):(\d+):(\d+\.\d+)', line_str)
                        if time_match and duration > 0:
                            hours = int(time_match.group(1))
                            minutes = int(time_match.group(2))
                            seconds = float(time_match.group(3))
                            
                            current_time = hours * 3600 + minutes * 60 + seconds
                            progress = min(current_time / duration * 100, 100)
                            
                            await progress_callback(progress, current_time, duration)
                    
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                print(f"Progress monitoring error: {e}")
                break
    
    async def extract_audio(self, 
                          input_path: str, 
                          output_path: str,
                          audio_format: AudioFormat = AudioFormat.MP3,
                          bitrate: str = "192k") -> bool:
        """Extract audio from video file"""
        
        options = ProcessingOptions(
            audio_only=True,
            audio_codec=AudioCodec.MP3 if audio_format == AudioFormat.MP3 else AudioCodec.AAC,
            audio_bitrate=bitrate
        )
        
        return await self.process_video(input_path, output_path, options)
    
    async def convert_format(self, 
                           input_path: str, 
                           output_path: str,
                           output_format: VideoFormat) -> bool:
        """Convert video to different format"""
        
        options = ProcessingOptions(
            output_format=output_format,
            video_codec=VideoCodec.COPY,
            audio_codec=AudioCodec.COPY
        )
        
        return await self.process_video(input_path, output_path, options)
    
    async def resize_video(self, 
                         input_path: str, 
                         output_path: str,
                         width: int, 
                         height: int) -> bool:
        """Resize video to specified dimensions"""
        
        options = ProcessingOptions(
            width=width,
            height=height,
            video_codec=VideoCodec.H264,
            audio_codec=AudioCodec.COPY
        )
        
        return await self.process_video(input_path, output_path, options)
    
    async def compress_video(self, 
                           input_path: str, 
                           output_path: str,
                           quality: VideoQuality = VideoQuality.MEDIUM) -> bool:
        """Compress video with specified quality"""
        
        options = ProcessingOptions(
            quality=quality,
            video_codec=VideoCodec.H264,
            audio_codec=AudioCodec.AAC
        )
        
        return await self.process_video(input_path, output_path, options)
    
    def get_supported_formats(self) -> Dict[str, List[str]]:
        """Get list of supported input/output formats"""
        return {
            'video_input': ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'm4v', '3gp'],
            'video_output': [fmt.value for fmt in VideoFormat],
            'audio_input': ['mp3', 'aac', 'flac', 'ogg', 'wav', 'm4a'],
            'audio_output': [fmt.value for fmt in AudioFormat],
            'video_codecs': [codec.value for codec in VideoCodec if codec != VideoCodec.COPY],
            'audio_codecs': [codec.value for codec in AudioCodec if codec != AudioCodec.COPY]
        }

# Example usage and testing
async def test_ffmpeg_processor():
    """Test the FFmpeg processor"""
    processor = FFmpegProcessor()
    
    # Test media info
    test_file = "test_video.mp4"
    if os.path.exists(test_file):
        try:
            info = await processor.get_media_info(test_file)
            print(f"Media Info: {info}")
            
            # Test conversion
            options = ProcessingOptions(
                output_format=VideoFormat.MP4,
                quality=VideoQuality.MEDIUM,
                video_codec=VideoCodec.H264,
                audio_codec=AudioCodec.AAC
            )
            
            success = await processor.process_video(
                test_file, 
                "output.mp4", 
                options,
                progress_callback=lambda p, c, d: print(f"Progress: {p:.1f}%")
            )
            
            print(f"Processing successful: {success}")
            
        except Exception as e:
            print(f"Test failed: {e}")
    else:
        print("Test file not found")

if __name__ == "__main__":
    asyncio.run(test_ffmpeg_processor())