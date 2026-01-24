/**
 * @fileoverview Test script for OpenAPI processor
 * Usage: node test-openapi.js [path-or-url-to-spec]
 */

import { processOpenAPISpec } from './openapi-processor.js';

const specSource = process.argv[2] || 'https://petstore3.swagger.io/api/v3/openapi.json';

console.log(`Testing OpenAPI processor with: ${specSource}`);
console.log('='.repeat(60));

try {
  const pages = await processOpenAPISpec(specSource);
  
  console.log(`\n✅ Successfully processed ${pages.length} pages\n`);
  
  // Show first 3 pages as examples
  for (let i = 0; i < Math.min(3, pages.length); i++) {
    const page = pages[i];
    console.log(`\n--- Page ${i + 1}: ${page.title} ---`);
    console.log(`URL: ${page.url}`);
    console.log(`Content preview (first 200 chars):\n${page.content.substring(0, 200)}...`);
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Total pages: ${pages.length}`);
  
} catch (error) {
  console.error('\n❌ Error processing OpenAPI spec:', error.message);
  process.exit(1);
}
