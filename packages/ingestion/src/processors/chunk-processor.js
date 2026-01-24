/**
 * @fileoverview Text chunking utilities for processing scraped content
 */

import { CONSTANTS, createLogger } from '@apos-chatbot/shared';

const logger = createLogger('ChunkProcessor');

/**
 * Split text into chunks with overlap
 * @param {string} text - Text to chunk
 * @param {import('@apos-chatbot/shared').ChunkConfig} config - Chunking configuration
 * @returns {import('@apos-chatbot/shared').TextChunk[]}
 */
export function chunkText(text, config = {}) {
  const {
    maxChunkSize = CONSTANTS.CHUNKING.MAX_CHUNK_SIZE,
    overlap = CONSTANTS.CHUNKING.OVERLAP,
    separators = CONSTANTS.CHUNKING.SEPARATORS
  } = config;

  /** @type {import('@apos-chatbot/shared').TextChunk[]} */
  const chunks = [];

  // If text is shorter than max chunk size, return as single chunk
  if (text.length <= maxChunkSize) {
    return [{
      content: text,
      metadata: {
        source: '',
        chunkIndex: 0,
        totalChunks: 1
      }
    }];
  }

  // Split recursively using separators
  const splits = recursiveSplit(text, separators, maxChunkSize);

  // Create chunks with overlap
  for (let i = 0; i < splits.length; i++) {
    let chunkContent = splits[i];

    // Add overlap from previous chunk if not first chunk
    if (i > 0 && overlap > 0) {
      const prevChunk = splits[i - 1];
      const overlapText = prevChunk.slice(-overlap);
      chunkContent = overlapText + ' ' + chunkContent;
    }

    chunks.push({
      content: chunkContent.trim(),
      metadata: {
        source: '',
        chunkIndex: i,
        totalChunks: splits.length
      }
    });
  }

  return chunks;
}

/**
 * Recursively split text using separators
 * @param {string} text
 * @param {string[]} separators
 * @param {number} maxSize
 * @returns {string[]}
 */
function recursiveSplit(text, separators, maxSize) {
  if (text.length <= maxSize) {
    return [text];
  }

  const [separator, ...remainingSeparators] = separators;

  if (!separator) {
    // No more separators, force split
    return forceSplit(text, maxSize);
  }

  const parts = text.split(separator);
  const result = [];
  let currentChunk = '';

  for (const part of parts) {
    if (currentChunk.length + part.length + separator.length <= maxSize) {
      currentChunk += (currentChunk ? separator : '') + part;
    } else {
      if (currentChunk) {
        result.push(currentChunk);
      }

      // If part is too large, recursively split with next separator
      if (part.length > maxSize) {
        result.push(...recursiveSplit(part, remainingSeparators, maxSize));
        currentChunk = '';
      } else {
        currentChunk = part;
      }
    }
  }

  if (currentChunk) {
    result.push(currentChunk);
  }

  return result;
}

/**
 * Force split text when no suitable separator found
 * @param {string} text
 * @param {number} maxSize
 * @returns {string[]}
 */
function forceSplit(text, maxSize) {
  const chunks = [];
  for (let i = 0; i < text.length; i += maxSize) {
    chunks.push(text.slice(i, i + maxSize));
  }
  return chunks;
}

/**
 * Process scraped pages into chunks suitable for Weaviate
 * @param {import('@apos-chatbot/shared').ScrapedPage[]} pages
 * @param {import('@apos-chatbot/shared').ChunkConfig} [chunkConfig]
 * @returns {import('@apos-chatbot/shared').WeaviateDocument[]}
 */
export function processScrapedPages(pages, chunkConfig) {
  logger.info(`Processing ${pages.length} pages into chunks`);

  /** @type {import('@apos-chatbot/shared').WeaviateDocument[]} */
  const documents = [];

  for (const page of pages) {
    // Extract metadata from URL and content
    const metadata = extractMetadata(page);

    // Chunk the content
    const chunks = chunkText(page.content, chunkConfig);

    // Create documents from chunks
    for (const chunk of chunks) {
      documents.push({
        content: chunk.content,
        title: page.title,
        url: page.url,
        version: metadata.version,
        framework: metadata.framework,
        docType: metadata.docType,
        keywords: metadata.keywords,
        metadata: {
          section: chunk.metadata.section || metadata.section,
          chunkIndex: chunk.metadata.chunkIndex,
          totalChunks: chunk.metadata.totalChunks,
          ...page.metadata
        }
      });
    }
  }

  logger.info(`Created ${documents.length} document chunks from ${pages.length} pages`);
  return documents;
}

/**
 * Extract metadata from page URL and content
 * @param {import('@apos-chatbot/shared').ScrapedPage} page
 * @returns {Object}
 */
function extractMetadata(page) {
  const url = page.url.toLowerCase();
  const content = page.content.toLowerCase();

  // Detect version
  let version = '4.x'; // Default to latest
  if (url.includes('/v3/') || url.includes('/3.x/')) {
    version = '3.x';
  }

  // Detect framework
  let framework = 'core';
  if (url.includes('astro') || content.includes('astro')) {
    framework = 'astro';
  } else if (url.includes('vue') || content.includes('vue')) {
    framework = 'vue';
  } else if (url.includes('nunjucks')) {
    framework = 'nunjucks';
  }

  // Detect doc type
  let docType = 'guide';
  if (url.includes('/reference/') || url.includes('/api/')) {
    docType = 'reference';
  } else if (url.includes('/tutorial/')) {
    docType = 'tutorial';
  } else if (url.includes('/migration/')) {
    docType = 'migration';
  }

  // Extract keywords from headings
  const keywords = page.metadata.headings
    .filter(h => h.length > 0)
    .map(h => h.toLowerCase())
    .slice(0, 10); // Limit to top 10

  // Extract section from first heading
  const section = page.metadata.headings[0] || '';

  return {
    version,
    framework,
    docType,
    keywords,
    section
  };
}
