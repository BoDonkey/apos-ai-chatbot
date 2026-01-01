/**
 * @fileoverview Shared constants and configuration
 */

export const CONSTANTS = {
  // Intent types
  INTENT_TYPES: {
    ASTRO: 'astro',
    CORE: 'core',
    GENERAL: 'general'
  },

  // Frameworks
  FRAMEWORKS: {
    ASTRO: 'astro',
    VUE: 'vue',
    NUNJUCKS: 'nunjucks',
    EXPRESS: 'express',
    MONGODB: 'mongodb'
  },

  // Document types
  DOC_TYPES: {
    GUIDE: 'guide',
    REFERENCE: 'reference',
    API: 'api',
    TUTORIAL: 'tutorial',
    MIGRATION: 'migration'
  },

  // Confidence thresholds
  CONFIDENCE: {
    HIGH: 0.8,
    MEDIUM: 0.6,
    LOW: 0.4
  },

  // Astro-related keywords for intent detection
  ASTRO_KEYWORDS: [
    'astro',
    'component',
    'island',
    'hydration',
    'ssr',
    'static site',
    'content collections',
    'frontmatter',
    '.astro'
  ],

  // Default responses
  RESPONSES: {
    LOW_CONFIDENCE: "I'm sorry, I cannot provide a confident answer based on the available information. The specific terms you are using may not exist or not be documented. Please consider rephrasing your question or joining our Discord for additional assistance.",
    EMPTY_KNOWLEDGE_BASE: "I'm sorry, the knowledge base appears to be empty. Please contact the administrator.",
    SIMILAR_QUESTION: "It looks like you're asking a similar question to one you've already asked. This can lead to increased hallucination. Please refer to the ApostropheCMS documentation links given in the original answer or rephrase your question to be more specific.",
    OUT_OF_SCOPE: "I'm sorry, but that question appears to be outside the scope of ApostropheCMS development. I specialize in helping with ApostropheCMS, Node.js, Express, Vue, Nunjucks, and Astro integration."
  },

  // Rate limiting
  RATE_LIMIT: {
    WINDOW_MS: 60 * 1000, // 1 minute
    MAX_REQUESTS: 2
  },

  // Chunking defaults
  CHUNKING: {
    MAX_CHUNK_SIZE: 1000,
    OVERLAP: 200,
    SEPARATORS: ['\n\n', '\n', '. ', ' ', '']
  },

  // Scraping defaults
  SCRAPING: {
    MAX_DEPTH: 3,
    MAX_PAGES: 500,
    DELAY_MS: 100,
    TIMEOUT_MS: 30000
  }
};

/**
 * Get environment variable or throw error if missing
 * @param {string} name - Environment variable name
 * @param {string} [defaultValue] - Optional default value
 * @returns {string}
 * @throws {Error} If variable is missing and no default provided
 */
export function requireEnv(name, defaultValue) {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Get environment variable as boolean
 * @param {string} name - Environment variable name
 * @param {boolean} [defaultValue=false] - Default value
 * @returns {boolean}
 */
export function getBoolEnv(name, defaultValue = false) {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Get environment variable as number
 * @param {string} name - Environment variable name
 * @param {number} [defaultValue] - Default value
 * @returns {number}
 */
export function getNumberEnv(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(`Environment variable ${name} must be a number, got: ${value}`);
  }
  return num;
}
