# 📦 安装指南

本文档提供了 Downie Enhanced 的详细安装和部署指南。

## 📋 目录

- [系统要求](#系统要求)
- [快速开始](#快速开始)
- [开发环境搭建](#开发环境搭建)
- [生产环境部署](#生产环境部署)
- [Docker 部署](#docker-部署)
- [浏览器扩展安装](#浏览器扩展安装)
- [故障排除](#故障排除)

## 🔧 系统要求

### 基础要求

- **操作系统**: Windows 10+, macOS 10.15+, Ubuntu 18.04+
- **Python**: 3.9 或更高版本
- **Node.js**: 16.0 或更高版本
- **FFmpeg**: 4.0 或更高版本
- **Git**: 版本控制工具

### 硬件要求

- **最小配置**:
  - RAM: 2GB
  - 磁盘空间: 1GB
  - 网络: 宽带连接

- **推荐配置**:
  - RAM: 4GB+
  - 磁盘空间: 5GB+
  - SSD 存储
  - 稳定的网络连接

## 🚀 快速开始

### 一键安装脚本

```bash
# Linux/macOS
curl -fsSL https://raw.githubusercontent.com/ychenfen/downie-enhanced/main/install.sh | bash

# 或手动安装
git clone https://github.com/ychenfen/downie-enhanced.git
cd downie-enhanced
chmod +x start.sh
./start.sh
```

### Windows 快速启动

```cmd
# 克隆仓库
git clone https://github.com/ychenfen/downie-enhanced.git
cd downie-enhanced

# 运行启动脚本
start.bat
```

## 🛠️ 开发环境搭建

### 1. 克隆仓库

```bash
git clone https://github.com/ychenfen/downie-enhanced.git
cd downie-enhanced
```

### 2. 安装 Python 依赖

```bash
cd backend

# 创建虚拟环境（推荐）
python -m venv venv

# 激活虚拟环境
# Linux/macOS:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

### 3. 安装 Node.js 依赖

```bash
cd frontend

# 使用 npm
npm install

# 或使用 yarn
yarn install
```

### 4. 安装 FFmpeg

#### macOS (Homebrew)
```bash
brew install ffmpeg
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install ffmpeg
```

#### Windows (Chocolatey)
```bash
choco install ffmpeg
```

#### Windows (手动安装)
1. 从 [FFmpeg 官网](https://ffmpeg.org/download.html) 下载
2. 解压到 `C:\ffmpeg`
3. 添加 `C:\ffmpeg\bin` 到系统 PATH

### 5. 配置环境变量

创建 `.env` 文件：

```bash
# 后端配置
API_HOST=127.0.0.1
API_PORT=8000
DEBUG=true

# 前端配置
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000

# FFmpeg 路径（可选）
FFMPEG_PATH=/usr/local/bin/ffmpeg
FFPROBE_PATH=/usr/local/bin/ffprobe

# 下载目录
DOWNLOAD_DIR=./downloads
MAX_CONCURRENT_DOWNLOADS=3
```

### 6. 启动开发服务

#### 启动后端
```bash
cd backend
python main.py
```

#### 启动前端
```bash
cd frontend
npm start
```

### 7. 访问应用

- **前端界面**: http://localhost:3000
- **API 文档**: http://localhost:8000/docs
- **健康检查**: http://localhost:8000/health

## 🏭 生产环境部署

### 使用 Nginx + Gunicorn

#### 1. 安装 Gunicorn

```bash
cd backend
pip install gunicorn uvicorn[standard]
```

#### 2. Gunicorn 配置

创建 `gunicorn.conf.py`:

```python
bind = "127.0.0.1:8000"
workers = 4
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 100
timeout = 30
keepalive = 2
preload_app = True
```

#### 3. 启动 Gunicorn

```bash
gunicorn main:app -c gunicorn.conf.py
```

#### 4. 构建前端

```bash
cd frontend
npm run build
```

#### 5. Nginx 配置

创建 `/etc/nginx/sites-available/downie-enhanced`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/downie-enhanced/frontend/build;
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket 代理
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### 6. 启用站点

```bash
sudo ln -s /etc/nginx/sites-available/downie-enhanced /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 系统服务配置

#### Systemd 服务文件

创建 `/etc/systemd/system/downie-enhanced.service`:

```ini
[Unit]
Description=Downie Enhanced
After=network.target

[Service]
Type=exec
User=www-data
Group=www-data
WorkingDirectory=/path/to/downie-enhanced/backend
Environment="PATH=/path/to/downie-enhanced/backend/venv/bin"
ExecStart=/path/to/downie-enhanced/backend/venv/bin/gunicorn main:app -c gunicorn.conf.py
ExecReload=/bin/kill -s HUP $MAINPID
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

#### 启动服务

```bash
sudo systemctl daemon-reload
sudo systemctl enable downie-enhanced
sudo systemctl start downie-enhanced
sudo systemctl status downie-enhanced
```

## 🐳 Docker 部署

### 使用 Docker Compose（推荐）

#### 1. 克隆仓库
```bash
git clone https://github.com/ychenfen/downie-enhanced.git
cd downie-enhanced
```

#### 2. 启动服务
```bash
docker-compose up -d
```

#### 3. 查看状态
```bash
docker-compose ps
docker-compose logs -f
```

### 手动 Docker 构建

#### 构建镜像

```bash
# 构建后端镜像
docker build -t downie-enhanced-backend ./backend

# 构建前端镜像
docker build -t downie-enhanced-frontend ./frontend
```

#### 运行容器

```bash
# 创建网络
docker network create downie-network

# 启动后端
docker run -d \
  --name downie-backend \
  --network downie-network \
  -p 8000:8000 \
  -v $(pwd)/downloads:/app/downloads \
  downie-enhanced-backend

# 启动前端
docker run -d \
  --name downie-frontend \
  --network downie-network \
  -p 3000:80 \
  downie-enhanced-frontend
```

### 环境变量配置

创建 `.env` 文件：

```bash
# 应用配置
ENVIRONMENT=production
DEBUG=false
API_HOST=0.0.0.0
API_PORT=8000

# 数据库（如果使用）
DATABASE_URL=postgresql://user:pass@localhost:5432/downie

# Redis（如果使用）
REDIS_URL=redis://localhost:6379/0

# 文件存储
DOWNLOAD_DIR=/app/downloads
MAX_FILE_SIZE=2147483648  # 2GB

# FFmpeg
FFMPEG_PATH=/usr/bin/ffmpeg
ENABLE_HARDWARE_ACCELERATION=false

# 安全配置
API_SECRET_KEY=your-super-secret-key-change-this
JWT_SECRET_KEY=your-jwt-secret-key

# CORS 配置
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com
```

## 🔌 浏览器扩展安装

### Chrome 扩展

#### 开发版安装
1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 启用右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目中的 `browser-extension` 文件夹
6. 扩展安装完成

#### 发布版安装（待发布）
1. 访问 Chrome Web Store
2. 搜索 "Downie Enhanced"
3. 点击"添加至 Chrome"

### Firefox 扩展

#### 开发版安装
1. 打开 Firefox 浏览器
2. 访问 `about:debugging`
3. 点击"此 Firefox"
4. 点击"临时载入附加组件"
5. 选择 `browser-extension/manifest.json` 文件

#### 发布版安装（待发布）
1. 访问 Firefox Add-ons
2. 搜索 "Downie Enhanced"
3. 点击"添加到 Firefox"

### 扩展配置

安装后需要配置后端服务器地址：

1. 点击扩展图标
2. 在设置中输入后端地址：`http://localhost:8000`
3. 测试连接确保正常工作

## 🔧 故障排除

### 常见问题

#### 1. Python 依赖安装失败

```bash
# 升级 pip
pip install --upgrade pip

# 使用国内镜像
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple/

# 如果有编译错误，安装构建工具
# Ubuntu/Debian:
sudo apt install build-essential python3-dev
# macOS:
xcode-select --install
```

#### 2. Node.js 依赖安装失败

```bash
# 清理缓存
npm cache clean --force
rm -rf node_modules package-lock.json

# 重新安装
npm install

# 使用国内镜像
npm install --registry https://registry.npmmirror.com/
```

#### 3. FFmpeg 未找到

```bash
# 检查 FFmpeg 安装
ffmpeg -version

# 手动指定路径
export FFMPEG_PATH=/usr/local/bin/ffmpeg
export FFPROBE_PATH=/usr/local/bin/ffprobe

# 添加到环境变量
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

#### 4. 端口冲突

```bash
# 检查端口占用
lsof -i :8000
lsof -i :3000

# 修改端口配置
export API_PORT=8001
export REACT_APP_API_URL=http://localhost:8001
```

#### 5. 权限错误

```bash
# 创建下载目录
mkdir -p downloads
chmod 755 downloads

# 修复文件权限
chmod +x start.sh
```

#### 6. Docker 相关问题

```bash
# 查看容器日志
docker-compose logs backend
docker-compose logs frontend

# 重建容器
docker-compose down
docker-compose up -d --build

# 清理 Docker 缓存
docker system prune -a
```

### 性能优化

#### 1. 系统级优化

```bash
# 增加文件描述符限制
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# 优化网络参数
echo "net.core.somaxconn = 1024" >> /etc/sysctl.conf
echo "net.ipv4.tcp_max_syn_backlog = 1024" >> /etc/sysctl.conf
sysctl -p
```

#### 2. 应用级优化

```bash
# 启用 HTTP/2
# 在 Nginx 配置中添加：
listen 443 ssl http2;

# 开启 Gzip 压缩
gzip on;
gzip_types text/plain text/css application/json application/javascript;

# 设置缓存头
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 日志和监控

#### 启用详细日志

```bash
# 后端日志
export LOG_LEVEL=DEBUG
export LOG_FORMAT=json

# 前端日志
export REACT_APP_LOG_LEVEL=debug
```

#### 日志位置

- **后端日志**: `logs/backend.log`
- **前端日志**: 浏览器控制台
- **Nginx 日志**: `/var/log/nginx/access.log`
- **系统日志**: `journalctl -u downie-enhanced`

### 获取帮助

如果遇到其他问题：

1. **查看文档**: [完整文档](../README.md)
2. **搜索 Issues**: [GitHub Issues](https://github.com/ychenfen/downie-enhanced/issues)
3. **提交问题**: [新建 Issue](https://github.com/ychenfen/downie-enhanced/issues/new)
4. **社区讨论**: [GitHub Discussions](https://github.com/ychenfen/downie-enhanced/discussions)

---

## 🎉 安装完成！

安装完成后，您应该能够：

1. ✅ 访问 Web 界面 (http://localhost:3000)
2. ✅ 使用浏览器扩展
3. ✅ 调用 API 接口
4. ✅ 下载各种格式的视频

享受 Downie Enhanced 带来的便捷体验吧！🚀