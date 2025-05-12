/**
 * Cache management module for Limitless MCP server
 */
import NodeCache from 'node-cache';
import config from '../config';

// Initialize cache with configuration settings
const cache = new NodeCache({
  stdTTL: config.CACHE_TTL,
  checkperiod: config.CACHE_CHECK_PERIOD,
  maxKeys: config.CACHE_MAX_KEYS,
  useClones: true
});

// Set up periodic cache statistics reporting
setInterval(() => {
  const stats = cache.getStats();
  console.error(`Cache stats: ${stats.keys} keys, ${stats.hits} hits, ${stats.misses} misses, Hit rate: ${(stats.hits / (stats.hits + stats.misses) || 0).toFixed(2)}`);
}, 300000); // Report every 5 minutes

/**
 * Calculate an appropriate TTL based on the data type and path
 */
export function calculateTTL(path: string, queryParams: Record<string, unknown>): number {
  let ttl = config.CACHE_TTL;
  
  // Single lifelog metadata (cached longer since they rarely change)
  if (path.includes('/lifelogs/') && !queryParams.includeMarkdown) {
    ttl = config.CACHE_TTL * config.CACHE_TTL_MULTIPLIERS.METADATA;
    console.error(`Using metadata TTL multiplier: ${config.CACHE_TTL_MULTIPLIERS.METADATA}x`);
  } 
  // Lifelog listings (cached moderately long)
  else if (path === '/lifelogs' && queryParams.limit) {
    ttl = config.CACHE_TTL * config.CACHE_TTL_MULTIPLIERS.LISTINGS;
    console.error(`Using listings TTL multiplier: ${config.CACHE_TTL_MULTIPLIERS.LISTINGS}x`);
  }
  // Search results (moderate caching)
  else if (queryParams.query) {
    ttl = config.CACHE_TTL * config.CACHE_TTL_MULTIPLIERS.SEARCH;
    console.error(`Using search TTL multiplier: ${config.CACHE_TTL_MULTIPLIERS.SEARCH}x`);
  }
  
  return ttl;
}

/**
 * Get tags for a cache entry based on the path and query parameters
 */
export function getCacheTags(path: string, queryParams: Record<string, unknown>): string[] {
  const tags: string[] = [];
  
  if (path.includes('/lifelogs/')) {
    tags.push('single_lifelog');
    if (queryParams.includeMarkdown) {
      tags.push('full_content');
    } else {
      tags.push('metadata_only');
    }
  } else if (path === '/lifelogs') {
    tags.push('lifelog_listings');
    if (queryParams.date) tags.push(`date:${queryParams.date}`);
  }
  
  return tags;
}

export default cache;