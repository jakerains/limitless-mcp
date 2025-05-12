/**
 * Configuration module for Limitless MCP server
 * Loads settings from environment variables with sensible defaults
 */
import { LimitlessConfig } from './types';

// Load and validate the API key
const API_KEY = process.env.LIMITLESS_API_KEY;
if (!API_KEY) {
  console.error("Error: LIMITLESS_API_KEY environment variable is not set");
  console.error("Please set it to your Limitless API key");
  process.exit(1);
}

// Create configuration object with defaults
const config: LimitlessConfig = {
  // API configuration
  API_KEY,
  API_BASE_URL: process.env.LIMITLESS_API_BASE_URL || "https://api.limitless.ai/v1",
  API_TIMEOUT_MS: parseInt(process.env.LIMITLESS_API_TIMEOUT_MS || "120000", 10), // 2 minutes default
  API_MAX_RETRIES: parseInt(process.env.LIMITLESS_API_MAX_RETRIES || "3", 10), // Default to 3 retries
  
  // Pagination and result limits
  MAX_LIFELOG_LIMIT: parseInt(process.env.LIMITLESS_MAX_LIFELOG_LIMIT || "100", 10), // Max 100 results per request
  DEFAULT_PAGE_SIZE: parseInt(process.env.LIMITLESS_DEFAULT_PAGE_SIZE || "10", 10), // Default page size
  MAX_SEARCH_MULTIPLIER: parseFloat(process.env.LIMITLESS_SEARCH_MULTIPLIER || "3"), // Default search results multiplier
  
  // Cache configuration
  CACHE_TTL: parseInt(process.env.LIMITLESS_CACHE_TTL || "300", 10), // 5 minutes default
  CACHE_CHECK_PERIOD: parseInt(process.env.LIMITLESS_CACHE_CHECK_PERIOD || "600", 10), // 10 minutes default
  CACHE_MAX_KEYS: parseInt(process.env.LIMITLESS_CACHE_MAX_KEYS || "500", 10), // Max 500 entries default
  
  // Cache TTL multipliers for different data types
  CACHE_TTL_MULTIPLIERS: {
    METADATA: parseFloat(process.env.CACHE_TTL_METADATA || "3"), // Metadata cached 3x longer by default
    LISTINGS: parseFloat(process.env.CACHE_TTL_LISTINGS || "2"), // Listings cached 2x longer by default
    SEARCH: parseFloat(process.env.CACHE_TTL_SEARCH || "1.5"), // Search results cached 1.5x longer by default
    SUMMARIES: parseFloat(process.env.CACHE_TTL_SUMMARIES || "4") // Summaries cached 4x longer by default
  }
};

/**
 * Log configuration to stderr for debugging
 */
export function logConfig(): void {
  console.error(`
======================================
Limitless MCP Server Configuration
======================================
API Base URL: ${config.API_BASE_URL}
API Timeout: ${config.API_TIMEOUT_MS}ms
API Max Retries: ${config.API_MAX_RETRIES}

Max Results: ${config.MAX_LIFELOG_LIMIT}
Default Page Size: ${config.DEFAULT_PAGE_SIZE}
Search Multiplier: ${config.MAX_SEARCH_MULTIPLIER}x

Cache TTL: ${config.CACHE_TTL}s
Cache Check Period: ${config.CACHE_CHECK_PERIOD}s
Cache Max Keys: ${config.CACHE_MAX_KEYS}

Cache TTL Multipliers:
- Metadata: ${config.CACHE_TTL_MULTIPLIERS.METADATA}x
- Listings: ${config.CACHE_TTL_MULTIPLIERS.LISTINGS}x
- Search: ${config.CACHE_TTL_MULTIPLIERS.SEARCH}x
- Summaries: ${config.CACHE_TTL_MULTIPLIERS.SUMMARIES}x
======================================
  `);
}

export default config;