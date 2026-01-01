/**
 * @fileoverview Weaviate schema definition for ApostropheCMS documentation
 */

/**
 * Schema for the AposDocs class in Weaviate
 * This defines the structure of documents stored in the vector database
 */
export const APOS_DOCS_SCHEMA = {
  class: 'AposDocs',
  description: 'ApostropheCMS and related framework documentation',
  vectorizer: 'text2vec-openai',
  moduleConfig: {
    'text2vec-openai': {
      model: 'text-embedding-3-small',
      dimensions: 1536,
      type: 'text',
      vectorizeClassName: false
    },
    'generative-openai': {
      model: 'gpt-4o'
    }
  },
  properties: [
    {
      name: 'content',
      dataType: ['text'],
      description: 'Main content of the document',
      moduleConfig: {
        'text2vec-openai': {
          skip: false,
          vectorizePropertyName: false
        }
      }
    },
    {
      name: 'title',
      dataType: ['text'],
      description: 'Document title',
      moduleConfig: {
        'text2vec-openai': {
          skip: false,
          vectorizePropertyName: false
        }
      }
    },
    {
      name: 'url',
      dataType: ['text'],
      description: 'Source URL of the document',
      moduleConfig: {
        'text2vec-openai': {
          skip: true
        }
      }
    },
    {
      name: 'version',
      dataType: ['text'],
      description: 'ApostropheCMS version (e.g., "4.x", "3.x")',
      moduleConfig: {
        'text2vec-openai': {
          skip: true
        }
      }
    },
    {
      name: 'framework',
      dataType: ['text'],
      description: 'Primary framework (astro, vue, nunjucks, etc.)',
      moduleConfig: {
        'text2vec-openai': {
          skip: true
        }
      }
    },
    {
      name: 'docType',
      dataType: ['text'],
      description: 'Type of documentation (guide, reference, api, tutorial, migration)',
      moduleConfig: {
        'text2vec-openai': {
          skip: true
        }
      }
    },
    {
      name: 'keywords',
      dataType: ['text[]'],
      description: 'Extracted keywords for additional filtering',
      moduleConfig: {
        'text2vec-openai': {
          skip: true
        }
      }
    },
    {
      name: 'section',
      dataType: ['text'],
      description: 'Section or category within the documentation',
      moduleConfig: {
        'text2vec-openai': {
          skip: true
        }
      }
    },
    {
      name: 'lastUpdated',
      dataType: ['date'],
      description: 'Last update timestamp'
    }
  ]
};

/**
 * Create the schema in Weaviate
 * @param {import('weaviate-ts-client').WeaviateClient} client - Weaviate client instance
 * @returns {Promise<void>}
 */
export async function createSchema(client) {
  try {
    // Check if class already exists
    const exists = await client.schema
      .classGetter()
      .withClassName(APOS_DOCS_SCHEMA.class)
      .do()
      .catch(() => null);

    if (exists) {
      console.log(`Schema ${APOS_DOCS_SCHEMA.class} already exists`);
      return;
    }

    // Create the class
    await client.schema.classCreator().withClass(APOS_DOCS_SCHEMA).do();
    console.log(`Created schema: ${APOS_DOCS_SCHEMA.class}`);
  } catch (error) {
    console.error('Error creating schema:', error);
    throw error;
  }
}

/**
 * Delete the schema (useful for development/testing)
 * @param {import('weaviate-ts-client').WeaviateClient} client - Weaviate client instance
 * @returns {Promise<void>}
 */
export async function deleteSchema(client) {
  try {
    await client.schema.classDeleter().withClassName(APOS_DOCS_SCHEMA.class).do();
    console.log(`Deleted schema: ${APOS_DOCS_SCHEMA.class}`);
  } catch (error) {
    console.error('Error deleting schema:', error);
    throw error;
  }
}

/**
 * Get schema statistics
 * @param {import('weaviate-ts-client').WeaviateClient} client - Weaviate client instance
 * @returns {Promise<Object>}
 */
export async function getSchemaStats(client) {
  try {
    const result = await client.graphql
      .aggregate()
      .withClassName(APOS_DOCS_SCHEMA.class)
      .withFields('meta { count }')
      .do();

    return {
      className: APOS_DOCS_SCHEMA.class,
      count: result.data.Aggregate[APOS_DOCS_SCHEMA.class][0].meta.count
    };
  } catch (error) {
    console.error('Error getting schema stats:', error);
    throw error;
  }
}
