/**
 * @fileoverview Intent detection for user queries
 * Detects whether a query is about Astro, core ApostropheCMS, or general
 */

import { CONSTANTS, createLogger } from '@apos-chatbot/shared';

const logger = createLogger('IntentDetector');

/**
 * Detect user intent from query text
 * @param {string} query - User's query
 * @returns {import('@apos-chatbot/shared').QueryIntent}
 */
export function detectIntent(query) {
  const lowerQuery = query.toLowerCase();
  
  // Check for Astro-specific keywords
  const astroKeywords = CONSTANTS.ASTRO_KEYWORDS;
  const astroMatches = astroKeywords.filter(keyword => 
    lowerQuery.includes(keyword.toLowerCase())
  );
  
  // Check for framework mentions
  /** @type {import('@apos-chatbot/shared').Framework[]} */
  const frameworks = [];
  
  if (astroMatches.length > 0 || lowerQuery.includes('astro')) {
    frameworks.push('astro');
  }
  if (lowerQuery.includes('vue')) {
    frameworks.push('vue');
  }
  if (lowerQuery.includes('nunjucks')) {
    frameworks.push('nunjucks');
  }
  
  // Determine primary intent type
  let type = 'general';
  let confidence = 0.5;
  
  if (astroMatches.length > 0) {
    type = 'astro';
    confidence = Math.min(0.95, 0.7 + (astroMatches.length * 0.1));
  } else if (frameworks.length > 0) {
    type = 'core';
    confidence = 0.75;
  } else {
    // Check for ApostropheCMS-specific terms
    const aposTerms = [
      'apostrophe',
      'apos',
      'widget',
      'piece',
      'page type',
      'module',
      'schema',
      'area'
    ];
    
    const aposMatches = aposTerms.filter(term => 
      lowerQuery.includes(term)
    );
    
    if (aposMatches.length > 0) {
      type = 'core';
      confidence = 0.7;
    }
  }
  
  // Suggest filters based on intent
  const suggestedFilters = {
    prioritizeAstro: type === 'astro'
  };
  
  // Detect version mentions
  if (lowerQuery.includes('version 3') || lowerQuery.includes('v3')) {
    suggestedFilters.version = '3.x';
  }
  
  // Detect doc type
  if (lowerQuery.includes('tutorial') || lowerQuery.includes('how to')) {
    suggestedFilters.docType = 'tutorial';
  } else if (lowerQuery.includes('reference') || lowerQuery.includes('api')) {
    suggestedFilters.docType = 'reference';
  }
  
  logger.debug('Intent detected', {
    query: query.substring(0, 50),
    type,
    confidence,
    frameworks
  });
  
  return {
    type,
    confidence,
    frameworks,
    suggestedFilters
  };
}

/**
 * Check if query is related to ApostropheCMS
 * @param {string} query
 * @returns {boolean}
 */
export function isApostropheRelated(query) {
  const lowerQuery = query.toLowerCase();
  
  const apostropheTerms = [
    'apostrophe',
    'apos',
    'widget',
    'piece',
    'page type',
    'module',
    'schema',
    'area',
    'astro',
    'nunjucks'
  ];
  
  return apostropheTerms.some(term => lowerQuery.includes(term));
}

/**
 * Calculate similarity score between query and document
 * This is a simple keyword-based similarity for filtering
 * @param {string} query
 * @param {string} content
 * @returns {number} Score between 0 and 1
 */
export function calculateKeywordSimilarity(query, content) {
  const queryTerms = query.toLowerCase().split(/\s+/);
  const contentLower = content.toLowerCase();
  
  let matches = 0;
  for (const term of queryTerms) {
    if (term.length > 2 && contentLower.includes(term)) {
      matches++;
    }
  }
  
  return queryTerms.length > 0 ? matches / queryTerms.length : 0;
}
