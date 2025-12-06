#!/bin/bash

# AI Grading System - Setup Script
# This script helps set up the entire system

set -e

echo "=================================================="
echo "  AI Grading System V2 - Setup Script"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "ℹ️  $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    print_warning "Please don't run as root"
    exit 1
fi

# Step 1: Check prerequisites
echo "Step 1: Checking prerequisites..."
echo "-----------------------------------"

# Check for podman or docker
if command -v podman &> /dev/null; then
    CONTAINER_CMD="podman"
    COMPOSE_CMD="podman-compose"
    print_success "Podman found"
elif command -v docker &> /dev/null; then
    CONTAINER_CMD="docker"
    COMPOSE_CMD="docker-compose"
    print_success "Docker found"
else
    print_error "Neither Podman nor Docker found. Please install one of them."
    exit 1
fi

# Check for compose
if ! command -v $COMPOSE_CMD &> /dev/null; then
    print_error "$COMPOSE_CMD not found. Please install it."
    exit 1
fi
print_success "$COMPOSE_CMD found"

# Check for python
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 not found. Please install Python 3.11+"
    exit 1
fi
PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
print_success "Python $PYTHON_VERSION found"

echo ""

# Step 2: Create directory structure
echo "Step 2: Creating directory structure..."
echo "----------------------------------------"

mkdir -p backend
mkdir -p frontend
mkdir -p uploads/ground_truth
mkdir -p uploads/student_papers

print_success "Directories created"
echo ""

# Step 3: Setup environment file
echo "Step 3: Setting up environment file..."
echo "---------------------------------------"

if [ ! -f "backend/.env" ]; then
    cat > backend/.env << 'EOF'
# OpenAI API Key (Required for OCR features)
OPENAI_API_KEY=your_openai_api_key_here

# Database Configuration
DATABASE_URL=postgresql://grading_user:grading_pass@db:5432/grading_db

# PostgreSQL Configuration
POSTGRES_DB=grading_db
POSTGRES_USER=grading_user
POSTGRES_PASSWORD=grading_pass
EOF
    print_success "Created .env file"
    print_warning "Please edit backend/.env and add your OpenAI API key"
    
    # Ask if user wants to edit now
    read -p "Do you want to edit the .env file now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ${EDITOR:-nano} backend/.env
    fi
else
    print_info ".env file already exists"
fi

echo ""

# Step 4: Check if files are in place
echo "Step 4: Checking required files..."
echo "-----------------------------------"

REQUIRED_FILES=(
    "backend/main.py"
    "backend/database.py"
    "backend/models.py"
    "backend/grading_engine.py"
    "backend/ocr_service.py"
    "backend/requirements.txt"
    "backend/Dockerfile"
    "podman-compose.yml"
)

missing_files=0
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "$file found"
    else
        print_error "$file missing"
        missing_files=$((missing_files + 1))
    fi
done

if [ $missing_files -gt 0 ]; then
    print_error "$missing_files required files missing. Please copy all files."
    exit 1
fi

echo ""

# Step 5: Build containers
echo "Step 5: Building containers..."
echo "-------------------------------"

print_info "This may take a few minutes..."

if $COMPOSE_CMD build; then
    print_success "Containers built successfully"
else
    print_error "Failed to build containers"
    exit 1
fi

echo ""

# Step 6: Start services
echo "Step 6: Starting services..."
echo "----------------------------"

if $COMPOSE_CMD up -d; then
    print_success "Services started"
else
    print_error "Failed to start services"
    exit 1
fi

echo ""

# Step 7: Wait for services to be ready
echo "Step 7: Waiting for services to be ready..."
echo "--------------------------------------------"

print_info "Waiting for database (30 seconds)..."
sleep 30

print_info "Checking backend health..."
max_attempts=10
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:8000/ > /dev/null 2>&1; then
        print_success "Backend is ready!"
        break
    else
        attempt=$((attempt + 1))
        echo -n "."
        sleep 3
    fi
done

if [ $attempt -eq $max_attempts ]; then
    print_error "Backend failed to start"
    print_info "Check logs with: $COMPOSE_CMD logs backend"
    exit 1
fi

echo ""

# Step 8: Verify deployment
echo "Step 8: Verifying deployment..."
echo "--------------------------------"

# Check health endpoint
if curl -s http://localhost:8000/api/health | grep -q "healthy"; then
    print_success "Health check passed"
else
    print_error "Health check failed"
    $COMPOSE_CMD logs backend | tail -n 20
fi

echo ""

# Step 9: Summary
echo "=================================================="
echo "  Setup Complete!"
echo "=================================================="
echo ""
print_success "All services are running"
echo ""
echo "Services:"
echo "  Backend API: http://localhost:8000"
echo "  API Docs:    http://localhost:8000/docs"
if [ -f "frontend/Dockerfile" ]; then
    echo "  Frontend:    http://localhost:3000"
fi
echo ""
echo "Useful commands:"
echo "  View logs:        $COMPOSE_CMD logs -f"
echo "  Stop services:    $COMPOSE_CMD down"
echo "  Restart services: $COMPOSE_CMD restart"
echo "  View status:      $COMPOSE_CMD ps"
echo ""
print_info "Run 'python3 test_system.py' to test the system"
echo ""

# Ask if user wants to run tests
read -p "Do you want to run the test suite now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f "test_system.py" ]; then
        python3 test_system.py
    else
        print_warning "test_system.py not found"
    fi
fi

echo ""
print_success "Setup completed successfully!"
