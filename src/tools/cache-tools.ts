/**
 * Cache management tools for Limitless MCP
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from '../utils/errors';
import { z } from "zod";
import cache from "../cache";
import config from "../config";

/**
 * Register cache management tools on the MCP server
 */
export function registerCacheTools(server: McpServer): void {
  // Tool to manage cache settings and data
  server.tool(
    "manage_cache",
    { 
      action: z.enum(["stats", "clear", "clear_type", "config"]).default("stats").describe("Action to perform on the cache"),
      type: z.string().optional().describe("Cache type to clear (for clear_type action)")
    },
    async ({ action, type }) => {
      // Handle different actions
      switch (action) {
        case "clear":
          const keysCount = cache.keys().length;
          cache.flushAll();
          return {
            content: [{
              type: "text",
              text: `Cache cleared successfully. ${keysCount} entries removed.`
            }]
          };
          
        case "clear_type":
          if (!type) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "Type parameter is required for clear_type action",
              { action, type }
            );
          }
          
          // Get all keys
          const allKeys = cache.keys();
          
          // Filter keys that match the specified type
          const keysToDelete = allKeys.filter(key => {
            if (type === "full_lifelog" && key.includes('/lifelogs/') && key.includes('includeMarkdown=true')) {
              return true;
            } else if (type === "metadata" && key.includes('/lifelogs/') && !key.includes('includeMarkdown=true')) {
              return true;
            } else if (type === "listings" && key.startsWith('/lifelogs') && !key.includes('/lifelogs/')) {
              return true;
            } else if (type === "search" && key.includes('query=')) {
              return true;
            } else if (key.includes(type)) {
              // Generic matching based on substring
              return true;
            }
            return false;
          });
          
          // Delete the matched keys
          keysToDelete.forEach(key => cache.del(key));
          
          return {
            content: [{
              type: "text",
              text: `Selectively cleared ${keysToDelete.length} cache entries of type '${type}'.\n\n` +
                  `Valid types include: full_lifelog, metadata, listings, search, or any custom substring.`
            }]
          };
          
        case "config":
          // Show current cache configuration
          return {
            content: [{
              type: "text",
              text: `# Cache Configuration\n\n` +
                    `## API Configuration\n` +
                    `- **API Base URL**: ${config.API_BASE_URL}\n` +
                    `- **API Timeout**: ${config.API_TIMEOUT_MS}ms (${config.API_TIMEOUT_MS / 1000} seconds)\n` +
                    `- **Max Retries**: ${config.API_MAX_RETRIES}\n\n` +
                    `## Pagination & Limits\n` +
                    `- **Max Results**: ${config.MAX_LIFELOG_LIMIT}\n` +
                    `- **Default Page Size**: ${config.DEFAULT_PAGE_SIZE}\n` +
                    `- **Search Multiplier**: ${config.MAX_SEARCH_MULTIPLIER}x\n\n` +
                    `## Cache Settings\n` +
                    `- **TTL**: ${config.CACHE_TTL}s (${config.CACHE_TTL / 60} minutes)\n` +
                    `- **Check Period**: ${config.CACHE_CHECK_PERIOD}s (${config.CACHE_CHECK_PERIOD / 60} minutes)\n` +
                    `- **Max Keys**: ${config.CACHE_MAX_KEYS}\n\n` +
                    `## TTL Multipliers\n` +
                    `- **Metadata**: ${config.CACHE_TTL_MULTIPLIERS.METADATA}x (${config.CACHE_TTL * config.CACHE_TTL_MULTIPLIERS.METADATA}s)\n` +
                    `- **Listings**: ${config.CACHE_TTL_MULTIPLIERS.LISTINGS}x (${config.CACHE_TTL * config.CACHE_TTL_MULTIPLIERS.LISTINGS}s)\n` +
                    `- **Search**: ${config.CACHE_TTL_MULTIPLIERS.SEARCH}x (${config.CACHE_TTL * config.CACHE_TTL_MULTIPLIERS.SEARCH}s)\n` +
                    `- **Summaries**: ${config.CACHE_TTL_MULTIPLIERS.SUMMARIES}x (${config.CACHE_TTL * config.CACHE_TTL_MULTIPLIERS.SUMMARIES}s)\n\n` +
                    `These settings can be configured via the following environment variables:\n` +
                    `- LIMITLESS_API_KEY (required)\n` +
                    `- LIMITLESS_API_BASE_URL\n` +
                    `- LIMITLESS_API_TIMEOUT_MS\n` +
                    `- LIMITLESS_API_MAX_RETRIES\n` +
                    `- LIMITLESS_MAX_LIFELOG_LIMIT\n` +
                    `- LIMITLESS_DEFAULT_PAGE_SIZE\n` +
                    `- LIMITLESS_SEARCH_MULTIPLIER\n` +
                    `- LIMITLESS_CACHE_TTL\n` +
                    `- LIMITLESS_CACHE_CHECK_PERIOD\n` +
                    `- LIMITLESS_CACHE_MAX_KEYS\n` +
                    `- CACHE_TTL_METADATA\n` +
                    `- CACHE_TTL_LISTINGS\n` +
                    `- CACHE_TTL_SEARCH\n` +
                    `- CACHE_TTL_SUMMARIES`
            }]
          };
          
        case "stats":
        default:
          const stats = cache.getStats();
          const keys = cache.keys();
          
          // Enhanced type detection
          const keysByType = keys.reduce((acc: Record<string, number>, key: string) => {
            let type;
            if (key.includes('/lifelogs/')) {
              if (key.includes('includeMarkdown=true')) {
                type = 'full_lifelog';
              } else {
                type = 'lifelog_metadata';
              }
            } else if (key.startsWith('/lifelogs')) {
              if (key.includes('date=')) {
                type = 'date_filtered_listings';
              } else {
                type = 'lifelog_listings';
              }
            } else if (key.includes('query=')) {
              type = 'search_results';
            } else {
              type = 'other';
            }
            
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {});
          
          // Calculate hit ratio and cache efficiency metrics
          const hitRatio = stats.hits + stats.misses > 0 
            ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2)
            : "0.00";
            
          // Calculate average key age if possible (not directly supported by NodeCache)
          const keysSample = keys.slice(0, Math.min(keys.length, 10));
          const keyAges = keysSample.map(key => {
            const ttl = cache.getTtl(key);
            if (ttl) {
              return Math.round((ttl - Date.now()) / 1000);
            }
            return 0;
          }).filter(age => age > 0);
          
          const avgAge = keyAges.length > 0 
            ? (keyAges.reduce((sum, age) => sum + age, 0) / keyAges.length).toFixed(0)
            : "unknown";
            
          // Enhanced stats output
          return {
            content: [{
              type: "text",
              text: `# Cache Statistics\n\n` +
                    `## Performance Metrics\n` +
                    `- **Total Keys**: ${stats.keys}\n` +
                    `- **Hits**: ${stats.hits}\n` +
                    `- **Misses**: ${stats.misses}\n` +
                    `- **Hit Ratio**: ${hitRatio}%\n` +
                    `- **Avg. TTL Remaining**: ${avgAge !== "unknown" ? `~${avgAge}s` : "unknown"}\n\n` +
                    `## Cache Composition\n` +
                    Object.entries(keysByType)
                      .sort(([_, a], [__, b]) => b - a) // Sort by count (highest first)
                      .map(([type, count]) => {
                        const percentage = ((count / stats.keys) * 100).toFixed(1);
                        return `- **${type}**: ${count} (${percentage}%)`;
                      })
                      .join('\n') +
                    `\n\n## Available Actions\n` +
                    `- **stats**: Show these statistics\n` +
                    `- **clear**: Clear entire cache\n` +
                    `- **clear_type**: Clear specific type of cached data (requires 'type' parameter)\n` +
                    `- **config**: Show cache configuration settings`
            }]
          };
      }
    }
  );
}