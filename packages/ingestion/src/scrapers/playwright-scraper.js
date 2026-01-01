/**
 * @fileoverview Playwright-based web scraper for documentation
 */

import { chromium } from 'playwright';
import TurndownService from 'turndown';
import { createLogger } from '@apos-chatbot/shared';
import PQueue from 'p-queue';

const logger = createLogger('PlaywrightScraper');

/**
 * Web scraper using Playwright
 */
export class PlaywrightScraper {
  /**
   * @param {import('@apos-chatbot/shared').ScraperConfig} config
   */
  constructor(config) {
    this.config = {
      maxDepth: 3,
      maxPages: 500,
      delayMs: 100,
      respectRobotsTxt: true,
      ...config
    };

    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });

    // Preserve code language classes
    this.turndown.addRule('fencedCodeBlock', {
      filter: function (node) {
        return node.nodeName === 'PRE' &&
          node.firstChild?.nodeName === 'CODE';
      },
      replacement: function (content, node) {
        const code = node.firstChild;
        const language = code.className.match(/language-(\w+)/)?.[1] || '';
        return '\n```' + language + '\n' + code.textContent + '\n```\n';
      }
    });

    this.visited = new Set();
    this.queue = new PQueue({
      concurrency: 3,
      interval: this.config.delayMs,
      intervalCap: 1
    });

    /** @type {import('@apos-chatbot/shared').ScrapedPage[]} */
    this.results = [];
  }

  /**
   * Check if URL should be scraped
   * @param {string} url
   * @returns {boolean}
   */
  shouldScrape(url) {
    try {
      const urlObj = new URL(url);

      // Check if already visited
      if (this.visited.has(url)) {
        return false;
      }

      // Check allowed domains
      if (this.config.allowedDomains && this.config.allowedDomains.length > 0) {
        const isAllowed = this.config.allowedDomains.some(domain =>
          urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
        );
        if (!isAllowed) {
          return false;
        }
      }

      // Check exclude patterns
      if (this.config.excludePatterns) {
        const isExcluded = this.config.excludePatterns.some(pattern =>
          url.includes(pattern)
        );
        if (isExcluded) {
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error(`Invalid URL: ${url}`, error);
      return false;
    }
  }

  /**
   * Scrape a single page
   * @param {import('playwright').Page} page
   * @param {string} url
   * @returns {Promise<import('@apos-chatbot/shared').ScrapedPage|null>}
   */
  async scrapePage(page, url) {
    try {
      logger.info(`Scraping: ${url}`);

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      const title = await page.title();

      // Clean up navigation
      await page.evaluate(() => {
        const selectorsToRemove = [
          '.VPSidebar', '.VPNav', '.VPLocalNav',
          '.VPDocAside', '.VPDocFooter',
          'nav', 'aside', 'header', 'footer',
          '.header-anchor', '.feedback', '.local-page-edit'
        ];

        selectorsToRemove.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => el.remove());
        });
      });

      // Extract content
      const contentSelectors = ['.vp-doc', '.VPDoc', 'main', 'article'];
      let content = '';
      for (const selector of contentSelectors) {
        const element = await page.$(selector);
        if (element) {
          const html = await element.innerHTML();
          content = this.turndown.turndown(html);
          break;
        }
      }

      // Extract ALL links from content with metadata
      const { internalLinks, externalLinks } = await page.evaluate(() => {
        const content = document.querySelector('.vp-doc') ||
          document.querySelector('main');
        if (!content) return { internalLinks: [], externalLinks: [] };

        const links = Array.from(content.querySelectorAll('a[href]'))
          .map(a => ({
            url: a.href,
            text: a.textContent?.trim() || ''
          }))
          .filter(link => link.url && !link.url.startsWith('#'));

        // Separate internal vs external
        const internal = links.filter(l =>
          l.url.includes('docs.apostrophecms.org') ||
          l.url.includes('apostrophecms.com/docs')
        );

        const external = links.filter(l =>
          !l.url.includes('docs.apostrophecms.org') &&
          !l.url.includes('apostrophecms.com/docs')
        );

        return {
          internalLinks: internal,
          externalLinks: external
        };
      });

      // Extract other metadata
      const description = await page.$eval(
        'meta[name="description"]',
        el => el.getAttribute('content')
      ).catch(() => '');

      const headings = await page.$$eval('h1, h2, h3',
        elements => elements.map(el => el.textContent?.trim() || '')
      );

      this.visited.add(url);

      return {
        url,
        title,
        content,
        links: internalLinks.map(l => l.url),
        metadata: {
          description,
          headings,
          internalLinks,
          externalLinks,
          scrapedAt: new Date()
        }
      };
    } catch (error) {
      logger.error(`Failed to scrape ${url}`, error);
      return null;
    }
  }

  /**
   * Scrape starting from base URL
   * @returns {Promise<import('@apos-chatbot/shared').ScrapedPage[]>}
   */
  async scrape() {
    const browser = await chromium.launch({ headless: true });

    try {
      const context = await browser.newContext({
        userAgent: 'ApostropheCMS-Chatbot-Scraper/1.0'
      });
      const page = await context.newPage();

      // Fetch sitemap URLs
      const sitemapUrl = this.config.sitemapUrl ||
        `${this.config.baseUrl}/sitemap.xml`;

      let urls = await fetchSitemap(sitemapUrl);

      // Apply filters
      urls = urls.filter(url => this.shouldScrape(url));

      // Limit to maxPages
      if (urls.length > this.config.maxPages) {
        logger.warn(`Limiting to ${this.config.maxPages} pages (sitemap has ${urls.length})`);
        urls = urls.slice(0, this.config.maxPages);
      }

      logger.info(`Scraping ${urls.length} pages from sitemap`);

      // Scrape each URL
      for (const url of urls) {
        const result = await this.scrapePage(page, url);

        if (result) {
          this.results.push(result);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, this.config.delayMs));
      }

      logger.info(`Scraping complete. Scraped ${this.results.length} pages.`);
      return this.results;

    } finally {
      await browser.close();
    }
  }

  /**
   * Reset the scraper state
   */
  reset() {
    this.visited.clear();
    this.results = [];
  }
}

/**
 * Scrape a documentation site
 * @param {import('@apos-chatbot/shared').ScraperConfig} config
 * @returns {Promise<import('@apos-chatbot/shared').ScrapedPage[]>}
 */
export async function scrapeDocumentation(config) {
  const scraper = new PlaywrightScraper(config);
  return scraper.scrape();
}

/**
 * Fetch and parse sitemap
 * @param {string} sitemapUrl
 * @returns {Promise<string[]>}
 */
async function fetchSitemap(sitemapUrl) {
  logger.info(`Fetching sitemap from ${sitemapUrl}`);

  const response = await fetch(sitemapUrl);
  const xml = await response.text();

  // Simple XML parsing - extract all <loc> tags
  const urls = [];
  const locRegex = /<loc>(.*?)<\/loc>/g;
  let match;

  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1]);
  }

  logger.info(`Found ${urls.length} URLs in sitemap`);
  return urls;
}
