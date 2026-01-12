#!/bin/bash

###############################################################################
# Megawatts Discord Bot - Service Start Script
# 
# This script starts all Docker services in the correct order.
# It supports both development and production environments.
#
# Usage:
#   ./start.sh [dev|prod|staging]
#
# Environment options:
#   dev      - Uses docker-compose.yml (default, development environment)
#   prod     - Uses docker/docker-compose.yml (production environment)
#   staging  - Uses docker/docker-compose.staging.yml (staging environment)
###############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${1:-dev}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE=""

# Determine which docker-compose file to use based on environment
case "$ENVIRONMENT" in
    dev)
        COMPOSE_FILE="docker-compose.yml"
        ;;
    prod)
        COMPOSE_FILE="docker/docker-compose.yml"
        ;;
    staging)
        COMPOSE_FILE="docker/docker-compose.staging.yml"
        ;;
    *)
        echo -e "${RED}Error: Unknown environment '$ENVIRONMENT'${NC}"
        echo "Usage: $0 [dev|prod|staging]"
        exit 1
        ;;
esac

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Megawatts Discord Bot - Starting Services${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Environment: ${GREEN}$ENVIRONMENT${NC}"
echo -e "Compose File: ${YELLOW}$COMPOSE_FILE${NC}"
echo -e "${BLUE}========================================${NC}"

# Function to print step messages
print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Function to print success messages
print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Function to print error messages
print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
print_step "Checking if Docker is running..."
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi
print_success "Docker is running"

# Check if Docker Compose is available
print_step "Checking Docker Compose availability..."
if ! command -v docker compose &> /dev/null; then
    print_error "Docker Compose is not installed or not in PATH"
    exit 1
fi
print_success "Docker Compose is available"

# Check if the compose file exists
print_step "Checking if compose file exists..."
if [ ! -f "$COMPOSE_FILE" ]; then
    print_error "Compose file '$COMPOSE_FILE' not found"
    exit 1
fi
print_success "Compose file found"

# Check if .env file exists
print_step "Checking for environment file..."
ENV_FILE=""
case "$ENVIRONMENT" in
    dev)
        ENV_FILE=".env"
        ;;
    prod)
        ENV_FILE=".env.production"
        ;;
    staging)
        ENV_FILE=".env.staging"
        ;;
esac

if [ -n "$ENV_FILE" ] && [ ! -f "$ENV_FILE" ]; then
    print_warning "No $ENV_FILE file found."
    if [ -f ".env.example" ]; then
        print_step "Creating $ENV_FILE from .env.example..."
        cp .env.example "$ENV_FILE"
        print_success "Created $ENV_FILE from .env.example"
        echo -e "${YELLOW}Please edit $ENV_FILE with your configuration before starting services${NC}"
        echo -e "${YELLOW}Press Enter to continue or Ctrl+C to exit...${NC}"
        read -r
    else
        print_warning "No .env.example file found. Continuing with system environment variables..."
    fi
else
    print_success "Environment file found: $ENV_FILE"
fi

# Create necessary data directories
print_step "Creating data directories..."
mkdir -p data/postgres data/redis data/prometheus data/grafana
print_success "Data directories created"

# Start services in correct order
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Starting Docker Services${NC}"
echo -e "${BLUE}========================================${NC}"

# Start infrastructure services first (postgres, redis)
print_step "Starting infrastructure services (postgres, redis)..."
docker compose -f "$COMPOSE_FILE" up -d postgres redis

# Wait for postgres to be healthy
print_step "Waiting for PostgreSQL to be healthy..."
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    HEALTH_STATUS=$(docker compose -f "$COMPOSE_FILE" ps --format json postgres 2>/dev/null | grep -o '"Health":"[^"]*"' | cut -d'"' -f4)
    if [ "$HEALTH_STATUS" = "healthy" ] || docker inspect --format='{{.State.Health.Status}}' $(docker compose -f "$COMPOSE_FILE" ps -q postgres 2>/dev/null) 2>/dev/null | grep -q "healthy"; then
        print_success "PostgreSQL is healthy"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    print_error "PostgreSQL did not become healthy in time"
    docker compose -f "$COMPOSE_FILE" logs postgres
    exit 1
fi

# Wait for redis to be healthy
print_step "Waiting for Redis to be healthy..."
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    HEALTH_STATUS=$(docker compose -f "$COMPOSE_FILE" ps --format json redis 2>/dev/null | grep -o '"Health":"[^"]*"' | cut -d'"' -f4)
    if [ "$HEALTH_STATUS" = "healthy" ] || docker inspect --format='{{.State.Health.Status}}' $(docker compose -f "$COMPOSE_FILE" ps -q redis 2>/dev/null) 2>/dev/null | grep -q "healthy"; then
        print_success "Redis is healthy"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    print_error "Redis did not become healthy in time"
    docker compose -f "$COMPOSE_FILE" logs redis
    exit 1
fi

# Start monitoring services if they exist in the compose file
if docker compose -f "$COMPOSE_FILE" config --services 2>/dev/null | grep -q "prometheus\|grafana"; then
    print_step "Starting monitoring services (prometheus, grafana)..."
    docker compose -f "$COMPOSE_FILE" up -d prometheus grafana 2>/dev/null || true
    print_success "Monitoring services started"
fi

# Start the main application
print_step "Starting main application (app)..."
docker compose -f "$COMPOSE_FILE" up -d app

# Wait for app to be healthy
print_step "Waiting for application to be healthy..."
MAX_RETRIES=60
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    HEALTH_STATUS=$(docker compose -f "$COMPOSE_FILE" ps --format json app 2>/dev/null | grep -o '"Health":"[^"]*"' | cut -d'"' -f4)
    if [ "$HEALTH_STATUS" = "healthy" ] || docker inspect --format='{{.State.Health.Status}}' $(docker compose -f "$COMPOSE_FILE" ps -q app 2>/dev/null) 2>/dev/null | grep -q "healthy"; then
        print_success "Application is healthy"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    print_error "Application did not become healthy in time"
    docker compose -f "$COMPOSE_FILE" logs app
    exit 1
fi

# Start proxy services if they exist in the compose file
if docker compose -f "$COMPOSE_FILE" config --services 2>/dev/null | grep -q "nginx\|traefik"; then
    print_step "Starting proxy services (nginx, traefik)..."
    docker compose -f "$COMPOSE_FILE" up -d nginx traefik 2>/dev/null || true
    print_success "Proxy services started"
fi

# Display service status
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}All services started successfully!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${BLUE}Service Status:${NC}"
docker compose -f "$COMPOSE_FILE" ps

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Service Access URLs${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Application:   ${GREEN}http://localhost:8080${NC}"
echo -e "Grafana:       ${GREEN}http://localhost:3000${NC}"
echo -e "Prometheus:    ${GREEN}http://localhost:9090${NC}"
echo -e "Traefik:       ${GREEN}http://localhost:8082${NC}"
echo -e "Nginx:         ${GREEN}http://localhost${NC}"
echo ""
echo -e "${YELLOW}To view logs, run: docker compose -f $COMPOSE_FILE logs -f${NC}"
echo -e "${YELLOW}To stop services, run: ./stop.sh $ENVIRONMENT${NC}"
echo -e "${BLUE}========================================${NC}"
