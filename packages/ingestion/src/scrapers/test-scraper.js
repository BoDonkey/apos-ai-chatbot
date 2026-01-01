// test-scraper.js
import { PlaywrightScraper } from './playwright-scraper.js';

const scraper = new PlaywrightScraper({
  baseUrl: 'https://docs.apostrophecms.org/guide/module-configuration-patterns.html',
  sitemapUrl: 'https://apostrophecms.com/docs/sitemap.xml',
  maxDepth: 0,  // Just test one page
  maxPages: 5,
  excludePatterns: [
    '/api-examples',     // VitePress template page
    '/search',           // Search page (you already had this)
    '/markdown-examples', // Another common VitePress template
    '/404'               // Error pages
  ]
});

const results = await scraper.scrape();
console.log('Title:', results[0].title);
console.log('Content preview:', results[0].content.substring(0, 500));
console.log('Links found:', results[0].links.length);
console.log('✅ Links:', results[0]?.links);