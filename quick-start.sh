#!/bin/bash

# Quick Start Script for ApostropheCMS AI Chatbot
# This script helps you get the project running quickly

set -e

echo "🚀 ApostropheCMS AI Chatbot - Quick Start"
echo "=========================================="
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check for pnpm
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed."
    echo ""
    echo "Install pnpm with:"
    echo "  npm install -g pnpm"
    echo "  or visit: https://pnpm.io/installation"
    exit 1
fi

echo "✅ pnpm $(pnpm -v) detected"

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker detected"
echo ""

# Check for .env file
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo ""
    echo "📝 Please edit .env and add your API keys:"
    echo "   - OPENAI_API_KEY (required)"
    echo "   - ANTHROPIC_API_KEY (optional)"
    echo ""
    read -p "Press Enter after you've updated .env..."
fi

# Verify OpenAI API key is set
if ! grep -q "OPENAI_API_KEY=.*[a-zA-Z0-9]" .env; then
    echo "❌ OPENAI_API_KEY is not set in .env file"
    echo "   Please add your OpenAI API key to .env"
    exit 1
fi

echo "✅ Environment variables configured"
echo ""

# Install dependencies
echo "📦 Installing dependencies with pnpm..."
pnpm install

echo ""
echo "✅ Dependencies installed"
echo ""

# Start Docker services
echo "🐳 Starting Docker services (Weaviate + MongoDB)..."
pnpm docker:up

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check Weaviate health
WEAVIATE_READY=false
for i in {1..30}; do
    if curl -s http://localhost:8080/v1/.well-known/ready > /dev/null 2>&1; then
        WEAVIATE_READY=true
        break
    fi
    echo "   Waiting for Weaviate... ($i/30)"
    sleep 2
done

if [ "$WEAVIATE_READY" = false ]; then
    echo "❌ Weaviate failed to start. Check logs with: docker logs apos-weaviate"
    exit 1
fi

echo "✅ Weaviate is ready"

# Check MongoDB health
MONGO_READY=false
for i in {1..30}; do
    if docker exec apos-mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        MONGO_READY=true
        break
    fi
    echo "   Waiting for MongoDB... ($i/30)"
    sleep 2
done

if [ "$MONGO_READY" = false ]; then
    echo "❌ MongoDB failed to start. Check logs with: docker logs apos-mongodb"
    exit 1
fi

echo "✅ MongoDB is ready"
echo ""

# Ask if user wants to run ingestion now
read -p "📥 Run ingestion pipeline now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🔄 Starting ingestion pipeline..."
    echo "   This may take 5-10 minutes depending on your connection..."
    echo ""
    
    pnpm ingest
    
    echo ""
    echo "✅ Ingestion complete!"
fi

echo ""
echo "=========================================="
echo "✨ Setup complete!"
echo ""
echo "To start the server:"
echo "   pnpm start"
echo ""
echo "To run ingestion again:"
echo "   pnpm ingest"
echo ""
echo "To clear and re-ingest:"
echo "   pnpm ingest -- --clear"
echo ""
echo "To stop Docker services:"
echo "   pnpm docker:down"
echo ""
echo "Server will run on: http://localhost:3000"
echo "=========================================="
