# ApostropheCMS AI Chatbot

A production-ready AI chatbot system for ApostropheCMS documentation, built with Weaviate vector database, LangChain, and Socket.IO. Features intelligent intent detection with special focus on Astro integration.

## 🏗️ Architecture

This is a monorepo with three main packages:

- **`@apos-chatbot/shared`** - Common types, utilities, and configurations
- **`@apos-chatbot/ingestion`** - Web scraping and document ingestion pipeline
- **`@apos-chatbot/server`** - Query server with REST API and Socket.IO

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm 8+
- Docker and Docker Compose
- OpenAI API key (required)
- Anthropic API key (optional)

### Installation

1. **Clone and install dependencies:**

```bash
git clone <your-repo-url>
cd apos-ai-chatbot
pnpm install
```

2. **Set up environment variables:**

```bash
cp .env.example .env
# Edit .env with your API keys
```

3. **Start infrastructure (Weaviate + MongoDB):**

```bash
pnpm docker:up
```

Wait for services to be healthy:
```bash
pnpm docker:logs
```

4. **Run the ingestion pipeline:**

```bash
# Scrape and ingest ApostropheCMS docs
pnpm ingest

# Or clear existing data first
pnpm ingest -- --clear

# Include Astro docs (optional)
pnpm ingest -- --include-astro
```

5. **Start the server:**

```bash
pnpm start
```

The server will be available at `http://localhost:3000`

## 📦 Package Details

### Shared Package

Contains all type definitions (JSDoc), constants, logger, and Weaviate schema.

**Key files:**
- `src/types.js` - JSDoc type definitions
- `src/constants.js` - Application constants
- `src/weaviate-schema.js` - Weaviate schema definition
- `src/logger.js` - Logging utility

### Ingestion Package

Handles web scraping and data ingestion.

**Scripts:**
```bash
# Full ingestion pipeline
pnpm --filter @apos-chatbot/ingestion start

# Clear existing data and re-ingest
pnpm ingest -- --clear

# Include Astro documentation
pnpm ingest -- --include-astro
```

**Key components:**
- Playwright-based web scraper
- Markdown conversion with Turndown
- Smart chunking with overlap
- Metadata extraction (framework, version, doc type)
- Batch import to Weaviate

### Server Package

REST API and Socket.IO server for query handling.

**Scripts:**
```bash
# Production mode
pnpm start

# Development mode (auto-reload)
pnpm dev:server
```

**Features:**
- Intent detection (Astro vs. Core vs. General)
- LangChain conversational RAG
- MongoDB conversation logging
- Rate limiting (2 requests/minute)
- Slack integration (optional)
- Export conversations to CSV

## 🔧 Configuration

### Environment Variables

See `.env.example` for all available options. Key variables:

```bash
# Required
OPENAI_API_KEY=your-key-here
WEAVIATE_URL=http://localhost:8080
APOS_MONGODB_URI=mongodb://localhost:27017

# Model Selection
CHAT_MODEL=ChatOpenAI  # or ChatAnthropic

# Server
PORT=3000

# Ingestion
DOCS_BASE_URL=https://docs.apostrophecms.org
ASTRO_DOCS_URL=https://docs.astro.build/en/getting-started/
```

### Weaviate Schema

The schema supports:
- Content and title (vectorized)
- URL, version, framework, docType (metadata)
- Keywords for filtering
- Section hierarchy

See `packages/shared/src/weaviate-schema.js` for details.

## 🎯 Intent Detection

The system automatically detects query intent:

- **Astro Intent**: Queries about Astro integration, components, islands, etc.
- **Core Intent**: General ApostropheCMS questions
- **General Intent**: Out of scope queries

Astro-related queries automatically prioritize Astro documentation in results.

## 📝 API Endpoints

### Health Check
```
GET /
```

### Export Conversations
```
GET /export_conversations?password=your-password
```

Returns CSV of all logged conversations.

### Socket.IO Events

**Client → Server:**
- `query` - Send a query
  ```javascript
  socket.emit('query', { 
    query: 'How do I create an Astro component?',
    index: 0 
  });
  ```

**Server → Client:**
- `session_id` - Session identifier
- `answer` - Query response
- `error` - Error message

## 🧪 Development

### Adding New Scrapers

1. Create scraper in `packages/ingestion/src/scrapers/`
2. Follow the pattern in `playwright-scraper.js`
3. Add to main pipeline in `packages/ingestion/src/index.js`

### Modifying the Schema

1. Update `packages/shared/src/weaviate-schema.js`
2. Delete and recreate the schema:
   ```bash
   npm run ingest -- --clear
   ```

### Testing

```bash
# Test Weaviate connection
curl http://localhost:8080/v1/.well-known/ready

# Test MongoDB connection
curl http://localhost:27017

# Test chatbot server
curl http://localhost:3000
```

## 📊 Monitoring

View logs:
```bash
# All services
npm run docker:logs

# Specific service
docker logs apos-weaviate -f
docker logs apos-mongodb -f
```

Check document count:
```bash
# The ingestion script reports this after completion
npm run ingest
```

## 🔄 Re-indexing

To completely re-index your documentation:

```bash
# Stop server
# Clear and re-ingest
pnpm ingest -- --clear --include-astro
# Restart server
pnpm start
```

## 🐛 Troubleshooting

**Weaviate connection failed:**
- Ensure Docker containers are running: `docker ps`
- Check logs: `docker logs apos-weaviate`
- Verify URL in `.env` matches container

**No search results:**
- Verify documents were ingested: Check ingestion logs
- Try re-indexing with `--clear` flag

**Rate limit errors:**
- Adjust `RATE_LIMIT_MAX_REQUESTS` in `.env`
- Increase `RATE_LIMIT_WINDOW_MS`

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please follow the existing code style and add tests for new features.
