# Getting Started Guide

## What We've Built

A complete JavaScript + JSDoc monorepo for your ApostropheCMS AI chatbot with:

1. **Scraping Pipeline** - Playwright-based web scraper
2. **Weaviate Integration** - Vector database for semantic search
3. **Intent Detection** - Astro-aware query classification
4. **LangChain RAG** - Conversational query handling
5. **Production Server** - Socket.IO + REST API
6. **MongoDB Logging** - Conversation tracking

## Project Structure

```
apos-ai-chatbot/
├── packages/
│   ├── shared/              # Common code
│   │   ├── src/
│   │   │   ├── types.js           # JSDoc type definitions
│   │   │   ├── constants.js       # App constants
│   │   │   ├── logger.js          # Logging utility
│   │   │   └── weaviate-schema.js # Vector DB schema
│   │   └── package.json
│   │
│   ├── ingestion/           # Scraping & ingestion
│   │   ├── src/
│   │   │   ├── scrapers/
│   │   │   │   └── playwright-scraper.js
│   │   │   ├── processors/
│   │   │   │   └── chunk-processor.js
│   │   │   ├── weaviate/
│   │   │   │   └── client.js
│   │   │   └── index.js           # Main pipeline
│   │   └── package.json
│   │
│   └── server/              # Query server
│       ├── src/
│       │   ├── query/
│       │   │   ├── handler.js          # LangChain RAG
│       │   │   └── intent-detector.js  # Astro detection
│       │   └── index.js                # Express + Socket.IO
│       └── package.json
│
├── docker-compose.yml       # Weaviate + MongoDB
├── .env.example            # Environment template
├── package.json            # Workspace root
├── jsconfig.json           # VSCode type checking
├── quick-start.sh          # Setup script
└── README.md               # Documentation
```

## Quick Start (Automated)

The easiest way to get started:

```bash
./quick-start.sh
```

This script will:
- ✅ Check prerequisites (Node.js, Docker)
- ✅ Install dependencies
- ✅ Start Docker services
- ✅ Wait for services to be ready
- ✅ Optionally run ingestion
- ✅ Guide you through next steps

## Manual Setup

If you prefer manual control:

### 1. Environment Setup

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:
```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...  # Optional
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Start Infrastructure

```bash
pnpm docker:up
```

Wait for services:
```bash
# Check Weaviate
curl http://localhost:8080/v1/.well-known/ready

# Check MongoDB
docker exec apos-mongodb mongosh --eval "db.adminCommand('ping')"
```

### 4. Run Ingestion

```bash
# Basic ingestion
pnpm ingest

# Clear existing data first
pnpm ingest -- --clear

# Include Astro docs
pnpm ingest -- --include-astro
```

### 5. Start Server

```bash
pnpm start
```

Server runs at `http://localhost:3000`

## Development Workflow

### Working on Ingestion

```bash
# Watch mode
pnpm dev:ingest

# Test scraper changes
pnpm ingest -- --clear
```

### Working on Server

```bash
# Auto-reload on changes
pnpm dev:server

# Test endpoints
curl http://localhost:3000
curl http://localhost:3000/health
```

### Viewing Logs

```bash
# All services
pnpm docker:logs

# Specific service
docker logs apos-weaviate -f
docker logs apos-mongodb -f
```

## Key Features Explained

### JSDoc Types

All major interfaces are typed with JSDoc in `packages/shared/src/types.js`:

```javascript
/**
 * @typedef {Object} QueryIntent
 * @property {'astro' | 'core' | 'general'} type
 * @property {number} confidence
 * @property {string[]} frameworks
 */

/**
 * Detect intent from query
 * @param {string} query
 * @returns {QueryIntent}
 */
function detectIntent(query) {
  // VS Code gives you autocomplete here!
}
```

You get autocomplete and type checking without TypeScript overhead.

### Intent Detection

The system automatically detects Astro-related queries:

```javascript
// In: "How do I create an Astro component with ApostropheCMS?"
// Out: { type: 'astro', confidence: 0.85, frameworks: ['astro'] }

// This triggers:
// - Prioritize Astro docs in search
// - Filter by framework: 'astro'
// - Higher relevance scoring
```

### Weaviate Schema

Documents are stored with rich metadata:

```javascript
{
  content: "...",        // Vectorized
  title: "...",         // Vectorized
  url: "...",
  version: "4.x",       // Filter by version
  framework: "astro",   // Filter by framework
  docType: "guide",     // guide|reference|api|tutorial
  keywords: [...],      // Additional filtering
  section: "..."        // Document hierarchy
}
```

### Chunking Strategy

Smart text chunking with overlap:

```javascript
// Default: 1000 chars per chunk, 200 char overlap
// Recursive splitting using: \n\n → \n → . → space
// Preserves context across chunk boundaries
```

## Common Tasks

### Add a New Documentation Source

1. Edit `packages/ingestion/src/index.js`
2. Add new scraper call:

```javascript
const newPages = await scrapeDocumentation({
  baseUrl: 'https://docs.example.com',
  maxDepth: 2,
  maxPages: 100,
  allowedDomains: ['docs.example.com']
});

const newDocs = processScrapedPages(newPages);
await weaviateClient.batchImport(newDocs);
```

### Modify the System Prompt

Edit `packages/server/src/query/handler.js`:

```javascript
const systemPrompt = `You are a senior developer...`;
```

### Change Confidence Thresholds

Edit `packages/shared/src/constants.js`:

```javascript
CONFIDENCE: {
  HIGH: 0.8,   // Adjust these
  MEDIUM: 0.6,
  LOW: 0.4
}
```

### Add New Intent Types

1. Update types in `packages/shared/src/types.js`
2. Update detection logic in `packages/server/src/query/intent-detector.js`
3. Add filter logic in `packages/server/src/query/handler.js`

## Testing

### Test Scraper

```javascript
// packages/ingestion/test-scraper.js
import { scrapeDocumentation } from './src/scrapers/playwright-scraper.js';

const pages = await scrapeDocumentation({
  baseUrl: 'https://docs.apostrophecms.org',
  maxPages: 5
});

console.log(pages);
```

Run: `node packages/ingestion/test-scraper.js`

### Test Intent Detection

```javascript
// packages/server/test-intent.js
import { detectIntent } from './src/query/intent-detector.js';

const intent = detectIntent('How do I use Astro components?');
console.log(intent);
```

Run: `node packages/server/test-intent.js`

### Test Weaviate Connection

```bash
curl http://localhost:8080/v1/.well-known/ready
```

## Next Steps

1. **Run the ingestion** - Populate Weaviate with docs
2. **Test queries** - Connect via Socket.IO client
3. **Add Discord bot** - Extend server with Discord.js
4. **Monitor performance** - Add metrics and logging
5. **Deploy** - Use Docker Compose in production

## Troubleshooting

**Import errors:**
```bash
# Make sure you're using Node 18+ with ESM support
node --version
```

**Weaviate connection failed:**
```bash
# Check Docker
docker ps
docker logs apos-weaviate
```

**No autocomplete in VS Code:**
```bash
# Make sure jsconfig.json is present
# Reload VS Code window: Cmd/Ctrl + Shift + P → "Reload Window"
```

**Type checking not working:**
Enable in VS Code settings:
```json
{
  "js/ts.implicitProjectConfig.checkJs": true
}
```

## Resources

- JSDoc: https://jsdoc.app/
- Weaviate: https://weaviate.io/developers/weaviate
- LangChain: https://js.langchain.com/
- Playwright: https://playwright.dev/

## Need Help?

Check the main README.md for detailed API documentation and architecture details.
