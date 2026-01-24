/**
 * @fileoverview Processor for llms-full.txt documentation files
 * 
 * Many modern documentation sites provide an llms-full.txt file
 * optimized for LLM consumption. This processor handles that format.
 */

/**
 * Process llms-full.txt content into page-like structures
 * @param {string} fullText - Complete content from llms-full.txt
 * @param {Object} options - Processing options
 * @returns {Array} Array of page-like objects
 */
export function processLLMsFullText(fullText, options = {}) {
  const {
    baseUrl = 'https://docs.astro.build',
    framework = 'astro',
    version = '4.x'
  } = options;

  // Split content by major headings (# Title)
  const sections = splitIntoSections(fullText);

  const pages = sections.map((section, index) => {
    // Extract title from first line (# Title)
    const titleMatch = section.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : `Section ${index + 1}`;

    // Generate a URL slug from the title
    const explicitUrl = extractMetaLine(section, 'URL');
    const slug = titleToSlug(title);
    const url = explicitUrl || `${baseUrl}/${slug}/`;


    // Extract headings for metadata
    const headings = extractHeadings(section);

    const collection = extractMetaLine(section, 'COLLECTION');
    const navPath = extractMetaLine(section, 'NAV_PATH');
    const docPath = extractMetaLine(section, 'DOC_PATH');

    return {
      url,
      title,
      content: section.trim(),
      links: [],
      metadata: {
        description: `${title} documentation`,
        headings,
        internalLinks: [],
        externalLinks: [],
        scrapedAt: new Date(),
        source: 'llms-full.txt',
        framework,
        version,
        collection,
        navPath,
        docPath
      }
    };
  });

  return pages;
}

function extractMetaLine(text, key) {
  const re = new RegExp(`^${key}:\\s+(.+)$`, 'm');
  const m = text.match(re);
  return m ? m[1].trim() : null;
}


/**
 * Split llms-full.txt content into major sections
 * @param {string} text - Full text content
 * @returns {string[]} Array of section texts
 */
function splitIntoSections(text) {
  // Split on major headings (# Title at start of line)
  const parts = text.split(/(?=^# [^\n]+$)/m);

  // Filter out empty parts and the preamble
  return parts
    .map(part => part.trim())
    .filter(part => part.length > 0 && part.startsWith('#'));
}

/**
 * Extract headings from markdown text
 * @param {string} text - Markdown text
 * @returns {string[]} Array of heading texts
 */
function extractHeadings(text) {
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  const headings = [];
  let match;

  while ((match = headingRegex.exec(text)) !== null) {
    headings.push(match[1].trim());
  }

  return headings;
}

/**
 * Convert title to URL slug
 * @param {string} title - Section title
 * @returns {string} URL-safe slug
 */
function titleToSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Fetch and process llms-full.txt from a URL
 * @param {string} url - URL to llms-full.txt file
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} Array of processed pages
 */
export async function fetchAndProcessLLMsFullText(url, options = {}) {
  console.log(`Fetching llms-full.txt from: ${url}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  console.log(`Downloaded ${Math.round(text.length / 1024)}KB of documentation`);

  const pages = processLLMsFullText(text, options);
  console.log(`Processed into ${pages.length} sections`);

  return pages;
}

/**
 * Example usage:
 * 
 * import { fetchAndProcessLLMsFullText } from './llms-full-processor.js';
 * 
 * const astroPages = await fetchAndProcessLLMsFullText(
 *   'https://docs.astro.build/llms-full.txt',
 *   {
 *     baseUrl: 'https://docs.astro.build',
 *     framework: 'astro',
 *     version: '4.x'
 *   }
 * );
 *
 * // Now process with your chunk processor
 * const documents = processScrapedPages(astroPages, {
 *   maxChunkSize: 1000,
 *   overlap: 200
 * });
 */