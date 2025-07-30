#!/usr/bin/env python3
"""
Downie Enhanced - System Status Checker
检查系统依赖和服务状态
"""

import os
import sys
import subprocess
import json
import requests
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import asyncio
import websockets
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress
from rich import box

console = Console()

class StatusChecker:
    def __init__(self):
        self.results = {}
        self.base_path = Path(__file__).parent
        
    def run_command(self, command: List[str], capture_output: bool = True) -> Tuple[bool, str]:
        """运行系统命令"""
        try:
            result = subprocess.run(
                command,
                capture_output=capture_output,
                text=True,
                timeout=10
            )
            return result.returncode == 0, result.stdout.strip()
        except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError) as e:
            return False, str(e)
    
    def check_python_version(self) -> Dict:
        """检查Python版本"""
        try:
            version = sys.version_info
            is_valid = version.major == 3 and version.minor >= 9
            return {
                'status': 'pass' if is_valid else 'fail',
                'version': f"{version.major}.{version.minor}.{version.micro}",
                'required': '3.9+',
                'message': 'Python版本符合要求' if is_valid else 'Python版本过低，需要3.9+'
            }
        except Exception as e:
            return {
                'status': 'error',
                'message': f'检查Python版本失败: {e}'
            }
    
    def check_node_version(self) -> Dict:
        """检查Node.js版本"""
        success, output = self.run_command(['node', '--version'])
        if not success:
            return {
                'status': 'fail',
                'message': 'Node.js未安装或不在PATH中'
            }
        
        try:
            version = output.replace('v', '')
            major_version = int(version.split('.')[0])
            is_valid = major_version >= 16
            
            return {
                'status': 'pass' if is_valid else 'fail',
                'version': version,
                'required': '16.0+',
                'message': 'Node.js版本符合要求' if is_valid else 'Node.js版本过低，需要16.0+'
            }
        except Exception as e:
            return {
                'status': 'error',
                'message': f'解析Node.js版本失败: {e}'
            }
    
    def check_ffmpeg(self) -> Dict:
        """检查FFmpeg安装"""
        success, output = self.run_command(['ffmpeg', '-version'])
        if not success:
            return {
                'status': 'fail',
                'message': 'FFmpeg未安装或不在PATH中'
            }
        
        try:
            lines = output.split('\n')
            version_line = lines[0]
            version = version_line.split()[2]
            
            return {
                'status': 'pass',
                'version': version,
                'message': 'FFmpeg已正确安装'
            }
        except Exception as e:
            return {
                'status': 'warning',
                'message': f'FFmpeg已安装但版本解析失败: {e}'
            }
    
    def check_git(self) -> Dict:
        """检查Git安装"""
        success, output = self.run_command(['git', '--version'])
        if not success:
            return {
                'status': 'fail',
                'message': 'Git未安装或不在PATH中'
            }
        
        try:
            version = output.split()[2]
            return {
                'status': 'pass',
                'version': version,
                'message': 'Git已正确安装'
            }
        except Exception as e:
            return {
                'status': 'warning',
                'message': f'Git已安装但版本解析失败: {e}'
            }
    
    def check_python_dependencies(self) -> Dict:
        """检查Python依赖"""
        requirements_file = self.base_path / 'backend' / 'requirements.txt'
        if not requirements_file.exists():
            return {
                'status': 'fail',
                'message': 'requirements.txt文件不存在'
            }
        
        try:
            # 检查虚拟环境
            venv_path = self.base_path / 'backend' / 'venv'
            has_venv = venv_path.exists()
            
            # 尝试导入关键依赖
            try:
                import fastapi
                import uvicorn
                import aiohttp
                deps_installed = True
            except ImportError:
                deps_installed = False
            
            if deps_installed:
                return {
                    'status': 'pass',
                    'has_venv': has_venv,
                    'message': '核心Python依赖已安装'
                }
            else:
                return {
                    'status': 'fail',
                    'has_venv': has_venv,
                    'message': '核心Python依赖未安装，请运行: pip install -r requirements. txt'
                }
        except Exception as e:
            return {
                'status': 'error',
                'message': f'检查Python依赖失败: {e}'
            }
    
    def check_node_dependencies(self) -> Dict:
        """检查Node.js依赖"""
        frontend_path = self.base_path / 'frontend'
        package_json = frontend_path / 'package.json'
        node_modules = frontend_path / 'node_modules'
        
        if not package_json.exists():
            return {
                'status': 'fail',
                'message': 'package.json文件不存在'
            }
        
        if not node_modules.exists():
            return {
                'status': 'fail',
                'message': 'node_modules目录不存在，请运行: npm install'
            }
        
        # 检查关键依赖
        key_deps = ['react', 'typescript', '@types/react']
        missing_deps = []
        
        for dep in key_deps:
            dep_path = node_modules / dep
            if not dep_path.exists():
                missing_deps.append(dep)
        
        if missing_deps:
            return {
                'status': 'warning',
                'message': f'缺少关键依赖: {", ".join(missing_deps)}'
            }
        
        return {
            'status': 'pass',
            'message': 'Node.js依赖已正确安装'
        }
    
    def check_backend_service(self) -> Dict:
        """检查后端服务状态"""
        try:
            response = requests.get('http://localhost:8000/health', timeout=5)
            if response.status_code == 200:
                data = response.json()
                return {
                    'status': 'pass',
                    'message': '后端服务运行正常',
                    'data': data
                }
            else:
                return {
                    'status': 'fail',
                    'message': f'后端服务响应异常: HTTP {response.status_code}'
                }
        except requests.exceptions.ConnectionError:
            return {
                'status': 'fail',
                'message': '后端服务未启动或无法连接 (http://localhost:8000)'
            }
        except Exception as e:
            return {
                'status': 'error',
                'message': f'检查后端服务失败: {e}'
            }
    
    def check_frontend_service(self) -> Dict:
        """检查前端服务状态"""
        try:
            response = requests.get('http://localhost:3000', timeout=5)
            if response.status_code == 200:
                return {
                    'status': 'pass',
                    'message': '前端服务运行正常'
                }
            else:
                return {
                    'status': 'fail',
                    'message': f'前端服务响应异常: HTTP {response.status_code}'
                }
        except requests.exceptions.ConnectionError:
            return {
                'status': 'fail',
                'message': '前端服务未启动或无法连接 (http://localhost:3000)'
            }
        except Exception as e:
            return {
                'status': 'error',
                'message': f'检查前端服务失败: {e}'
            }
    
    async def check_websocket(self) -> Dict:
        """检查WebSocket连接"""
        try:
            uri = "ws://localhost:8000/api/downloads/ws"
            async with websockets.connect(uri, timeout=5) as websocket:
                # 发送ping消息
                await websocket.send('{"type": "ping"}')
                response = await asyncio.wait_for(websocket.recv(), timeout=5)
                
                return {
                    'status': 'pass',
                    'message': 'WebSocket连接正常'
                }
        except Exception as e:
            return {
                'status': 'fail',
                'message': f'WebSocket连接失败: {e}'
            }
    
    def check_file_structure(self) -> Dict:
        """检查项目文件结构"""
        required_files = [
            'README.md',
            'backend/main.py',
            'backend/requirements.txt',
            'frontend/package.json',
            'frontend/src/App.tsx',
            'browser-extension/manifest.json',
            'docs/API.md'
        ]
        
        missing_files = []
        for file_path in required_files:
            full_path = self.base_path / file_path
            if not full_path.exists():
                missing_files.append(file_path)
        
        if missing_files:
            return {
                'status': 'warning',
                'message': f'缺少文件: {", ".join(missing_files)}'
            }
        
        return {
            'status': 'pass',
            'message': '项目文件结构完整'
        }
    
    def check_permissions(self) -> Dict:
        """检查文件权限"""
        try:
            # 检查下载目录
            downloads_dir = self.base_path / 'downloads'
            if not downloads_dir.exists():
                downloads_dir.mkdir(exist_ok=True)
            
            # 测试写权限
            test_file = downloads_dir / '.test_write'
            try:
                test_file.write_text('test')
                test_file.unlink()
                
                return {
                    'status': 'pass',
                    'message': '文件权限正常'
                }
            except PermissionError:
                return {
                    'status': 'fail',
                    'message': '下载目录没有写权限'
                }
        except Exception as e:
            return {
                'status': 'error',
                'message': f'检查文件权限失败: {e}'
            }
    
    def run_all_checks(self):
        """运行所有检查"""
        checks = [
            ('Python版本', self.check_python_version),
            ('Node.js版本', self.check_node_version),
            ('FFmpeg安装', self.check_ffmpeg),
            ('Git安装', self.check_git),
            ('Python依赖', self.check_python_dependencies),
            ('Node.js依赖', self.check_node_dependencies),
            ('项目结构', self.check_file_structure),
            ('文件权限', self.check_permissions),
            ('后端服务', self.check_backend_service),
            ('前端服务', self.check_frontend_service)
        ]
        
        # WebSocket检查需要异步
        async def check_ws():
            return await self.check_websocket()
        
        with Progress() as progress:
            task = progress.add_task("正在检查系统状态...", total=len(checks) + 1)
            
            for name, check_func in checks:
                self.results[name] = check_func()
                progress.advance(task)
            
            # 异步检查WebSocket
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            self.results['WebSocket连接'] = loop.run_until_complete(check_ws())
            progress.advance(task)
    
    def print_results(self):
        """打印检查结果"""
        console.print(Panel.fit("🔍 Downie Enhanced 系统状态检查", style="bold blue"))
        
        # 创建结果表格
        table = Table(box=box.ROUNDED)
        table.add_column("检查项目", style="cyan", width=20)
        table.add_column("状态", justify="center", width=10)
        table.add_column("详细信息", style="white", width=50)
        
        status_colors = {
            'pass': 'green',
            'fail': 'red',
            'warning': 'yellow',
            'error': 'red'
        }
        
        status_icons = {
            'pass': '✅',
            'fail': '❌',
            'warning': '⚠️',
            'error': '💥'
        }
        
        for name, result in self.results.items():
            status = result.get('status', 'unknown')
            message = result.get('message', 'No message')
            version = result.get('version', '')
            
            if version:
                message = f"{message} (v{version})"
            
            status_text = f"{status_icons.get(status, '❓')} {status.upper()}"
            
            table.add_row(
                name,
                f"[{status_colors.get(status, 'white')}]{status_text}[/]",
                message
            )
        
        console.print(table)
        
        # 统计结果
        total = len(self.results)
        passed = sum(1 for r in self.results.values() if r.get('status') == 'pass')
        failed = sum(1 for r in self.results.values() if r.get('status') == 'fail')
        warnings = sum(1 for r in self.results.values() if r.get('status') == 'warning')
        
        # 打印总结
        if failed == 0 and warnings == 0:
            console.print(Panel(
                f"🎉 所有检查均通过！({passed}/{total})\n"
                "系统已准备就绪，可以开始使用 Downie Enhanced。",
                style="green",
                title="检查完成"
            ))
        elif failed == 0:
            console.print(Panel(
                f"⚠️  检查基本通过 ({passed}/{total})\n"
                f"有 {warnings} 个警告项目，建议检查和修复。",
                style="yellow",
                title="检查完成"
            ))
        else:
            console.print(Panel(
                f"❌ 检查发现问题 ({passed}/{total})\n"
                f"有 {failed} 个失败项目和 {warnings} 个警告项目需要修复。",
                style="red",
                title="检查完成"
            ))
        
        # 提供建议
        self.print_suggestions()
    
    def print_suggestions(self):
        """打印修复建议"""
        suggestions = []
        
        for name, result in self.results.items():
            status = result.get('status')
            if status in ['fail', 'error']:
                if name == 'Python版本':
                    suggestions.append("• 请升级Python到3.9或更高版本")
                elif name == 'Node.js版本':
                    suggestions.append("• 请安装Node.js 16.0或更高版本")
                elif name == 'FFmpeg安装':
                    suggestions.append("• 请安装FFmpeg: https://ffmpeg.org/download.html")
                elif name == 'Python依赖':
                    suggestions.append("• 运行: cd backend && pip install -r requirements.txt")
                elif name == 'Node.js依赖':
                    suggestions.append("• 运行: cd frontend && npm install")
                elif name == '后端服务':
                    suggestions.append("• 启动后端服务: cd backend && python main.py")
                elif name == '前端服务':
                    suggestions.append("• 启动前端服务: cd frontend && npm start")
                elif name == '文件权限':
                    suggestions.append("• 检查并修复下载目录权限: chmod 755 downloads/")
        
        if suggestions:
            console.print(Panel(
                "\n".join(suggestions),
                title="修复建议",
                style="cyan"
            ))

def main():
    """主函数"""
    console.print("[bold]Downie Enhanced 系统状态检查工具[/bold]\n")
    
    checker = StatusChecker()
    checker.run_all_checks()
    checker.print_results()
    
    # 生成JSON报告
    report_file = Path('system_status_report.json')
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(checker.results, f, ensure_ascii=False, indent=2)
    
    console.print(f"\n📊 详细报告已保存到: {report_file}")

if __name__ == '__main__':
    main()