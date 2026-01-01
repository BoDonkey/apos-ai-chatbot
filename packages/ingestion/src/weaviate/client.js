/**
 * @fileoverview Weaviate client singleton for ingestion
 */

import weaviate from 'weaviate-ts-client';
import { createLogger } from '@apos-chatbot/shared';
import { createSchema, APOS_DOCS_SCHEMA } from '@apos-chatbot/shared';

const logger = createLogger('WeaviateClient');

/**
 * Weaviate client singleton
 */
class WeaviateClient {
  constructor() {
    /** @type {import('weaviate-ts-client').WeaviateClient|null} */
    this.client = null;
    this.initialized = false;
  }

  /**
   * Initialize the Weaviate client
   * @param {string} url - Weaviate instance URL
   * @param {string} [apiKey] - Optional API key
   * @returns {Promise<void>}
   */
  async initialize(url, apiKey) {
    if (this.initialized) {
      logger.debug('Client already initialized');
      return;
    }

    try {
      const clientConfig = {
        scheme: url.startsWith('https') ? 'https' : 'http',
        host: url.replace(/^https?:\/\//, ''),
      };

      if (apiKey) {
        clientConfig.apiKey = new weaviate.ApiKey(apiKey);
      }

      this.client = weaviate.client(clientConfig);

      // Test connection
      const meta = await this.client.misc.metaGetter().do();
      logger.info('Connected to Weaviate', { version: meta.version });

      // Ensure schema exists
      await createSchema(this.client);
      
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize Weaviate client', error);
      throw error;
    }
  }

  /**
   * Get the client instance
   * @returns {import('weaviate-ts-client').WeaviateClient}
   * @throws {Error} If client not initialized
   */
  getClient() {
    if (!this.client) {
      throw new Error('Weaviate client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  /**
   * Batch import documents
   * @param {import('@apos-chatbot/shared').WeaviateDocument[]} documents
   * @returns {Promise<void>}
   */
  async batchImport(documents) {
    const client = this.getClient();
    
    logger.info(`Starting batch import of ${documents.length} documents`);
    
    try {
      let batcher = client.batch.objectsBatcher();
      
      for (const doc of documents) {
        batcher = batcher.withObject({
          class: APOS_DOCS_SCHEMA.class,
          properties: {
            content: doc.content,
            title: doc.title,
            url: doc.url,
            version: doc.version || '4.x',
            framework: doc.framework || 'core',
            docType: doc.docType,
            keywords: doc.keywords || [],
            section: doc.metadata?.section || '',
            lastUpdated: new Date().toISOString()
          }
        });
      }

      const result = await batcher.do();
      
      // Check for errors
      const errors = result.filter(r => r.result?.errors);
      if (errors.length > 0) {
        logger.error(`Batch import had ${errors.length} errors`, errors);
      } else {
        logger.info(`Successfully imported ${documents.length} documents`);
      }
    } catch (error) {
      logger.error('Batch import failed', error);
      throw error;
    }
  }

  /**
   * Delete all documents (useful for re-indexing)
   * @returns {Promise<void>}
   */
  async deleteAll() {
    const client = this.getClient();
    
    logger.warn('Deleting all documents from Weaviate');
    
    try {
      await client.batch
        .objectsBatchDeleter()
        .withClassName(APOS_DOCS_SCHEMA.class)
        .withWhere({
          operator: 'NotEqual',
          path: ['url'],
          valueText: 'non-existent-url-to-match-all'
        })
        .do();
      
      logger.info('All documents deleted');
    } catch (error) {
      logger.error('Failed to delete documents', error);
      throw error;
    }
  }

  /**
   * Get document count
   * @returns {Promise<number>}
   */
  async getCount() {
    const client = this.getClient();
    
    try {
      const result = await client.graphql
        .aggregate()
        .withClassName(APOS_DOCS_SCHEMA.class)
        .withFields('meta { count }')
        .do();
      
      return result.data.Aggregate[APOS_DOCS_SCHEMA.class][0].meta.count;
    } catch (error) {
      logger.error('Failed to get document count', error);
      return 0;
    }
  }

  /**
   * Health check
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const client = this.getClient();
      await client.misc.metaGetter().do();
      return true;
    } catch (error) {
      logger.error('Health check failed', error);
      return false;
    }
  }
}

// Export singleton instance
export const weaviateClient = new WeaviateClient();
