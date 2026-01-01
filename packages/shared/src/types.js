/**
 * @fileoverview Type definitions for ApostropheCMS AI Chatbot
 * These JSDoc types provide autocomplete and type checking without TypeScript overhead
 */

/**
 * @typedef {'astro' | 'core' | 'general'} IntentType
 * The type of user intent detected from their query
 */

/**
 * @typedef {'astro' | 'vue' | 'nunjucks' | 'express' | 'mongodb'} Framework
 * Supported frameworks in ApostropheCMS ecosystem
 */

/**
 * @typedef {'guide' | 'reference' | 'api' | 'tutorial' | 'migration'} DocType
 * Type of documentation content
 */

/**
 * @typedef {'web' | 'discord'} QuerySource
 * Source of the user query
 */

/**
 * User's detected intent from their query
 * @typedef {Object} QueryIntent
 * @property {IntentType} type - Primary intent category
 * @property {number} confidence - Confidence score (0-1)
 * @property {Framework[]} frameworks - Relevant frameworks detected
 * @property {Object} [suggestedFilters] - Suggested search filters
 * @property {string} [suggestedFilters.version] - ApostropheCMS version filter
 * @property {DocType} [suggestedFilters.docType] - Document type filter
 * @property {boolean} [suggestedFilters.prioritizeAstro] - Whether to prioritize Astro content
 */

/**
 * Context for processing a user query
 * @typedef {Object} QueryContext
 * @property {string} sessionId - Unique session identifier
 * @property {QuerySource} source - Where the query originated
 * @property {ConversationMessage[]} [conversationHistory] - Previous messages in conversation
 * @property {Object} [metadata] - Additional context metadata
 * @property {string} [metadata.discordUserId] - Discord user ID if applicable
 * @property {string} [metadata.discordChannelId] - Discord channel ID if applicable
 */

/**
 * A message in a conversation
 * @typedef {Object} ConversationMessage
 * @property {'user' | 'assistant' | 'system'} role - Message role
 * @property {string} content - Message content
 * @property {number} timestamp - Unix timestamp
 */

/**
 * Document stored in Weaviate
 * @typedef {Object} WeaviateDocument
 * @property {string} content - Main text content
 * @property {string} url - Source URL
 * @property {string} title - Document title
 * @property {string} [version] - ApostropheCMS version (e.g., "4.x", "3.x")
 * @property {Framework} [framework] - Primary framework
 * @property {DocType} docType - Type of documentation
 * @property {string[]} [keywords] - Extracted keywords
 * @property {Object} [metadata] - Additional metadata
 */

/**
 * Result from Weaviate search
 * @typedef {Object} WeaviateSearchResult
 * @property {string} content - Document content
 * @property {string} url - Document URL
 * @property {string} title - Document title
 * @property {number} distance - Vector distance (lower is better)
 * @property {number} certainty - Certainty score (0-1, higher is better)
 * @property {Object} [metadata] - Additional metadata from document
 */

/**
 * Response from the chatbot
 * @typedef {Object} ChatbotResponse
 * @property {string} answer - The formatted answer
 * @property {WeaviateSearchResult[]} sources - Source documents used
 * @property {QueryIntent} intent - Detected intent
 * @property {number} confidence - Overall confidence in the answer
 * @property {Object} [metadata] - Response metadata
 * @property {string} [metadata.model] - Model used for generation
 * @property {number} [metadata.processingTime] - Time taken to generate response
 */

/**
 * Scraped web page data
 * @typedef {Object} ScrapedPage
 * @property {string} url - Page URL
 * @property {string} title - Page title
 * @property {string} content - Main content (markdown or HTML)
 * @property {string[]} links - Extracted links
 * @property {Object} metadata - Page metadata
 * @property {string} [metadata.description] - Meta description
 * @property {string[]} [metadata.headings] - Extracted headings
 * @property {Array<{url: string, text: string}>} [metadata.internalLinks] - Links to other docs
 * @property {Array<{url: string, text: string}>} [metadata.externalLinks] - Links to external sources
 * @property {Date} metadata.scrapedAt - When the page was scraped
 */

/**
 * Chunk of text for ingestion
 * @typedef {Object} TextChunk
 * @property {string} content - Chunk content
 * @property {Object} metadata - Chunk metadata
 * @property {string} metadata.source - Source URL or file
 * @property {number} metadata.chunkIndex - Index of this chunk
 * @property {number} metadata.totalChunks - Total chunks from source
 * @property {string} [metadata.section] - Section/heading this chunk falls under
 */

/**
 * Configuration for scraping
 * @typedef {Object} ScraperConfig
 * @property {string} baseUrl - Base URL to start scraping
 * @property {string} [sitemapUrl]
 * @property {number} [maxDepth] - Maximum link depth to follow
 * @property {number} [maxPages] - Maximum pages to scrape
 * @property {string[]} [allowedDomains] - Domains allowed for scraping
 * @property {string[]} [excludePatterns] - URL patterns to exclude
 * @property {number} [delayMs] - Delay between requests
 * @property {boolean} [respectRobotsTxt] - Whether to respect robots.txt
 */

/**
 * Configuration for chunking strategy
 * @typedef {Object} ChunkConfig
 * @property {number} maxChunkSize - Maximum characters per chunk
 * @property {number} overlap - Overlap between chunks in characters
 * @property {string[]} [separators] - Separators for splitting (in priority order)
 */

/**
 * Weaviate client configuration
 * @typedef {Object} WeaviateConfig
 * @property {string} url - Weaviate instance URL
 * @property {string} [apiKey] - API key if authentication enabled
 * @property {string} className - Name of the class/collection
 */

/**
 * MongoDB conversation log entry
 * @typedef {Object} ConversationLog
 * @property {string} sessionId - Session identifier
 * @property {string} query - User's query
 * @property {string} answer - Bot's answer
 * @property {string} model - Model used
 * @property {Date} timestamp - When the exchange occurred
 * @property {QuerySource} source - Where query originated
 * @property {Object} [metadata] - Additional metadata
 */

export {};
