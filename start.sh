#!/bin/bash

# Downie Enhanced - Quick Start Script
# 快速启动脚本

set -e

echo "🚀 Starting Downie Enhanced..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p {logs,downloads,uploads,static}

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    print_status "Creating environment configuration..."
    cat > .env << EOF
# Downie Enhanced Configuration

# Environment
ENVIRONMENT=development
DEBUG=true

# Database
DATABASE_URL=postgresql://downie:password@postgres:5432/downie_db
DB_HOST=postgres
DB_PORT=5432
DB_NAME=downie_db
DB_USER=downie
DB_PASS=password

# Redis
REDIS_URL=redis://redis:6379/0
REDIS_HOST=redis
REDIS_PORT=6379

# Celery
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# API
API_HOST=0.0.0.0
API_PORT=8000
API_SECRET_KEY=your-secret-key-change-this-in-production

# Frontend
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000

# Security
JWT_SECRET_KEY=your-jwt-secret-key-change-this
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=30

# File Storage
MAX_FILE_SIZE=1073741824  # 1GB
UPLOAD_DIR=./uploads
DOWNLOAD_DIR=./downloads

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json

# Features
ENABLE_DOWNLOAD_QUEUE=true
ENABLE_BATCH_DOWNLOAD=true
ENABLE_AI_FEATURES=false
ENABLE_CLOUD_STORAGE=false

EOF
    print_success "Environment file created: .env"
else
    print_warning "Environment file already exists: .env"
fi

# Function to start services
start_services() {
    print_status "Starting Downie Enhanced services..."
    
    cd docker
    
    # Pull latest images
    print_status "Pulling Docker images..."
    docker-compose pull
    
    # Build and start services
    print_status "Building and starting services..."
    docker-compose up -d --build
    
    # Wait for services to be healthy
    print_status "Waiting for services to start..."
    sleep 10
    
    # Check service status
    print_status "Checking service status..."
    docker-compose ps
    
    cd ..
}

# Function to show service URLs
show_urls() {
    print_success "🎉 Downie Enhanced is now running!"
    echo ""
    echo "📱 Frontend (Web UI):     http://localhost:3000"
    echo "🔧 Backend API:           http://localhost:8000"
    echo "📖 API Documentation:     http://localhost:8000/api/docs"
    echo "📊 Grafana Monitoring:    http://localhost:3001 (admin/admin)"
    echo "🔍 Prometheus Metrics:    http://localhost:9090"
    echo ""
    echo "🛠️  Development URLs:"
    echo "   PostgreSQL:            localhost:5432"
    echo "   Redis:                 localhost:6379"
    echo ""
    echo "📝 Logs: docker-compose -f docker/docker-compose.yml logs -f"
    echo "🛑 Stop: docker-compose -f docker/docker-compose.yml down"
    echo ""
}

# Function to install dependencies for development
install_dev_deps() {
    print_status "Installing development dependencies..."
    
    # Frontend dependencies
    if [ -d "frontend" ]; then
        print_status "Installing frontend dependencies..."
        cd frontend
        if command -v yarn &> /dev/null; then
            yarn install
        else
            npm install
        fi
        cd ..
    fi
    
    # Backend dependencies
    if [ -d "backend" ]; then
        print_status "Installing backend dependencies..."
        cd backend
        if command -v poetry &> /dev/null; then
            poetry install
        else
            pip install -r requirements.txt
        fi
        cd ..
    fi
}

# Main execution
case "${1:-start}" in
    "start")
        start_services
        show_urls
        ;;
    "stop")
        print_status "Stopping Downie Enhanced services..."
        cd docker && docker-compose down
        print_success "Services stopped."
        ;;
    "restart")
        print_status "Restarting Downie Enhanced services..."
        cd docker && docker-compose restart
        show_urls
        ;;
    "logs")
        print_status "Showing service logs..."
        cd docker && docker-compose logs -f
        ;;
    "dev")
        install_dev_deps
        print_success "Development environment ready!"
        ;;
    "clean")
        print_warning "This will remove all containers, images, and volumes!"
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cd docker && docker-compose down -v --rmi all
            print_success "Clean completed."
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|logs|dev|clean}"
        echo ""
        echo "Commands:"
        echo "  start   - Start all services (default)"
        echo "  stop    - Stop all services"
        echo "  restart - Restart all services"
        echo "  logs    - Show service logs"
        echo "  dev     - Install development dependencies"
        echo "  clean   - Remove all containers and data"
        echo ""
        exit 1
        ;;
esac