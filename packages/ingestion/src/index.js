/**
 * @fileoverview Main ingestion pipeline
 */

import dotenv from 'dotenv';
import { requireEnv, createLogger } from '@apos-chatbot/shared';
import { weaviateClient } from './weaviate/client.js';
import { scrapeDocumentation } from './scrapers/playwright-scraper.js';
import { processScrapedPages } from './processors/chunk-processor.js';

dotenv.config();

const logger = createLogger('Ingestion');

/**
 * Main ingestion pipeline
 */
async function main() {
  try {
    logger.info('Starting ingestion pipeline');

    // Initialize Weaviate
    const weaviateUrl = requireEnv('WEAVIATE_URL');
    const weaviateApiKey = process.env.WEAVIATE_API_KEY;

    await weaviateClient.initialize(weaviateUrl, weaviateApiKey);

    // Check current document count
    const currentCount = await weaviateClient.getCount();
    logger.info(`Current document count: ${currentCount}`);

    // Optionally clear existing data
    const shouldClear = process.argv.includes('--clear');
    if (shouldClear) {
      logger.warn('Clearing existing documents');
      await weaviateClient.deleteAll();
    }

    // Scrape ApostropheCMS docs
    logger.info('Scraping ApostropheCMS documentation');
    const aposPages = await scrapeDocumentation({
      baseUrl: requireEnv('DOCS_BASE_URL', 'https://apostrophecms.com/docs'),
      maxDepth: 3,
      maxPages: 500,
      allowedDomains: [
        'apostrophecms.com/docs',
        'docs.apostrophecms.org'
      ],
      excludePatterns: [
        '/search',
        '/api-examples',
        '/markdown-examples',
        '/404'],
      delayMs: 100
    });

    logger.info(`Scraped ${aposPages.length} ApostropheCMS pages`);

    // Process and chunk pages
    const aposDocuments = processScrapedPages(aposPages, {
      maxChunkSize: 1000,
      overlap: 200
    });

    // Import to Weaviate
    logger.info('Importing documents to Weaviate');
    await weaviateClient.batchImport(aposDocuments);

    // Optional: Scrape Astro docs if configured
    const astroDocsUrl = process.env.ASTRO_DOCS_URL;
    if (astroDocsUrl && process.argv.includes('--include-astro')) {
      logger.info('Scraping Astro documentation');
      const astroPages = await scrapeDocumentation({
        baseUrl: astroDocsUrl,
        maxDepth: 2,
        maxPages: 200,
        allowedDomains: ['docs.astro.build'],
        excludePatterns: ['/search', '/old/'],
        delayMs: 200
      });

      logger.info(`Scraped ${astroPages.length} Astro pages`);

      const astroDocuments = processScrapedPages(astroPages, {
        maxChunkSize: 1000,
        overlap: 200
      });

      await weaviateClient.batchImport(astroDocuments);
    }

    // Final statistics
    const finalCount = await weaviateClient.getCount();
    logger.info(`Ingestion complete. Total documents: ${finalCount}`);
    logger.info(`New documents added: ${finalCount - currentCount}`);

  } catch (error) {
    logger.error('Ingestion pipeline failed', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };
