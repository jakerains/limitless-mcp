#!/usr/bin/env node
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from './utils/errors';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { request } from "undici";
import { z } from "zod";
import NodeCache from "node-cache";
import { initializePlugins } from "./plugins/index.js";
// ──────────────────────────────────────────────────────────────────────────────
// Main function that runs the MCP server
// ──────────────────────────────────────────────────────────────────────────────
async function main() {
    // Read environment variables for configuration
    const API_KEY = process.env.LIMITLESS_API_KEY;
    if (!API_KEY) {
        console.error("Error: LIMITLESS_API_KEY environment variable is not set");
        console.error("Please set it to your Limitless API key");
        process.exit(1);
    }
    // API configuration with defaults
    const API_BASE_URL = process.env.LIMITLESS_API_BASE_URL || "https://api.limitless.ai/v1";
    const API_TIMEOUT_MS = parseInt(process.env.LIMITLESS_API_TIMEOUT_MS || "120000", 10); // 2 minutes default
    const API_MAX_RETRIES = parseInt(process.env.LIMITLESS_API_MAX_RETRIES || "3", 10); // Default to 3 retries
    // Pagination and result limits
    const MAX_LIFELOG_LIMIT = parseInt(process.env.LIMITLESS_MAX_LIFELOG_LIMIT || "100", 10); // Max 100 results per request
    const DEFAULT_PAGE_SIZE = parseInt(process.env.LIMITLESS_DEFAULT_PAGE_SIZE || "10", 10); // Default page size
    const MAX_SEARCH_MULTIPLIER = parseFloat(process.env.LIMITLESS_SEARCH_MULTIPLIER || "3"); // Default search results multiplier
    // Cache configuration with defaults
    const CACHE_TTL = parseInt(process.env.LIMITLESS_CACHE_TTL || "300", 10); // 5 minutes default
    const CACHE_CHECK_PERIOD = parseInt(process.env.LIMITLESS_CACHE_CHECK_PERIOD || "600", 10); // 10 minutes default
    const CACHE_MAX_KEYS = parseInt(process.env.LIMITLESS_CACHE_MAX_KEYS || "500", 10); // Max 500 entries default
    // Cache TTL multipliers for different data types
    const CACHE_TTL_MULTIPLIERS = {
        METADATA: parseFloat(process.env.CACHE_TTL_METADATA || "3"), // Metadata cached 3x longer by default
        LISTINGS: parseFloat(process.env.CACHE_TTL_LISTINGS || "2"), // Listings cached 2x longer by default
        SEARCH: parseFloat(process.env.CACHE_TTL_SEARCH || "1.5"), // Search results cached 1.5x longer by default
        SUMMARIES: parseFloat(process.env.CACHE_TTL_SUMMARIES || "4") // Summaries cached 4x longer by default (they're expensive to regenerate)
    };
    // Initialize cache
    const cache = new NodeCache({
        stdTTL: CACHE_TTL,
        checkperiod: CACHE_CHECK_PERIOD,
        maxKeys: CACHE_MAX_KEYS,
        useClones: true
    });
    // Log configuration to stderr for debugging
    console.error(`
======================================
Limitless MCP Server Configuration
======================================
API Base URL: ${API_BASE_URL}
API Timeout: ${API_TIMEOUT_MS}ms
API Max Retries: ${API_MAX_RETRIES}

Max Results: ${MAX_LIFELOG_LIMIT}
Default Page Size: ${DEFAULT_PAGE_SIZE}
Search Multiplier: ${MAX_SEARCH_MULTIPLIER}x

Cache TTL: ${CACHE_TTL}s
Cache Check Period: ${CACHE_CHECK_PERIOD}s
Cache Max Keys: ${CACHE_MAX_KEYS}

Cache TTL Multipliers:
- Metadata: ${CACHE_TTL_MULTIPLIERS.METADATA}x
- Listings: ${CACHE_TTL_MULTIPLIERS.LISTINGS}x
- Search: ${CACHE_TTL_MULTIPLIERS.SEARCH}x
- Summaries: ${CACHE_TTL_MULTIPLIERS.SUMMARIES}x
======================================
  `);
    // Cache statistics reporting
    setInterval(() => {
        const stats = cache.getStats();
        console.error(`Cache stats: ${stats.keys} keys, ${stats.hits} hits, ${stats.misses} misses, Hit rate: ${(stats.hits / (stats.hits + stats.misses) || 0).toFixed(2)}`);
    }, 300000); // Report every 5 minutes
    // Function to call the Limitless API with configurable settings
    const call = async (path, qs = {}, useCache = true) => {
        // Build cache key based on path and query params
        const cacheParams = new URLSearchParams();
        // Sort keys for consistent cache key generation
        Object.keys(qs).sort().forEach(key => {
            const value = qs[key];
            if (value !== undefined && value !== null) {
                cacheParams.append(key, String(value));
            }
        });
        const cacheKey = `${path}?${cacheParams.toString()}`;
        // Check cache if enabled
        if (useCache) {
            const cachedData = cache.get(cacheKey);
            if (cachedData) {
                console.error(`Cache hit for: ${cacheKey}`);
                return cachedData;
            }
            console.error(`Cache miss for: ${cacheKey}`);
        }
        // Convert all query parameter values to strings for API call
        const params = new URLSearchParams();
        Object.entries(qs).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                params.append(key, String(value));
            }
        });
        try {
            // Apply configured timeout and retry logic
            const requestOptions = {
                headers: { "X-API-Key": API_KEY },
                bodyTimeout: API_TIMEOUT_MS,
                headersTimeout: API_TIMEOUT_MS
            };
            // Make the API request with retry logic
            let response;
            let retryCount = 0;
            let lastError;
            while (retryCount <= API_MAX_RETRIES) {
                try {
                    if (retryCount > 0) {
                        console.error(`Retry attempt ${retryCount}/${API_MAX_RETRIES} for ${path}`);
                        // Exponential backoff: 1s, 2s, 4s, etc.
                        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount - 1) * 1000));
                    }
                    response = await request(`${API_BASE_URL}${path}?${params}`, requestOptions);
                    break; // Success - exit retry loop
                }
                catch (err) {
                    lastError = err;
                    // Only retry on network errors or 5xx errors
                    const errWithStatus = err;
                    if (errWithStatus.statusCode && errWithStatus.statusCode < 500) {
                        throw err; // Don't retry client errors (4xx)
                    }
                    retryCount++;
                    if (retryCount > API_MAX_RETRIES) {
                        console.error(`All ${API_MAX_RETRIES} retry attempts failed for ${path}`);
                        throw err;
                    }
                }
            }
            // If we're here without response, throw the last error
            if (!response) {
                throw lastError || new Error(`API call failed with no response: ${path}`);
            }
            // Check if the response is successful (status code 200-299)
            if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
                throw new Error(`HTTP error: ${response.statusCode}`);
            }
            const data = await response.body.json();
            // Store in cache if enabled
            if (useCache) {
                // Calculate custom TTL based on data type
                // Different data types have different optimal cache durations
                let ttl = CACHE_TTL;
                // Single lifelog metadata (cached longer since they rarely change)
                if (path.includes('/lifelogs/') && !qs.includeMarkdown) {
                    ttl = CACHE_TTL * CACHE_TTL_MULTIPLIERS.METADATA;
                    console.error(`Using metadata TTL multiplier: ${CACHE_TTL_MULTIPLIERS.METADATA}x`);
                }
                // Lifelog listings (cached moderately long)
                else if (path === '/lifelogs' && data.data.lifelogs && data.data.lifelogs.length > 0) {
                    ttl = CACHE_TTL * CACHE_TTL_MULTIPLIERS.LISTINGS;
                    console.error(`Using listings TTL multiplier: ${CACHE_TTL_MULTIPLIERS.LISTINGS}x`);
                }
                // Search results (moderate caching)
                else if (qs.query) {
                    ttl = CACHE_TTL * CACHE_TTL_MULTIPLIERS.SEARCH;
                    console.error(`Using search TTL multiplier: ${CACHE_TTL_MULTIPLIERS.SEARCH}x`);
                }
                // Add tags to the cache entry for better management
                const tags = [];
                if (path.includes('/lifelogs/')) {
                    tags.push('single_lifelog');
                    if (qs.includeMarkdown) {
                        tags.push('full_content');
                    }
                    else {
                        tags.push('metadata_only');
                    }
                }
                else if (path === '/lifelogs') {
                    tags.push('lifelog_listings');
                    if (qs.date)
                        tags.push(`date:${qs.date}`);
                }
                // Store in cache with calculated TTL
                cache.set(cacheKey, data, ttl);
                console.error(`Cached data for: ${cacheKey} with TTL ${ttl}s (tags: ${tags.join(', ')})`);
            }
            return data;
        }
        catch (error) {
            console.error("API call error:", error);
            // Add status code to the error object for better error handling
            if (error.response) {
                error.statusCode = error.response.statusCode;
            }
            throw error;
        }
    };
    // ──────────────────────────────────────────────────────────────────────────────
    // 1. Spin up the server object
    // ──────────────────────────────────────────────────────────────────────────────
    const server = new McpServer({
        name: "limitless",
        version: "0.4.0"
    });
    // ──────────────────────────────────────────────────────────────────────────────
    // 2. Resources  (virtual markdown files for Claude to read)
    // ──────────────────────────────────────────────────────────────────────────────
    server.resource("lifelogs", new ResourceTemplate("lifelogs://{id}", {
        list: async () => {
            const response = await call("/lifelogs", { limit: 25 });
            const logs = response.data.lifelogs || [];
            return {
                resources: logs.map((l) => ({
                    name: l.title,
                    uri: `lifelogs://${l.id}`,
                    description: l.title
                }))
            };
        }
    }), {}, async (uri) => {
        const id = uri.host; // lifelogs://<id>
        const response = await call(`/lifelogs/${id}`);
        const lifelog = response.data.lifelog;
        return {
            contents: [{ uri: uri.href, text: lifelog?.markdown ?? "(empty)" }]
        };
    });
    // ──────────────────────────────────────────────────────────────────────────────
    // 3. Tools  (callable functions)
    // ──────────────────────────────────────────────────────────────────────────────
    // Tool to get cache information or clear the cache
    server.tool("manage_cache", {
        action: z.enum(["stats", "clear", "clear_type", "config"]).default("stats").describe("Action to perform on the cache"),
        type: z.string().optional().describe("Cache type to clear (for clear_type action)")
    }, async ({ action, type }) => {
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
                    throw new McpError(ErrorCode.InvalidParams, "Type parameter is required for clear_type action", { action, type });
                }
                // Get all keys
                const allKeys = cache.keys();
                // Filter keys that match the specified type
                const keysToDelete = allKeys.filter(key => {
                    if (type === "full_lifelog" && key.includes('/lifelogs/') && key.includes('includeMarkdown=true')) {
                        return true;
                    }
                    else if (type === "metadata" && key.includes('/lifelogs/') && !key.includes('includeMarkdown=true')) {
                        return true;
                    }
                    else if (type === "listings" && key.startsWith('/lifelogs') && !key.includes('/lifelogs/')) {
                        return true;
                    }
                    else if (type === "search" && key.includes('query=')) {
                        return true;
                    }
                    else if (key.includes(type)) {
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
                                `- **API Base URL**: ${API_BASE_URL}\n` +
                                `- **API Timeout**: ${API_TIMEOUT_MS}ms (${API_TIMEOUT_MS / 1000} seconds)\n` +
                                `- **Max Retries**: ${API_MAX_RETRIES}\n\n` +
                                `## Pagination & Limits\n` +
                                `- **Max Results**: ${MAX_LIFELOG_LIMIT}\n` +
                                `- **Default Page Size**: ${DEFAULT_PAGE_SIZE}\n` +
                                `- **Search Multiplier**: ${MAX_SEARCH_MULTIPLIER}x\n\n` +
                                `## Cache Settings\n` +
                                `- **TTL**: ${CACHE_TTL}s (${CACHE_TTL / 60} minutes)\n` +
                                `- **Check Period**: ${CACHE_CHECK_PERIOD}s (${CACHE_CHECK_PERIOD / 60} minutes)\n` +
                                `- **Max Keys**: ${CACHE_MAX_KEYS}\n\n` +
                                `## TTL Multipliers\n` +
                                `- **Metadata**: ${CACHE_TTL_MULTIPLIERS.METADATA}x (${CACHE_TTL * CACHE_TTL_MULTIPLIERS.METADATA}s)\n` +
                                `- **Listings**: ${CACHE_TTL_MULTIPLIERS.LISTINGS}x (${CACHE_TTL * CACHE_TTL_MULTIPLIERS.LISTINGS}s)\n` +
                                `- **Search**: ${CACHE_TTL_MULTIPLIERS.SEARCH}x (${CACHE_TTL * CACHE_TTL_MULTIPLIERS.SEARCH}s)\n` +
                                `- **Summaries**: ${CACHE_TTL_MULTIPLIERS.SUMMARIES}x (${CACHE_TTL * CACHE_TTL_MULTIPLIERS.SUMMARIES}s)\n\n` +
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
                const keysByType = keys.reduce((acc, key) => {
                    let type;
                    if (key.includes('/lifelogs/')) {
                        if (key.includes('includeMarkdown=true')) {
                            type = 'full_lifelog';
                        }
                        else {
                            type = 'lifelog_metadata';
                        }
                    }
                    else if (key.startsWith('/lifelogs')) {
                        if (key.includes('date=')) {
                            type = 'date_filtered_listings';
                        }
                        else {
                            type = 'lifelog_listings';
                        }
                    }
                    else if (key.includes('query=')) {
                        type = 'search_results';
                    }
                    else {
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
    });
    // List lifelogs with enhanced filtering options and selective field retrieval
    server.tool("list_lifelogs", {
        limit: z.number().optional(),
        date: z.string().optional().describe("Date in YYYY-MM-DD format"),
        timezone: z.string().optional().describe("IANA timezone specifier"),
        start: z.string().optional().describe("Start date/time in YYYY-MM-DD or YYYY-MM-DD HH:mm:SS format"),
        end: z.string().optional().describe("End date/time in YYYY-MM-DD or YYYY-MM-DD HH:mm:SS format"),
        direction: z.enum(["asc", "desc"]).optional().describe("Sort direction: asc or desc"),
        includeContent: z.boolean().default(false).describe("Whether to include markdown content"),
        fields: z.array(z.string()).optional().describe("Specific fields to include (title, time, id, etc.)")
    }, async ({ limit = DEFAULT_PAGE_SIZE, date, timezone, start, end, direction, includeContent, fields }) => {
        // Set up query parameters with selective field retrieval
        const queryParams = {
            limit,
            date,
            timezone,
            start,
            end,
            direction,
            includeMarkdown: includeContent
        };
        // Add specific fields if requested
        if (fields && fields.length > 0) {
            queryParams.fields = fields.join(',');
        }
        const response = await call("/lifelogs", queryParams);
        const lifelogs = response.data.lifelogs || [];
        const nextCursor = response.meta?.lifelogs?.nextCursor;
        let resultText = lifelogs.map((l) => {
            let timeInfo = "";
            if (l.startTime) {
                const startDate = new Date(l.startTime);
                timeInfo = ` (${startDate.toLocaleString()})`;
            }
            let result = `${l.id} — ${l.title}${timeInfo}`;
            // If content was requested, add a snippet
            if (includeContent && l.markdown) {
                const snippet = l.markdown.substring(0, 100) + (l.markdown.length > 100 ? '...' : '');
                result += `\n${snippet}\n`;
            }
            return result;
        }).join("\n\n");
        // Add pagination information
        if (nextCursor) {
            resultText += `\n\n[More results available. Use cursor: ${nextCursor} with get_paged_lifelogs]`;
        }
        return {
            content: [{
                    type: "text",
                    text: lifelogs.length ? resultText : "No lifelogs found for the specified criteria."
                }]
        };
    });
    // Pagination support for lifelogs with selective field retrieval
    server.tool("get_paged_lifelogs", {
        cursor: z.string().describe("Pagination cursor from previous results"),
        limit: z.number().optional(),
        date: z.string().optional().describe("Date in YYYY-MM-DD format"),
        timezone: z.string().optional().describe("IANA timezone specifier"),
        direction: z.enum(["asc", "desc"]).optional().describe("Sort direction: asc or desc"),
        includeContent: z.boolean().default(false).describe("Whether to include markdown content"),
        fields: z.array(z.string()).optional().describe("Specific fields to include (title, time, id, etc.)")
    }, async ({ cursor, limit = DEFAULT_PAGE_SIZE, date, timezone, direction, includeContent, fields }) => {
        // Set up query parameters with selective field retrieval
        const queryParams = {
            cursor,
            limit,
            date,
            timezone,
            direction,
            includeMarkdown: includeContent
        };
        // Add specific fields if requested
        if (fields && fields.length > 0) {
            queryParams.fields = fields.join(',');
        }
        const response = await call("/lifelogs", queryParams);
        const lifelogs = response.data.lifelogs || [];
        const nextCursor = response.meta?.lifelogs?.nextCursor;
        let resultText = lifelogs.map((l) => {
            let timeInfo = "";
            if (l.startTime) {
                const startDate = new Date(l.startTime);
                timeInfo = ` (${startDate.toLocaleString()})`;
            }
            let result = `${l.id} — ${l.title}${timeInfo}`;
            // If content was requested, add a snippet
            if (includeContent && l.markdown) {
                const snippet = l.markdown.substring(0, 100) + (l.markdown.length > 100 ? '...' : '');
                result += `\n${snippet}\n`;
            }
            return result;
        }).join("\n\n");
        // Add pagination information 
        if (nextCursor) {
            resultText += `\n\n[More results available. Use cursor: ${nextCursor}]`;
        }
        return {
            content: [{
                    type: "text",
                    text: lifelogs.length ? resultText : "No lifelogs found for the specified criteria."
                }]
        };
    });
    // Get a specific lifelog by ID with optional field selection
    server.tool("get_lifelog", {
        id: z.string().describe("The ID of the lifelog to retrieve"),
        includeContent: z.boolean().default(true).describe("Whether to include full content or just metadata"),
        fields: z.array(z.string()).optional().describe("Specific fields to include (title, time, speakers, etc.)")
    }, async ({ id, includeContent, fields }) => {
        try {
            // Set query parameters based on requested fields
            const queryParams = {
                includeMarkdown: includeContent
            };
            // Handle selective field retrieval
            if (fields && fields.length > 0) {
                queryParams.fields = fields.join(',');
            }
            const response = await call(`/lifelogs/${id}`, queryParams);
            const lifelog = response.data.lifelog;
            if (!lifelog) {
                throw new McpError(ErrorCode.NotFound, `No lifelog found with ID: ${id}`, { id });
            }
            // Process time information
            let formattedTime = "";
            if (lifelog.startTime) {
                const startDate = new Date(lifelog.startTime);
                formattedTime = ` (${startDate.toLocaleString()})`;
            }
            // Build header with available metadata
            let header = `# ${lifelog.title}${formattedTime}\n\nID: ${lifelog.id}\n\n`;
            // Add duration if available
            if (lifelog.startTime && lifelog.endTime) {
                const start = new Date(lifelog.startTime).getTime();
                const end = new Date(lifelog.endTime).getTime();
                const durationMs = end - start;
                const minutes = Math.floor(durationMs / 60000);
                const seconds = Math.floor((durationMs % 60000) / 1000);
                header += `Duration: ${minutes}m ${seconds}s\n\n`;
            }
            // Extract speaker information if available
            if (lifelog.contents && lifelog.contents.length > 0) {
                const speakers = new Set();
                lifelog.contents.forEach(content => {
                    if (content.speakerName) {
                        speakers.add(content.speakerName);
                    }
                });
                if (speakers.size > 0) {
                    header += `Speakers: ${Array.from(speakers).join(', ')}\n\n`;
                }
            }
            // Combine header and content (if requested)
            const content = includeContent ? (lifelog.markdown || "(No content available)") : "(Content not requested)";
            return {
                content: [{
                        type: "text",
                        text: header + content
                    }]
            };
        }
        catch (error) {
            console.error(`Error fetching lifelog ${id}:`, error);
            // If it's already an McpError, rethrow it
            if (error instanceof McpError) {
                throw error;
            }
            // Handle HTTP status errors
            if (error.statusCode) {
                if (error.statusCode === 404) {
                    throw new McpError(`Lifelog with ID ${id} not found`, ErrorCode.NotFound);
                }
                else if (error.statusCode === 401 || error.statusCode === 403) {
                    throw new McpError(`Unauthorized access to Limitless API`, ErrorCode.Unauthorized);
                }
                else if (error.statusCode >= 500) {
                    throw new McpError(`Limitless API service error: ${error.statusCode}`, ErrorCode.ServiceUnavailable);
                }
            }
            // Generic error fallback
            throw new McpError(`Error retrieving lifelog ${id}: ${error.message || 'Unknown error'}`, ErrorCode.Internal);
        }
    });
    // Get only metadata for a lifelog
    server.tool("get_lifelog_metadata", {
        id: z.string().describe("The ID of the lifelog to retrieve metadata for")
    }, async ({ id }) => {
        try {
            const response = await call(`/lifelogs/${id}`, { includeMarkdown: false });
            const lifelog = response.data.lifelog;
            if (!lifelog) {
                throw new McpError(ErrorCode.NotFound, `No lifelog found with ID: ${id}`, { id });
            }
            // Format metadata
            let metadata = `# Metadata for Lifelog: ${lifelog.title}\n\n`;
            metadata += `- **ID**: ${lifelog.id}\n`;
            if (lifelog.startTime) {
                const startDate = new Date(lifelog.startTime);
                metadata += `- **Start Time**: ${startDate.toLocaleString()}\n`;
            }
            if (lifelog.endTime) {
                const endDate = new Date(lifelog.endTime);
                metadata += `- **End Time**: ${endDate.toLocaleString()}\n`;
            }
            if (lifelog.startTime && lifelog.endTime) {
                const start = new Date(lifelog.startTime).getTime();
                const end = new Date(lifelog.endTime).getTime();
                const durationMs = end - start;
                const minutes = Math.floor(durationMs / 60000);
                const seconds = Math.floor((durationMs % 60000) / 1000);
                metadata += `- **Duration**: ${minutes}m ${seconds}s\n`;
            }
            // Add content structure information if available
            if (lifelog.contents && lifelog.contents.length > 0) {
                metadata += `- **Content Blocks**: ${lifelog.contents.length}\n`;
                // Count by type
                const typeCounts = {};
                lifelog.contents.forEach(content => {
                    typeCounts[content.type] = (typeCounts[content.type] || 0) + 1;
                });
                metadata += `- **Content Types**:\n`;
                Object.entries(typeCounts).forEach(([type, count]) => {
                    metadata += `  - ${type}: ${count}\n`;
                });
                // Speaker information
                const speakers = new Set();
                lifelog.contents.forEach(content => {
                    if (content.speakerName) {
                        speakers.add(content.speakerName);
                    }
                });
                if (speakers.size > 0) {
                    metadata += `- **Speakers**: ${Array.from(speakers).join(', ')}\n`;
                }
            }
            return {
                content: [{
                        type: "text",
                        text: metadata
                    }]
            };
        }
        catch (error) {
            console.error(`Error fetching lifelog metadata ${id}:`, error);
            // If it's already an McpError, rethrow it
            if (error instanceof McpError) {
                throw error;
            }
            // Handle HTTP status errors
            if (error.statusCode) {
                if (error.statusCode === 404) {
                    throw new McpError(`Lifelog with ID ${id} not found`, ErrorCode.NotFound);
                }
                else if (error.statusCode === 401 || error.statusCode === 403) {
                    throw new McpError(`Unauthorized access to Limitless API`, ErrorCode.Unauthorized);
                }
                else if (error.statusCode >= 500) {
                    throw new McpError(`Limitless API service error: ${error.statusCode}`, ErrorCode.ServiceUnavailable);
                }
            }
            // Generic error fallback
            throw new McpError(ErrorCode.Internal, `Error retrieving lifelog metadata for ${id}: ${error.message || 'Unknown error'}`, { id });
        }
    });
    // Filter lifelog contents by various criteria
    server.tool("filter_lifelog_contents", {
        id: z.string().describe("The ID of the lifelog to filter content from"),
        speakerName: z.string().optional().describe("Filter by speaker name"),
        contentType: z.string().optional().describe("Filter by content type (e.g., heading1, blockquote)"),
        timeStart: z.string().optional().describe("Filter content after this time (ISO-8601)"),
        timeEnd: z.string().optional().describe("Filter content before this time (ISO-8601)")
    }, async ({ id, speakerName, contentType, timeStart, timeEnd }) => {
        try {
            const response = await call(`/lifelogs/${id}`);
            const lifelog = response.data.lifelog;
            if (!lifelog || !lifelog.contents) {
                return {
                    content: [{
                            type: "text",
                            text: `No content found for lifelog with ID: ${id}`
                        }]
                };
            }
            let filteredContents = lifelog.contents;
            // Apply filters
            if (speakerName) {
                filteredContents = filteredContents.filter(c => c.speakerName && c.speakerName.toLowerCase().includes(speakerName.toLowerCase()));
            }
            if (contentType) {
                filteredContents = filteredContents.filter(c => c.type === contentType);
            }
            if (timeStart) {
                const startTime = new Date(timeStart).getTime();
                filteredContents = filteredContents.filter(c => {
                    if (!c.startTime)
                        return true;
                    return new Date(c.startTime).getTime() >= startTime;
                });
            }
            if (timeEnd) {
                const endTime = new Date(timeEnd).getTime();
                filteredContents = filteredContents.filter(c => {
                    if (!c.endTime)
                        return true;
                    return new Date(c.endTime).getTime() <= endTime;
                });
            }
            if (filteredContents.length === 0) {
                return {
                    content: [{
                            type: "text",
                            text: "No content matched the filter criteria."
                        }]
                };
            }
            // Format the filtered content
            let result = `# Filtered Content from "${lifelog.title}"\n\n`;
            result += `Found ${filteredContents.length} matching content blocks out of ${lifelog.contents.length} total.\n\n`;
            filteredContents.forEach((content, index) => {
                let timeInfo = "";
                if (content.startTime) {
                    const time = new Date(content.startTime).toLocaleTimeString();
                    timeInfo = ` (${time})`;
                }
                let speaker = content.speakerName ? `**${content.speakerName}**: ` : "";
                result += `## Block ${index + 1}${timeInfo}\n${speaker}${content.content}\n\n`;
            });
            return {
                content: [{
                        type: "text",
                        text: result
                    }]
            };
        }
        catch (error) {
            console.error(`Error filtering lifelog ${id}:`, error);
            return {
                content: [{
                        type: "text",
                        text: `Error filtering lifelog ${id}. Please check if the ID is correct.`
                    }]
            };
        }
    });
    // Generate a formatted transcript from a lifelog
    server.tool("generate_transcript", {
        id: z.string().describe("The ID of the lifelog to generate transcript from"),
        format: z.enum(["simple", "detailed", "dialogue"]).default("dialogue").describe("Transcript format style")
    }, async ({ id, format }) => {
        try {
            const response = await call(`/lifelogs/${id}`);
            const lifelog = response.data.lifelog;
            if (!lifelog || !lifelog.contents) {
                return {
                    content: [{
                            type: "text",
                            text: `No content found for lifelog with ID: ${id}`
                        }]
                };
            }
            // Extract and sort content by time if available
            let contents = [...(lifelog.contents || [])];
            contents.sort((a, b) => {
                if (!a.startTime || !b.startTime)
                    return 0;
                return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
            });
            let transcript = "";
            // Generate transcript based on requested format
            switch (format) {
                case "simple":
                    transcript = `# ${lifelog.title} - Simple Transcript\n\n`;
                    contents.forEach(content => {
                        transcript += `${content.content}\n\n`;
                    });
                    break;
                case "detailed":
                    transcript = `# ${lifelog.title} - Detailed Transcript\n\n`;
                    contents.forEach((content, index) => {
                        let timeInfo = "";
                        if (content.startTime) {
                            timeInfo = `[${new Date(content.startTime).toLocaleTimeString()}] `;
                        }
                        transcript += `### Block ${index + 1}\n${timeInfo}${content.type}: ${content.content}\n\n`;
                    });
                    break;
                case "dialogue":
                default:
                    transcript = `# ${lifelog.title} - Dialogue Transcript\n\n`;
                    let currentSpeaker = "";
                    let dialogueBlock = "";
                    contents.forEach(content => {
                        // If it's a new speaker or a heading
                        if (content.speakerName && content.speakerName !== currentSpeaker) {
                            // Add the previous block if it exists
                            if (dialogueBlock) {
                                transcript += dialogueBlock + "\n\n";
                            }
                            // Start a new dialogue block
                            currentSpeaker = content.speakerName;
                            dialogueBlock = `**${currentSpeaker}**: ${content.content}`;
                        }
                        else if (content.type.startsWith("heading")) {
                            // Add the previous block if it exists
                            if (dialogueBlock) {
                                transcript += dialogueBlock + "\n\n";
                            }
                            // Reset speaker and add heading
                            currentSpeaker = "";
                            dialogueBlock = `## ${content.content}`;
                        }
                        else if (currentSpeaker) {
                            // Continue with the current speaker
                            dialogueBlock += " " + content.content;
                        }
                        else {
                            // No speaker but not a heading, treat as narrative
                            if (dialogueBlock) {
                                transcript += dialogueBlock + "\n\n";
                            }
                            dialogueBlock = content.content;
                        }
                    });
                    // Add the last block
                    if (dialogueBlock) {
                        transcript += dialogueBlock;
                    }
                    break;
            }
            return {
                content: [{
                        type: "text",
                        text: transcript
                    }]
            };
        }
        catch (error) {
            console.error(`Error generating transcript for ${id}:`, error);
            return {
                content: [{
                        type: "text",
                        text: `Error generating transcript for lifelog ${id}. Please check if the ID is correct.`
                    }]
            };
        }
    });
    // Get time summary and statistics
    server.tool("get_time_summary", {
        date: z.string().optional().describe("Date in YYYY-MM-DD format"),
        timezone: z.string().optional().describe("IANA timezone specifier"),
        start: z.string().optional().describe("Start date in YYYY-MM-DD format"),
        end: z.string().optional().describe("End date in YYYY-MM-DD format"),
        groupBy: z.enum(["hour", "day", "week"]).default("day").describe("How to group the time statistics")
    }, async ({ date, timezone = "America/Los_Angeles", start, end, groupBy = "day" }) => {
        try {
            // Determine date range
            let queryParams = {
                limit: 100,
                timezone,
                direction: "asc"
            };
            if (date) {
                queryParams.date = date;
            }
            else if (start && end) {
                queryParams.start = start;
                queryParams.end = end;
            }
            else if (start) {
                queryParams.start = start;
                // Default to 7 days if only start is provided
                const endDate = new Date(start);
                endDate.setDate(endDate.getDate() + 7);
                queryParams.end = endDate.toISOString().split('T')[0];
            }
            else if (end) {
                queryParams.end = end;
                // Default to 7 days before if only end is provided
                const startDate = new Date(end);
                startDate.setDate(startDate.getDate() - 7);
                queryParams.start = startDate.toISOString().split('T')[0];
            }
            else {
                // Default to last 7 days
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - 7);
                queryParams.start = startDate.toISOString().split('T')[0];
                queryParams.end = endDate.toISOString().split('T')[0];
            }
            const response = await call("/lifelogs", queryParams);
            const lifelogs = response.data.lifelogs || [];
            if (lifelogs.length === 0) {
                return {
                    content: [{
                            type: "text",
                            text: "No lifelogs found for the specified time period."
                        }]
                };
            }
            const stats = {};
            let totalDuration = 0;
            let countWithDuration = 0;
            lifelogs.forEach(log => {
                if (!log.startTime)
                    return;
                let key = "";
                const date = new Date(log.startTime);
                switch (groupBy) {
                    case "hour":
                        key = `${date.toLocaleDateString()} ${date.getHours()}:00`;
                        break;
                    case "week":
                        // Get the monday of the week
                        const day = date.getDay();
                        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                        const monday = new Date(date);
                        monday.setDate(diff);
                        key = `Week of ${monday.toLocaleDateString()}`;
                        break;
                    case "day":
                    default:
                        key = date.toLocaleDateString();
                        break;
                }
                if (!stats[key]) {
                    stats[key] = {
                        count: 0,
                        totalDurationMs: 0,
                        averageDurationMs: 0,
                        key
                    };
                }
                stats[key].count++;
                if (log.startTime && log.endTime) {
                    const start = new Date(log.startTime).getTime();
                    const end = new Date(log.endTime).getTime();
                    const duration = end - start;
                    stats[key].totalDurationMs += duration;
                    totalDuration += duration;
                    countWithDuration++;
                }
            });
            // Calculate averages
            Object.values(stats).forEach(stat => {
                if (stat.count > 0) {
                    stat.averageDurationMs = stat.totalDurationMs / stat.count;
                }
            });
            // Sort by key for proper chronological display
            const sortedStats = Object.values(stats).sort((a, b) => a.key.localeCompare(b.key));
            // Generate report
            let summary = `# Time Summary Analysis`;
            if (date) {
                summary += ` for ${date}`;
            }
            else if (start && end) {
                summary += ` from ${start} to ${end}`;
            }
            summary += `\n\n`;
            summary += `Total lifelogs: ${lifelogs.length}\n`;
            if (countWithDuration > 0) {
                const totalHours = Math.floor(totalDuration / 3600000);
                const totalMinutes = Math.floor((totalDuration % 3600000) / 60000);
                summary += `Total recording time: ${totalHours}h ${totalMinutes}m\n`;
                summary += `Average per recording: ${Math.floor((totalDuration / countWithDuration) / 60000)}m\n\n`;
            }
            summary += `## Breakdown by ${groupBy}\n\n`;
            summary += `| ${groupBy === "hour" ? "Hour" : groupBy === "week" ? "Week" : "Date"} | Count | Total Time | Avg Time |\n`;
            summary += `| --- | --- | --- | --- |\n`;
            sortedStats.forEach(stat => {
                const totalHours = Math.floor(stat.totalDurationMs / 3600000);
                const totalMinutes = Math.floor((stat.totalDurationMs % 3600000) / 60000);
                const totalTime = stat.totalDurationMs > 0 ? `${totalHours}h ${totalMinutes}m` : "N/A";
                const avgMinutes = Math.floor(stat.averageDurationMs / 60000);
                const avgSeconds = Math.floor((stat.averageDurationMs % 60000) / 1000);
                const avgTime = stat.averageDurationMs > 0 ? `${avgMinutes}m ${avgSeconds}s` : "N/A";
                summary += `| ${stat.key} | ${stat.count} | ${totalTime} | ${avgTime} |\n`;
            });
            return {
                content: [{
                        type: "text",
                        text: summary
                    }]
            };
        }
        catch (error) {
            console.error(`Error generating time summary:`, error);
            return {
                content: [{
                        type: "text",
                        text: `Error generating time summary. Please check your date parameters.`
                    }]
            };
        }
    });
    // Enhanced search with relevance scoring
    server.tool("search_lifelogs", {
        query: z.string().describe("Text to search for in lifelogs"),
        limit: z.number().optional(),
        date: z.string().optional().describe("Date in YYYY-MM-DD format"),
        timezone: z.string().optional().describe("IANA timezone specifier"),
        start: z.string().optional().describe("Start date/time in YYYY-MM-DD or YYYY-MM-DD HH:mm:SS format"),
        end: z.string().optional().describe("End date/time in YYYY-MM-DD or YYYY-MM-DD HH:mm:SS format"),
        searchMode: z.enum(["basic", "advanced"]).default("advanced").describe("Search mode: basic (simple contains) or advanced (with scoring)"),
        includeSnippets: z.boolean().default(true).describe("Include matching content snippets in results")
    }, async ({ query, limit = DEFAULT_PAGE_SIZE, date, timezone, start, end, searchMode, includeSnippets }) => {
        // First get the lifelogs based on date criteria
        const response = await call("/lifelogs", {
            limit: Math.min(limit * MAX_SEARCH_MULTIPLIER, MAX_LIFELOG_LIMIT), // Get more than we need to increase search chances
            date,
            timezone,
            start,
            end,
            includeMarkdown: includeSnippets // Only include markdown content if snippets are requested
        });
        const logs = response.data.lifelogs || [];
        if (logs.length === 0) {
            return {
                content: [{
                        type: "text",
                        text: "No lifelogs found for the specified time criteria."
                    }]
            };
        }
        // Parse search terms
        const searchTerms = query
            .toLowerCase()
            .split(/\s+/)
            .filter(term => term.length > 2); // Filter out very short words
        // Process search based on selected mode
        let results = [];
        if (searchMode === "basic") {
            // Simple filter-based search (old method)
            results = logs
                .filter(l => (l.markdown ?? "").toLowerCase().includes(query.toLowerCase()) ||
                (l.title ?? "").toLowerCase().includes(query.toLowerCase()))
                .map(lifelog => ({
                lifelog,
                score: 1,
                matchCount: 1,
                snippet: includeSnippets ? extractSnippet(lifelog.markdown || "", query) : undefined
            }));
        }
        else {
            // Advanced scoring-based search
            results = logs.map(lifelog => {
                const title = lifelog.title?.toLowerCase() || "";
                const content = lifelog.markdown?.toLowerCase() || "";
                // Initial scores
                let score = 0;
                let matchCount = 0;
                let snippet = "";
                // Exact phrase match (highest weight)
                if (content.includes(query.toLowerCase())) {
                    score += 10;
                    matchCount++;
                    snippet = extractSnippet(lifelog.markdown || "", query);
                }
                if (title.includes(query.toLowerCase())) {
                    score += 15; // Title matches are more significant
                    matchCount++;
                }
                // Individual term matches
                for (const term of searchTerms) {
                    // Count term occurrences
                    const titleMatches = countOccurrences(title, term);
                    const contentMatches = countOccurrences(content, term);
                    matchCount += titleMatches + contentMatches;
                    // Score based on term frequency
                    score += titleMatches * 3; // Title matches weighted higher
                    score += contentMatches;
                    // If no snippet yet but we have matches, extract one
                    if (!snippet && contentMatches > 0) {
                        snippet = extractSnippet(lifelog.markdown || "", term);
                    }
                }
                // Time recency bonus (favor more recent items)
                if (lifelog.startTime) {
                    const itemDate = new Date(lifelog.startTime).getTime();
                    const now = Date.now();
                    const daysDiff = (now - itemDate) / (1000 * 60 * 60 * 24);
                    if (daysDiff < 1)
                        score += 3; // Today
                    else if (daysDiff < 7)
                        score += 2; // Last week
                    else if (daysDiff < 30)
                        score += 1; // Last month
                }
                return {
                    lifelog,
                    score,
                    matchCount,
                    snippet: includeSnippets ? snippet : undefined
                };
            }).filter(result => result.score > 0); // Only include results with matches
        }
        // Sort by score (descending)
        results.sort((a, b) => b.score - a.score);
        // Take top results up to limit
        const topResults = results.slice(0, limit);
        if (topResults.length === 0) {
            return {
                content: [{
                        type: "text",
                        text: "No matches found for the specified search terms."
                    }]
            };
        }
        // Format the results
        let resultText = `# Search Results for "${query}"\n\n`;
        resultText += `Found ${results.length} matching lifelogs (showing top ${topResults.length}).\n\n`;
        // The actual results
        topResults.forEach((result, index) => {
            const l = result.lifelog;
            let timeInfo = "";
            if (l.startTime) {
                const startDate = new Date(l.startTime);
                timeInfo = ` (${startDate.toLocaleString()})`;
            }
            resultText += `## ${index + 1}. ${l.title}${timeInfo}\n`;
            resultText += `ID: ${l.id}\n`;
            resultText += `Relevance Score: ${result.score} (${result.matchCount} matches)\n`;
            if (includeSnippets && result.snippet) {
                resultText += `\n> ${result.snippet}\n`;
            }
            resultText += "\n";
        });
        return {
            content: [{
                    type: "text",
                    text: resultText
                }]
        };
    });
    // Helper function to count occurrences of a term in text
    function countOccurrences(text, term) {
        const regex = new RegExp(term, 'gi');
        const matches = text.match(regex);
        return matches ? matches.length : 0;
    }
    // Helper function to extract a relevant snippet
    function extractSnippet(text, term, contextLength = 60) {
        const lowerText = text.toLowerCase();
        const lowerTerm = term.toLowerCase();
        const index = lowerText.indexOf(lowerTerm);
        if (index === -1)
            return "";
        // Find the start of the surrounding sentence or paragraph
        let start = Math.max(0, index - contextLength);
        // Try to start at a sentence boundary
        const sentenceStart = text.lastIndexOf('. ', index);
        if (sentenceStart !== -1 && sentenceStart > start) {
            start = sentenceStart + 2; // +2 to skip the period and space
        }
        // Find the end of the surrounding context
        let end = Math.min(text.length, index + term.length + contextLength);
        // Try to end at a sentence boundary
        const sentenceEnd = text.indexOf('. ', index);
        if (sentenceEnd !== -1 && sentenceEnd < end) {
            end = sentenceEnd + 1; // +1 to include the period
        }
        // Extract the snippet
        let snippet = text.substring(start, end).trim();
        // Add ellipses if we're not at the beginning/end of the text
        if (start > 0)
            snippet = "..." + snippet;
        if (end < text.length)
            snippet = snippet + "...";
        return snippet;
    }
    // Get a specific day's summary
    server.tool("get_day_summary", {
        date: z.string().describe("Date in YYYY-MM-DD format"),
        timezone: z.string().optional().describe("IANA timezone specifier")
    }, async ({ date, timezone = "America/Los_Angeles" }) => {
        const response = await call("/lifelogs", {
            date,
            timezone,
            includeMarkdown: true,
            limit: 25
        });
        const lifelogs = response.data.lifelogs || [];
        if (lifelogs.length === 0) {
            return {
                content: [{
                        type: "text",
                        text: `No lifelogs found for ${date}`
                    }]
            };
        }
        // Format the lifelogs into a summary
        const formattedDate = new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: timezone
        });
        let summary = `# Summary for ${formattedDate}\n\n`;
        summary += `Found ${lifelogs.length} lifelogs for this day.\n\n`;
        lifelogs.forEach((log, index) => {
            const startTime = log.startTime ? new Date(log.startTime).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: timezone
            }) : 'Unknown time';
            summary += `## ${index + 1}. ${log.title} (${startTime})\n`;
            summary += `ID: ${log.id}\n`;
            // Add a brief excerpt if available
            if (log.markdown) {
                const excerpt = log.markdown.substring(0, 150) + (log.markdown.length > 150 ? '...' : '');
                summary += `\n${excerpt}\n\n`;
            }
            summary += `---\n\n`;
        });
        return {
            content: [{
                    type: "text",
                    text: summary
                }]
        };
    });
    // Advanced summarization tool
    server.tool("summarize_lifelog", {
        id: z.string().describe("The ID of the lifelog to summarize"),
        level: z.enum(["brief", "detailed", "comprehensive"]).default("detailed").describe("Level of summarization detail"),
        focus: z.enum(["general", "key_points", "decisions", "questions", "action_items"]).default("general").describe("Focus of the summary")
    }, async ({ id, level, focus }) => {
        try {
            // Check cache first for this summary
            const summaryCacheKey = `summary_${id}_${level}_${focus}`;
            const cachedSummary = cache.get(summaryCacheKey);
            if (cachedSummary) {
                console.error(`Cache hit for summary: ${summaryCacheKey}`);
                return {
                    content: [{
                            type: "text",
                            text: cachedSummary
                        }]
                };
            }
            console.error(`Cache miss for summary: ${summaryCacheKey}`);
            // Get the lifelog data
            const response = await call(`/lifelogs/${id}`);
            const lifelog = response.data.lifelog;
            if (!lifelog || !lifelog.markdown) {
                throw new McpError(ErrorCode.NotFound, `No content found for lifelog with ID: ${id}`, { id });
            }
            // Generate the summary based on the content
            const summary = generateSummary(lifelog, level, focus);
            // Store in cache with a longer TTL since summaries are expensive to regenerate
            // and don't change unless the underlying data changes (which is rare for lifelogs)
            const summaryTtl = CACHE_TTL * CACHE_TTL_MULTIPLIERS.SUMMARIES;
            cache.set(summaryCacheKey, summary, summaryTtl);
            console.error(`Cached summary for ${id} with TTL ${summaryTtl}s`);
            return {
                content: [{
                        type: "text",
                        text: summary
                    }]
            };
        }
        catch (error) {
            console.error(`Error summarizing lifelog ${id}:`, error);
            // If it's already an McpError, rethrow it
            if (error instanceof McpError) {
                throw error;
            }
            // Handle HTTP status errors
            if (error.statusCode) {
                if (error.statusCode === 404) {
                    throw new McpError(`Lifelog with ID ${id} not found`, ErrorCode.NotFound);
                }
                else if (error.statusCode === 401 || error.statusCode === 403) {
                    throw new McpError(`Unauthorized access to Limitless API`, ErrorCode.Unauthorized);
                }
                else if (error.statusCode >= 500) {
                    throw new McpError(`Limitless API service error: ${error.statusCode}`, ErrorCode.ServiceUnavailable);
                }
            }
            // Generic error fallback
            throw new McpError(ErrorCode.Internal, `Error summarizing lifelog ${id}: ${error.message || 'Unknown error'}`, { id });
        }
    });
    // Multi-lifelog summarization tool
    // Topic extraction from lifelogs
    server.tool("extract_topics", {
        ids: z.array(z.string()).describe("Array of lifelog IDs to analyze"),
        maxTopics: z.number().default(10).describe("Maximum number of topics to extract"),
        minOccurrences: z.number().default(3).describe("Minimum occurrences required to include a topic"),
        mode: z.enum(["keywords", "phrases"]).default("keywords").describe("Extraction mode: keywords or phrases"),
        excludeCommonWords: z.boolean().default(true).describe("Whether to exclude common English words")
    }, async ({ ids, maxTopics, minOccurrences, mode, excludeCommonWords }) => {
        if (!ids || ids.length === 0) {
            throw new McpError(ErrorCode.InvalidParams, "Please provide at least one lifelog ID to analyze", { ids });
        }
        try {
            // Generate a cache key based on input parameters
            const sortedIds = [...ids].sort().join(',');
            const topicsCacheKey = `topics_${sortedIds}_${maxTopics}_${minOccurrences}_${mode}_${excludeCommonWords}`;
            // Check if we have cached results
            const cachedTopics = cache.get(topicsCacheKey);
            let topics;
            let lifelogsCount;
            if (cachedTopics) {
                console.error(`Cache hit for topics: ${topicsCacheKey}`);
                topics = cachedTopics.topics;
                lifelogsCount = cachedTopics.lifelogsCount;
            }
            else {
                console.error(`Cache miss for topics: ${topicsCacheKey}`);
                // Fetch all the lifelogs in parallel
                const fetchPromises = ids.map(id => call(`/lifelogs/${id}`));
                const responses = await Promise.all(fetchPromises);
                // Extract and validate the lifelogs
                const lifelogs = responses
                    .map(response => response.data.lifelog)
                    .filter(log => log && log.markdown);
                if (lifelogs.length === 0) {
                    throw new McpError(ErrorCode.NotFound, "None of the provided lifelog IDs contained valid content.", { ids });
                }
                // Extract topics from the lifelogs
                topics = extractTopics(lifelogs, maxTopics, minOccurrences, mode, excludeCommonWords);
                lifelogsCount = lifelogs.length;
                // Cache the results for future use
                // Topic extraction is computationally expensive, so cache for longer duration
                const topicsTtl = CACHE_TTL * CACHE_TTL_MULTIPLIERS.SUMMARIES; // Use same TTL as summaries
                cache.set(topicsCacheKey, { topics, lifelogsCount }, topicsTtl);
                console.error(`Cached topics with TTL ${topicsTtl}s`);
            }
            // Format the response
            let resultText = `# Topics Extracted from ${lifelogsCount} Lifelogs\n\n`;
            if (topics.length === 0) {
                resultText += "No significant topics were found matching the criteria.\n";
            }
            else {
                // Add metadata about the extraction
                resultText += `## Extraction Parameters\n`;
                resultText += `- Mode: ${mode}\n`;
                resultText += `- Minimum occurrences: ${minOccurrences}\n`;
                resultText += `- Common words excluded: ${excludeCommonWords ? "Yes" : "No"}\n\n`;
                // List the topics with their frequency
                resultText += `## ${topics.length} Topics Found\n\n`;
                topics.forEach((topic, index) => {
                    resultText += `${index + 1}. **${topic.name}** - ${topic.count} occurrences\n`;
                });
                // Add usage suggestion
                resultText += `\n_Use these topics to guide further analysis or as search terms._`;
            }
            return {
                content: [{
                        type: "text",
                        text: resultText
                    }]
            };
        }
        catch (error) {
            console.error(`Error extracting topics:`, error);
            // If it's already an McpError, rethrow it
            if (error instanceof McpError) {
                throw error;
            }
            // Generic error fallback
            throw new McpError(ErrorCode.Internal, `Error extracting topics: ${error.message || 'Unknown error'}`, { ids });
        }
    });
    server.tool("summarize_lifelogs", {
        ids: z.array(z.string()).describe("Array of lifelog IDs to summarize"),
        level: z.enum(["brief", "detailed"]).default("brief").describe("Level of summarization detail"),
        combinedView: z.boolean().default(true).describe("Whether to provide a combined summary")
    }, async ({ ids, level, combinedView }) => {
        if (!ids || ids.length === 0) {
            throw new McpError(ErrorCode.InvalidParams, "Please provide at least one lifelog ID to summarize.", { ids });
        }
        try {
            // Generate a cache key for the multi-lifelog summary
            const sortedIds = [...ids].sort().join(',');
            const multiSummaryCacheKey = `multi_summary_${sortedIds}_${level}_${combinedView ? 'combined' : 'separate'}`;
            // Check cache first
            const cachedSummary = cache.get(multiSummaryCacheKey);
            if (cachedSummary) {
                console.error(`Cache hit for multi-lifelog summary: ${multiSummaryCacheKey}`);
                return {
                    content: [{
                            type: "text",
                            text: cachedSummary
                        }]
                };
            }
            console.error(`Cache miss for multi-lifelog summary: ${multiSummaryCacheKey}`);
            // Fetch all the lifelogs in parallel
            const fetchPromises = ids.map(id => call(`/lifelogs/${id}`));
            const responses = await Promise.all(fetchPromises);
            // Extract and validate the lifelogs
            const lifelogs = responses
                .map(response => response.data.lifelog)
                .filter(log => log && log.markdown);
            if (lifelogs.length === 0) {
                throw new McpError(ErrorCode.NotFound, "None of the provided lifelog IDs contained valid content.", { ids });
            }
            // Sort lifelogs by time if available
            lifelogs.sort((a, b) => {
                if (!a.startTime || !b.startTime)
                    return 0;
                return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
            });
            // Generate summary content
            let summaryText = "";
            if (combinedView) {
                // Generate a single combined summary
                const timeRange = getTimeRangeText(lifelogs);
                summaryText = `# Combined Summary of ${lifelogs.length} Lifelogs\n\n`;
                summaryText += timeRange ? `Time Range: ${timeRange}\n\n` : "";
                // Extract all speakers across logs
                const allSpeakers = new Set();
                lifelogs.forEach(log => {
                    if (log.contents) {
                        log.contents.forEach(content => {
                            if (content.speakerName) {
                                allSpeakers.add(content.speakerName);
                            }
                        });
                    }
                });
                if (allSpeakers.size > 0) {
                    summaryText += `Participants: ${Array.from(allSpeakers).join(', ')}\n\n`;
                }
                // Generate the combined summary
                summaryText += generateCombinedSummary(lifelogs, level);
            }
            else {
                // Generate individual summaries
                summaryText = `# Summaries of ${lifelogs.length} Lifelogs\n\n`;
                lifelogs.forEach((log, index) => {
                    const individualSummary = generateSummary(log, level, "general");
                    summaryText += `## ${index + 1}. ${log.title}\n\n${individualSummary}\n\n---\n\n`;
                });
            }
            // Cache the summary results for future use
            const summaryTtl = CACHE_TTL * CACHE_TTL_MULTIPLIERS.SUMMARIES;
            cache.set(multiSummaryCacheKey, summaryText, summaryTtl);
            console.error(`Cached multi-lifelog summary with TTL ${summaryTtl}s`);
            return {
                content: [{
                        type: "text",
                        text: summaryText
                    }]
            };
        }
        catch (error) {
            console.error(`Error summarizing multiple lifelogs:`, error);
            // If it's already an McpError, rethrow it
            if (error instanceof McpError) {
                throw error;
            }
            // Generic error fallback
            throw new McpError(ErrorCode.Internal, `Error summarizing lifelogs: ${error.message || 'Unknown error'}`, { ids });
        }
    });
    // Helper function to extract a time range description
    function getTimeRangeText(lifelogs) {
        if (!lifelogs.length)
            return "";
        // Find earliest start and latest end times
        let earliestStart = null;
        let latestEnd = null;
        lifelogs.forEach(log => {
            if (log.startTime) {
                const startTime = new Date(log.startTime);
                if (!earliestStart || startTime < earliestStart) {
                    earliestStart = startTime;
                }
            }
            if (log.endTime) {
                const endTime = new Date(log.endTime);
                if (!latestEnd || endTime > latestEnd) {
                    latestEnd = endTime;
                }
            }
        });
        if (!earliestStart)
            return ""; // Exit if no start date found
        const startAsDate = earliestStart; // Cast to Date
        // Format the range
        const startText = startAsDate.toLocaleString();
        if (!latestEnd || startAsDate.getTime() === latestEnd.getTime()) {
            return startText;
        }
        const endAsDate = latestEnd; // Cast to Date
        // Check if same day
        const sameDay = startAsDate.toDateString() === endAsDate.toDateString();
        if (sameDay) {
            return `${startAsDate.toLocaleDateString()} from ${startAsDate.toLocaleTimeString()} to ${endAsDate.toLocaleTimeString()}`;
        }
        else {
            return `${startText} to ${endAsDate.toLocaleString()}`;
        }
    }
    // Helper function to generate a summary for a single lifelog
    function generateSummary(lifelog, level, focus) {
        if (!lifelog.markdown)
            return "No content available.";
        let summary = "";
        // Add header with basic metadata
        let formattedTime = "";
        if (lifelog.startTime) {
            const startDate = new Date(lifelog.startTime);
            formattedTime = ` (${startDate.toLocaleString()})`;
        }
        summary += `# Summary of "${lifelog.title}"${formattedTime}\n\n`;
        // Extract different types of content based on focus
        const text = lifelog.markdown;
        const lines = text.split('\n');
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0); // Define sentences here
        // Different strategies based on level of detail
        if (level === "brief") {
            // Very concise summary
            summary += `Brief overview of the content (${Math.round(text.length / 100)} paragraphs)\n\n`;
            // Extract key headings (if any)
            const headings = lines.filter(line => line.startsWith('#')).slice(0, 3);
            if (headings.length > 0) {
                summary += "Key topics:\n";
                headings.forEach(heading => {
                    summary += `- ${heading.replace(/^#+\s*/, '')}\n`;
                });
                summary += "\n";
            }
            // Extract a snippet of the content
            const contentSample = text.substring(0, 300) + (text.length > 300 ? "..." : "");
            summary += contentSample;
        }
        else if (level === "detailed") {
            // More comprehensive summary
            const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
            const contentLength = text.length;
            const wordCount = text.split(/\s+/).length;
            summary += `This lifelog contains approximately ${wordCount} words in ${paragraphs.length} paragraphs.\n\n`;
            // Find speakers if they exist
            if (lifelog.contents) {
                const speakers = new Set();
                lifelog.contents.forEach(content => {
                    if (content.speakerName) {
                        speakers.add(content.speakerName);
                    }
                });
                if (speakers.size > 0) {
                    summary += `Participants: ${Array.from(speakers).join(', ')}\n\n`;
                }
            }
            // Focus-specific content extraction
            switch (focus) {
                case "key_points":
                    // Try to extract key points
                    summary += "## Key Points\n\n";
                    // Look for likely key points (bullet points, short paragraphs, sentences with key phrases)
                    const bulletPoints = lines.filter(line => line.trim().match(/^[•*-]\s+/));
                    if (bulletPoints.length > 0) {
                        bulletPoints.slice(0, 5).forEach(point => {
                            summary += point + "\n";
                        });
                        summary += "\n";
                    }
                    else {
                        // Extract sentences that might contain key points
                        const keyPhrases = ["key point", "important", "critical", "essential", "noteworthy", "significant"];
                        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
                        const keyPointSentences = sentences.filter(sentence => keyPhrases.some(phrase => sentence.toLowerCase().includes(phrase)));
                        if (keyPointSentences.length > 0) {
                            keyPointSentences.slice(0, 5).forEach(sentence => {
                                summary += `- ${sentence.trim()}\n`; // Removed extra period
                            });
                        }
                        else {
                            // Fall back to first few paragraphs
                            summary += paragraphs.slice(0, 2).join("\n\n");
                        }
                    }
                    break;
                case "decisions":
                    summary += "## Decisions & Conclusions\n\n";
                    // Look for sentences that indicate decisions
                    const decisionPhrases = ["decided", "agreed", "concluded", "determined", "resolved", "approved", "finalized"];
                    const decisionSentences = sentences.filter(sentence => decisionPhrases.some(phrase => sentence.toLowerCase().includes(phrase)));
                    if (decisionSentences.length > 0) {
                        decisionSentences.forEach(sentence => {
                            summary += `- ${sentence.trim()}\n`; // Removed extra period
                        });
                    }
                    else {
                        summary += "No explicit decisions were identified in this content.\n";
                    }
                    break;
                case "questions":
                    summary += "## Questions\n\n";
                    // Extract sentences with question marks
                    const questions = sentences.filter(s => s.includes('?'));
                    if (questions.length > 0) {
                        questions.forEach(question => {
                            summary += `- ${question.trim()}\n`; // Removed extra question mark
                        });
                    }
                    else {
                        summary += "No explicit questions were identified in this content.\n";
                    }
                    break;
                case "action_items":
                    summary += "## Action Items\n\n";
                    // Look for sentences that indicate actions to be taken
                    const actionPhrases = ["will", "should", "need to", "going to", "must", "task", "action item", "todo", "to-do"];
                    const actionSentences = sentences.filter(sentence => actionPhrases.some(phrase => sentence.toLowerCase().includes(phrase)));
                    if (actionSentences.length > 0) {
                        actionSentences.forEach(sentence => {
                            summary += `- ${sentence.trim()}\n`; // Removed extra period
                        });
                    }
                    else {
                        summary += "No explicit action items were identified in this content.\n";
                    }
                    break;
                case "general":
                default:
                    // General overview
                    summary += "## Overview\n\n";
                    // Include beginning and end of content
                    if (paragraphs.length > 4) {
                        // First paragraph as introduction
                        summary += paragraphs[0] + "\n\n";
                        // Middle content summary
                        summary += `[...${paragraphs.length - 2} additional paragraphs...]\n\n`;
                        // Last paragraph as conclusion
                        summary += paragraphs[paragraphs.length - 1] + "\n";
                    }
                    else {
                        // For shorter content, include all paragraphs
                        summary += paragraphs.join("\n\n");
                    }
                    break;
            }
        }
        else if (level === "comprehensive") {
            // Most detailed summary
            const contentLength = text.length;
            const wordCount = text.split(/\s+/).length;
            const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
            summary += `## Metadata\n\n`;
            summary += `- **Word Count**: ~${wordCount} words\n`;
            summary += `- **Paragraphs**: ${paragraphs.length}\n`;
            summary += `- **Content Length**: ${contentLength} characters\n\n`;
            // Add duration if available
            if (lifelog.startTime && lifelog.endTime) {
                const start = new Date(lifelog.startTime).getTime();
                const end = new Date(lifelog.endTime).getTime();
                const durationMs = end - start;
                const minutes = Math.floor(durationMs / 60000);
                const seconds = Math.floor((durationMs % 60000) / 1000);
                summary += `- **Duration**: ${minutes}m ${seconds}s\n\n`;
            }
            // Extract speakers if available
            if (lifelog.contents) {
                const speakers = new Set();
                lifelog.contents.forEach(content => {
                    if (content.speakerName) {
                        speakers.add(content.speakerName);
                    }
                });
                if (speakers.size > 0) {
                    summary += `- **Participants**: ${Array.from(speakers).join(', ')}\n\n`;
                }
            }
            // Extract section headings
            const headings = lines
                .filter(line => line.match(/^#+\s+/))
                .map(line => line.replace(/^(#+)\s+(.*)$/, (_, hashes, title) => {
                const level = hashes.length;
                return `${'  '.repeat(level - 1)}- ${title.trim()}`;
            }));
            if (headings.length > 0) {
                summary += `## Content Structure\n\n`;
                summary += headings.join('\n') + '\n\n';
            }
            // Focus-specific detailed content
            switch (focus) {
                case "key_points":
                    summary += "## Key Points\n\n";
                    // Extract potential key points with more context
                    const bulletPoints = lines.filter(line => line.trim().match(/^[•*-]\s+/));
                    if (bulletPoints.length > 0) {
                        bulletPoints.forEach(point => {
                            summary += point + "\n";
                        });
                    }
                    else {
                        // Try extracting from paragraphs
                        const contentSample = paragraphs
                            .slice(0, Math.min(5, paragraphs.length))
                            .join("\n\n");
                        summary += contentSample;
                    }
                    break;
                case "general":
                default:
                    // For comprehensive general summary, include a representative sample
                    summary += "## Content Sample\n\n";
                    // First 20% and last 20% of paragraphs
                    const firstPortion = Math.ceil(paragraphs.length * 0.2);
                    const lastPortion = Math.ceil(paragraphs.length * 0.2);
                    if (paragraphs.length > 10) {
                        // Include beginning
                        summary += paragraphs.slice(0, firstPortion).join("\n\n");
                        // Middle indicator
                        summary += `\n\n[...${paragraphs.length - firstPortion - lastPortion} additional paragraphs...]\n\n`;
                        // Include end
                        if (lastPortion > 0) {
                            summary += paragraphs.slice(-lastPortion).join("\n\n");
                        }
                    }
                    else {
                        // For shorter content, include all
                        summary += paragraphs.join("\n\n");
                    }
                    break;
            }
        }
        return summary;
    }
    // Helper function to generate a combined summary for multiple lifelogs
    function generateCombinedSummary(lifelogs, level) {
        if (lifelogs.length === 0)
            return "No content available.";
        let summary = "";
        // Total stats
        const totalContent = lifelogs.reduce((acc, log) => acc + (log.markdown?.length || 0), 0);
        const totalWordCount = lifelogs.reduce((acc, log) => {
            return acc + (log.markdown?.split(/\s+/).length || 0);
        }, 0);
        summary += `## Overview\n\n`;
        summary += `This is a summary of ${lifelogs.length} lifelogs containing approximately ${totalWordCount} words.\n\n`;
        // For brief level, just list the lifelogs with minimal info
        if (level === "brief") {
            summary += "## Included Lifelogs\n\n";
            lifelogs.forEach((log, index) => {
                let timeInfo = "";
                if (log.startTime) {
                    const startDate = new Date(log.startTime);
                    timeInfo = ` (${startDate.toLocaleTimeString()})`;
                }
                summary += `${index + 1}. **${log.title}**${timeInfo} - ID: \`${log.id}\`\n`;
                // Add a very brief snippet of content
                if (log.markdown) {
                    const snippet = log.markdown.substring(0, 100).replace(/\n/g, ' ');
                    summary += `   ${snippet}${log.markdown.length > 100 ? '...' : ''}\n\n`;
                }
            });
            // Add a basic topic analysis even in brief mode
            const topics = extractTopics(lifelogs, 5);
            if (topics.length > 0) {
                summary += `## Key Topics\n\n`;
                summary += topics.map(topic => `- ${topic.name} (mentioned ${topic.count} times)`).join('\n') + '\n\n';
            }
        }
        else {
            // For detailed level, provide more comprehensive info
            summary += "## Summary by Lifelog\n\n";
            lifelogs.forEach((log, index) => {
                let timeInfo = "";
                if (log.startTime) {
                    const startDate = new Date(log.startTime);
                    timeInfo = ` (${startDate.toLocaleString()})`;
                }
                summary += `### ${index + 1}. ${log.title}${timeInfo}\n`;
                summary += `ID: \`${log.id}\`\n\n`;
                // Extract speakers if available
                if (log.contents) {
                    const speakers = new Set();
                    log.contents.forEach(content => {
                        if (content.speakerName) {
                            speakers.add(content.speakerName);
                        }
                    });
                    if (speakers.size > 0) {
                        summary += `Participants: ${Array.from(speakers).join(', ')}\n\n`;
                    }
                }
                // Add content overview
                if (log.markdown) {
                    const paragraphs = log.markdown.split('\n\n').filter(p => p.trim().length > 0);
                    const wordCount = log.markdown.split(/\s+/).length;
                    summary += `Contains ${wordCount} words in ${paragraphs.length} paragraphs.\n\n`;
                    // Add individual topics for this log
                    const individualTopics = extractTopics([log], 3);
                    if (individualTopics.length > 0) {
                        summary += `Topics: ${individualTopics.map(t => t.name).join(', ')}\n\n`;
                    }
                    // Add a content sample
                    if (paragraphs.length > 0) {
                        const firstPara = paragraphs[0].substring(0, 200);
                        summary += firstPara + (paragraphs[0].length > 200 ? '...' : '') + '\n\n';
                    }
                }
            });
            // Add a detailed theme analysis section
            const topics = extractTopics(lifelogs, 10);
            if (topics.length > 0) {
                summary += `## Topic Analysis\n\n`;
                // Create a table of topics
                summary += `| Topic | Occurrences | Found In |\n`;
                summary += `| --- | --- | --- |\n`;
                topics.forEach(topic => {
                    // Calculate in how many lifelogs this topic appears
                    const logsWithTopic = lifelogs.filter(log => log.markdown?.toLowerCase().includes(topic.name.toLowerCase())).length;
                    const percentage = Math.round((logsWithTopic / lifelogs.length) * 100);
                    summary += `| ${topic.name} | ${topic.count} | ${logsWithTopic}/${lifelogs.length} (${percentage}%) |\n`;
                });
                summary += '\n';
                // Add topic correlations (which topics appear together)
                summary += `### Topic Relationships\n\n`;
                // Find the top 5 topics for correlation analysis
                const topTopics = topics.slice(0, Math.min(5, topics.length));
                if (topTopics.length > 1) {
                    const correlations = [];
                    // Calculate how often each pair of topics appears in the same lifelog
                    for (let i = 0; i < topTopics.length; i++) {
                        for (let j = i + 1; j < topTopics.length; j++) {
                            const topic1 = topTopics[i].name;
                            const topic2 = topTopics[j].name;
                            // Count logs where both topics appear
                            const coOccurrences = lifelogs.filter(log => log.markdown?.toLowerCase().includes(topic1.toLowerCase()) &&
                                log.markdown?.toLowerCase().includes(topic2.toLowerCase())).length;
                            if (coOccurrences > 0) {
                                correlations.push({
                                    topic1,
                                    topic2,
                                    strength: coOccurrences
                                });
                            }
                        }
                    }
                    // Report top correlations
                    if (correlations.length > 0) {
                        correlations.sort((a, b) => b.strength - a.strength);
                        correlations.slice(0, 5).forEach(corr => {
                            summary += `- "${corr.topic1}" and "${corr.topic2}" appear together in ${corr.strength} lifelogs\n`;
                        });
                        summary += '\n';
                    }
                    else {
                        summary += "No significant topic correlations found.\n\n";
                    }
                }
            }
            else {
                summary += `## Topic Analysis\n\nNo significant topics identified across these lifelogs.\n\n`;
            }
        }
        return summary;
    }
    // Topic extraction tool
    server.tool("extract_topics", {
        ids: z.array(z.string()).describe("Array of lifelog IDs to analyze"),
        maxTopics: z.number().default(10).describe("Maximum number of topics to extract"),
        minOccurrences: z.number().default(3).describe("Minimum occurrences required to include a topic"),
        mode: z.enum(["keywords", "phrases"]).default("keywords").describe("Extraction mode: keywords or phrases"),
        excludeCommonWords: z.boolean().default(true).describe("Whether to exclude common English words")
    }, async ({ ids, maxTopics, minOccurrences, mode, excludeCommonWords }) => {
        if (!ids || ids.length === 0) {
            return {
                content: [{
                        type: "text",
                        text: "Please provide at least one lifelog ID to analyze."
                    }]
            };
        }
        try {
            // Fetch all the lifelogs in parallel
            const fetchPromises = ids.map(id => call(`/lifelogs/${id}`));
            const responses = await Promise.all(fetchPromises);
            // Extract and validate the lifelogs
            const lifelogs = responses
                .map(response => response.data.lifelog)
                .filter(log => log && log.markdown);
            if (lifelogs.length === 0) {
                return {
                    content: [{
                            type: "text",
                            text: "None of the provided lifelog IDs contained valid content."
                        }]
                };
            }
            // Extract topics
            const topics = extractTopics(lifelogs, maxTopics, minOccurrences, mode, excludeCommonWords);
            if (topics.length === 0) {
                return {
                    content: [{
                            type: "text",
                            text: "No significant topics could be extracted from the provided lifelogs."
                        }]
                };
            }
            // Format the response
            let resultText = `# Topic Analysis for ${lifelogs.length} Lifelogs\n\n`;
            // Add lifelog info
            resultText += `## Analyzed Lifelogs\n\n`;
            lifelogs.forEach((log, index) => {
                let timeInfo = "";
                if (log.startTime) {
                    const startDate = new Date(log.startTime);
                    timeInfo = ` (${startDate.toLocaleString()})`;
                }
                resultText += `${index + 1}. **${log.title}**${timeInfo} - ID: \`${log.id}\`\n`;
            });
            resultText += "\n";
            // Add topic table
            resultText += `## Extracted Topics\n\n`;
            resultText += `| Topic | Occurrences | Relevance Score |\n`;
            resultText += `| --- | --- | --- |\n`;
            topics.forEach(topic => {
                resultText += `| ${topic.name} | ${topic.count} | ${topic.score.toFixed(2)} |\n`;
            });
            // Add topic distribution by lifelog
            resultText += `\n## Topic Distribution\n\n`;
            lifelogs.forEach((log, logIndex) => {
                resultText += `### ${logIndex + 1}. ${log.title}\n\n`;
                // Find topics in this log
                const logTopics = topics.filter(topic => log.markdown?.toLowerCase().includes(topic.name.toLowerCase())).slice(0, 5); // Top 5 topics per log
                if (logTopics.length > 0) {
                    logTopics.forEach(topic => {
                        // Count occurrences in this specific log
                        const regex = new RegExp(escapeRegExp(topic.name), 'gi');
                        const matches = log.markdown?.match(regex);
                        const count = matches ? matches.length : 0;
                        resultText += `- ${topic.name}: ${count} occurrences\n`;
                    });
                }
                else {
                    resultText += "No significant topics found in this lifelog.\n";
                }
                resultText += "\n";
            });
            return {
                content: [{
                        type: "text",
                        text: resultText
                    }]
            };
        }
        catch (error) {
            console.error(`Error extracting topics:`, error);
            return {
                content: [{
                        type: "text",
                        text: `Error extracting topics. Please check if all IDs are correct.`
                    }]
            };
        }
    });
    // Helper function to extract topics from lifelogs
    function extractTopics(lifelogs, maxTopics = 10, minOccurrences = 3, mode = "keywords", excludeCommonWords = true) {
        if (lifelogs.length === 0)
            return [];
        // Common English words to exclude if requested
        const commonWords = new Set([
            "about", "after", "again", "also", "another", "back", "because", "been", "before",
            "being", "between", "both", "cannot", "could", "does", "during", "each", "either",
            "every", "first", "from", "going", "great", "have", "having", "here", "into", "just",
            "like", "more", "most", "much", "must", "never", "only", "other", "over", "same",
            "should", "since", "some", "still", "such", "than", "that", "their", "them", "then",
            "there", "these", "they", "this", "those", "through", "under", "very", "well", "were",
            "what", "when", "where", "which", "while", "will", "with", "would", "your"
        ]);
        // Combine all content
        const allContent = lifelogs.map(log => log.markdown || "").join(" ");
        let topics = [];
        if (mode === "keywords") {
            // Extract individual keywords
            const words = allContent.toLowerCase().split(/\W+/).filter(word => word.length > 4 &&
                (!excludeCommonWords || !commonWords.has(word)));
            // Count word frequency
            const wordFrequency = {};
            words.forEach(word => {
                wordFrequency[word] = (wordFrequency[word] || 0) + 1;
            });
            // Filter by minimum occurrences
            topics = Object.entries(wordFrequency)
                .filter(([_, count]) => count >= minOccurrences)
                .map(([word, count]) => {
                // Calculate a relevance score
                // TF (Term Frequency) * document frequency (in how many lifelogs it appears)
                const docsWithTerm = lifelogs.filter(log => log.markdown?.toLowerCase().includes(word.toLowerCase())).length;
                const tf = count / words.length; // Term frequency
                const idf = Math.log(lifelogs.length / (1 + docsWithTerm)); // Inverse document frequency
                const tfidf = tf * idf;
                // Final score combines raw count and TF-IDF
                const score = (count * 0.5) + (tfidf * 100);
                return {
                    name: word,
                    count,
                    score
                };
            })
                .sort((a, b) => b.score - a.score)
                .slice(0, maxTopics);
        }
        else if (mode === "phrases") {
            // Extract frequent phrases (2-3 words)
            const text = allContent.toLowerCase();
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
            // Generate n-grams (phrases of 2-3 words)
            const phrases = {};
            sentences.forEach(sentence => {
                const words = sentence.split(/\W+/).filter(w => w.length > 2 && (!excludeCommonWords || !commonWords.has(w)));
                // Generate 2-word phrases
                for (let i = 0; i < words.length - 1; i++) {
                    const phrase = `${words[i]} ${words[i + 1]}`;
                    phrases[phrase] = (phrases[phrase] || 0) + 1;
                }
                // Generate 3-word phrases
                for (let i = 0; i < words.length - 2; i++) {
                    const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
                    phrases[phrase] = (phrases[phrase] || 0) + 1;
                }
            });
            // Filter by minimum occurrences and length
            topics = Object.entries(phrases)
                .filter(([phrase, count]) => count >= minOccurrences &&
                phrase.length > 5 &&
                !commonPhrases.some(common => phrase.includes(common)))
                .map(([phrase, count]) => {
                // Calculate how many lifelogs contain this phrase
                const docsWithPhrase = lifelogs.filter(log => log.markdown?.toLowerCase().includes(phrase.toLowerCase())).length;
                // Score based on count, phrase length, and document frequency
                const score = count * (phrase.length / 10) * (docsWithPhrase / lifelogs.length);
                return {
                    name: phrase,
                    count,
                    score
                };
            })
                .sort((a, b) => b.score - a.score)
                .slice(0, maxTopics);
        }
        return topics;
    }
    // Common phrases to exclude from topic extraction
    const commonPhrases = [
        "going to", "able to", "want to", "need to", "trying to",
        "would be", "could be", "will be", "should be", "might be",
        "this is", "that is", "there is", "these are", "those are",
        "it is", "they are", "we are", "you are", "i am"
    ];
    // Helper function to escape special regex characters
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    // Sentiment analysis tool
    server.tool("analyze_sentiment", {
        id: z.string().describe("The ID of the lifelog to analyze sentiment for"),
        bySpeaker: z.boolean().default(true).describe("Whether to analyze sentiment by speaker"),
        includeSentences: z.boolean().default(false).describe("Whether to include individual sentences in the analysis")
    }, async ({ id, bySpeaker, includeSentences }) => {
        try {
            // Get the lifelog data
            const response = await call(`/lifelogs/${id}`);
            const lifelog = response.data.lifelog;
            if (!lifelog || !lifelog.contents) {
                return {
                    content: [{
                            type: "text",
                            text: `No content found for lifelog with ID: ${id}`
                        }]
                };
            }
            // Format the response
            let resultText = `# Sentiment Analysis for "${lifelog.title}"\n\n`;
            let timeInfo = "";
            if (lifelog.startTime) {
                const startDate = new Date(lifelog.startTime);
                timeInfo = ` (${startDate.toLocaleString()})`;
            }
            resultText += `ID: \`${lifelog.id}\`${timeInfo}\n\n`;
            // Overall sentiment
            const overallSentiment = analyzeSentiment(lifelog.markdown || "");
            resultText += `## Overall Sentiment\n\n`;
            resultText += `- **Score**: ${overallSentiment.score.toFixed(2)} (${getSentimentDescription(overallSentiment.score)})\n`;
            resultText += `- **Positive Words**: ${overallSentiment.positiveWords.slice(0, 10).join(", ")}\n`;
            resultText += `- **Negative Words**: ${overallSentiment.negativeWords.slice(0, 10).join(", ")}\n\n`;
            // Sentiment by speaker if requested
            if (bySpeaker && lifelog.contents) {
                const speakerMap = new Map();
                // Group content by speaker
                lifelog.contents.forEach(content => {
                    if (content.speakerName && content.content) {
                        if (!speakerMap.has(content.speakerName)) {
                            speakerMap.set(content.speakerName, []);
                        }
                        speakerMap.get(content.speakerName)?.push(content.content);
                    }
                });
                if (speakerMap.size > 0) {
                    resultText += `## Sentiment by Speaker\n\n`;
                    // Analyze each speaker
                    for (const [speaker, texts] of speakerMap.entries()) {
                        const combinedText = texts.join(" ");
                        const speakerSentiment = analyzeSentiment(combinedText);
                        resultText += `### ${speaker}\n\n`;
                        resultText += `- **Score**: ${speakerSentiment.score.toFixed(2)} (${getSentimentDescription(speakerSentiment.score)})\n`;
                        resultText += `- **Word Count**: ${combinedText.split(/\s+/).length}\n`;
                        resultText += `- **Top Positive**: ${speakerSentiment.positiveWords.slice(0, 5).join(", ")}\n`;
                        resultText += `- **Top Negative**: ${speakerSentiment.negativeWords.slice(0, 5).join(", ")}\n\n`;
                    }
                }
            }
            // Include sentence-level analysis if requested
            if (includeSentences && lifelog.markdown) {
                resultText += `## Sentence-Level Analysis\n\n`;
                const sentences = lifelog.markdown.split(/[.!?]+/).filter(s => s.trim().length > 10);
                // Limit to most positive and most negative sentences
                const sentimentScores = sentences.map(sentence => {
                    const sentiment = analyzeSentiment(sentence);
                    return {
                        sentence: sentence.trim(),
                        score: sentiment.score
                    };
                });
                // Sort by score
                sentimentScores.sort((a, b) => b.score - a.score);
                // Get top 3 most positive
                resultText += `### Most Positive Sentences\n\n`;
                sentimentScores.slice(0, 3).forEach(item => {
                    resultText += `- "${item.sentence}" (${item.score.toFixed(2)})\n`;
                });
                resultText += `\n### Most Negative Sentences\n\n`;
                // Get top 3 most negative
                sentimentScores.slice(-3).reverse().forEach(item => {
                    resultText += `- "${item.sentence}" (${item.score.toFixed(2)})\n`;
                });
            }
            return {
                content: [{
                        type: "text",
                        text: resultText
                    }]
            };
        }
        catch (error) {
            console.error(`Error analyzing sentiment for lifelog ${id}:`, error);
            return {
                content: [{
                        type: "text",
                        text: `Error analyzing sentiment for lifelog ${id}. Please check if the ID is correct.`
                    }]
            };
        }
    });
    // Multi-lifelog sentiment comparison tool
    server.tool("compare_sentiment", {
        ids: z.array(z.string()).describe("Array of lifelog IDs to compare sentiment"),
        bySpeaker: z.boolean().default(false).describe("Whether to compare sentiment by speaker across lifelogs")
    }, async ({ ids, bySpeaker }) => {
        if (!ids || ids.length < 2) {
            return {
                content: [{
                        type: "text",
                        text: "Please provide at least two lifelog IDs to compare."
                    }]
            };
        }
        try {
            // Fetch all the lifelogs in parallel
            const fetchPromises = ids.map(id => call(`/lifelogs/${id}`));
            const responses = await Promise.all(fetchPromises);
            // Extract and validate the lifelogs
            const lifelogs = responses
                .map(response => response.data.lifelog)
                .filter(log => log && log.markdown);
            if (lifelogs.length < 2) {
                return {
                    content: [{
                            type: "text",
                            text: "At least two valid lifelogs are needed for comparison. Please check the provided IDs."
                        }]
                };
            }
            // Format the response
            let resultText = `# Sentiment Comparison for ${lifelogs.length} Lifelogs\n\n`;
            // Create sentiment scores table
            resultText += `## Overall Sentiment Comparison\n\n`;
            resultText += `| Lifelog | Date | Sentiment Score | Description |\n`;
            resultText += `| --- | --- | --- | --- |\n`;
            // Analyze each lifelog
            const sentimentData = lifelogs.map(log => {
                const sentiment = analyzeSentiment(log.markdown || "");
                let date = "";
                if (log.startTime) {
                    date = new Date(log.startTime).toLocaleDateString();
                }
                return {
                    title: log.title,
                    id: log.id,
                    date,
                    sentiment
                };
            });
            // Sort by sentiment score (descending)
            sentimentData.sort((a, b) => b.sentiment.score - a.sentiment.score);
            // Add to table
            sentimentData.forEach(data => {
                resultText += `| ${data.title} | ${data.date} | ${data.sentiment.score.toFixed(2)} | ${getSentimentDescription(data.sentiment.score)} |\n`;
            });
            // Add visualization
            resultText += `\n## Sentiment Trends\n\n`;
            resultText += `\`\`\`\n`;
            // Basic ASCII chart
            sentimentData.forEach(data => {
                const score = data.sentiment.score;
                const bars = Math.round((score + 10) * 3); // Scale -10 to +10 into roughly 0-60 bars
                const barChar = score >= 0 ? '█' : '▒';
                const line = `${data.title.padEnd(25, ' ')} | ${''.padStart(bars, barChar)} ${score.toFixed(2)}`;
                resultText += line + '\n';
            });
            resultText += `\`\`\`\n\n`;
            // Speaker comparison if requested
            if (bySpeaker) {
                const speakerData = new Map();
                // Extract sentiment by speaker for each lifelog
                lifelogs.forEach(log => {
                    if (!log.contents)
                        return;
                    const speakerMap = new Map();
                    // Group content by speaker
                    log.contents.forEach(content => {
                        if (content.speakerName && content.content) {
                            if (!speakerMap.has(content.speakerName)) {
                                speakerMap.set(content.speakerName, []);
                            }
                            speakerMap.get(content.speakerName)?.push(content.content);
                        }
                    });
                    // Calculate sentiment for each speaker
                    for (const [speaker, texts] of speakerMap.entries()) {
                        const combinedText = texts.join(" ");
                        const sentiment = analyzeSentiment(combinedText);
                        if (!speakerData.has(speaker)) {
                            speakerData.set(speaker, { scores: [], titles: [] });
                        }
                        speakerData.get(speaker)?.scores.push(sentiment.score);
                        speakerData.get(speaker)?.titles.push(log.title);
                    }
                });
                if (speakerData.size > 0) {
                    resultText += `## Sentiment by Speaker\n\n`;
                    for (const [speaker, data] of speakerData.entries()) {
                        if (data.scores.length < 2)
                            continue; // Skip speakers who only appear in one lifelog
                        resultText += `### ${speaker}\n\n`;
                        // Calculate trend
                        const avgScore = data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length;
                        const firstScore = data.scores[0];
                        const lastScore = data.scores[data.scores.length - 1];
                        const trend = lastScore - firstScore;
                        resultText += `- **Average Score**: ${avgScore.toFixed(2)}\n`;
                        resultText += `- **Trend**: ${trend > 0 ? "Improving" : trend < 0 ? "Declining" : "Stable"} (${trend.toFixed(2)})\n\n`;
                        // Show scores in each lifelog
                        resultText += `| Lifelog | Sentiment Score | Description |\n`;
                        resultText += `| --- | --- | --- |\n`;
                        data.titles.forEach((title, index) => {
                            const score = data.scores[index];
                            resultText += `| ${title} | ${score.toFixed(2)} | ${getSentimentDescription(score)} |\n`;
                        });
                        resultText += '\n';
                    }
                }
            }
            // Common positive and negative words
            const allPositive = new Set();
            const allNegative = new Set();
            sentimentData.forEach(data => {
                data.sentiment.positiveWords.forEach(word => allPositive.add(word));
                data.sentiment.negativeWords.forEach(word => allNegative.add(word));
            });
            resultText += `## Common Words\n\n`;
            resultText += `- **Positive**: ${Array.from(allPositive).slice(0, 15).join(", ")}\n`;
            resultText += `- **Negative**: ${Array.from(allNegative).slice(0, 15).join(", ")}\n`;
            return {
                content: [{
                        type: "text",
                        text: resultText
                    }]
            };
        }
        catch (error) {
            console.error(`Error comparing sentiment:`, error);
            return {
                content: [{
                        type: "text",
                        text: `Error comparing sentiment. Please check if all IDs are correct.`
                    }]
            };
        }
    });
    // Sentiment Analysis implementation
    function analyzeSentiment(text) {
        // Basic positive and negative word lists
        const positiveWords = new Set([
            "good", "great", "excellent", "amazing", "wonderful", "fantastic", "awesome",
            "happy", "joy", "love", "like", "best", "better", "success", "successful",
            "improve", "improvement", "positive", "beneficial", "benefit", "perfect",
            "interesting", "impressive", "excited", "exciting", "helpful", "pleased",
            "appreciate", "appreciated", "appreciative", "glad", "delighted", "satisfied",
            "enjoy", "enjoyed", "enjoying", "enjoyable", "favorable", "fortunate",
            "beautiful", "brilliant", "innovative", "innovation", "exceptional",
            "accomplishment", "accomplish", "achieved", "achievement", "progress",
            "resolved", "resolution", "solution", "solved", "effective", "efficient",
            "clarity", "clear", "valuable", "nice", "grateful"
        ]);
        const negativeWords = new Set([
            "bad", "terrible", "awful", "horrible", "poor", "worst", "negative",
            "disappointed", "disappointing", "disappointment", "sad", "unhappy",
            "hate", "dislike", "worry", "worried", "anxious", "anxiety", "fear",
            "problem", "issue", "trouble", "difficult", "difficulty", "fail", "failed",
            "failure", "error", "mistake", "wrong", "unfortunately", "unfortunate",
            "concerned", "concern", "confusing", "confused", "confusion", "frustrating",
            "frustrated", "frustration", "annoying", "annoyed", "sorry", "regret",
            "angry", "upset", "broken", "damage", "damaged", "complaint", "complain",
            "slow", "complex", "complicated", "useless", "waste", "wasted", "inefficient",
            "ineffective", "impossible", "hard", "severe", "severe", "painful", "critical"
        ]);
        // Negation words that flip sentiment
        const negationWords = new Set([
            "not", "no", "never", "don't", "doesn't", "didn't", "won't", "wouldn't",
            "can't", "cannot", "couldn't", "shouldn't", "isn't", "aren't", "wasn't",
            "weren't", "haven't", "hasn't", "neither", "nor"
        ]);
        // Intensity modifiers
        const intensifiers = new Map([
            ["very", 1.5],
            ["really", 1.5],
            ["extremely", 2],
            ["incredibly", 2],
            ["absolutely", 2],
            ["completely", 1.8],
            ["highly", 1.5],
            ["totally", 1.7],
            ["utterly", 1.8],
            ["quite", 1.2],
            ["somewhat", 0.8],
            ["slightly", 0.5],
            ["barely", 0.3],
            ["hardly", 0.3],
            ["kind of", 0.6],
            ["sort of", 0.6]
        ]);
        // Tokenize text
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 1);
        let score = 0;
        const foundPositive = [];
        const foundNegative = [];
        // Scan the text for sentiment words
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            let localScore = 0;
            let multiplier = 1;
            // Check for intensifiers in previous position
            if (i > 0) {
                const prevWord = words[i - 1];
                if (intensifiers.has(prevWord)) {
                    multiplier = intensifiers.get(prevWord) || 1;
                }
                // Check for two-word intensifiers
                if (i > 1) {
                    const twoWordIntensifier = `${words[i - 2]} ${prevWord}`;
                    if (intensifiers.has(twoWordIntensifier)) {
                        multiplier = intensifiers.get(twoWordIntensifier) || 1;
                    }
                }
            }
            // Check for negation within 3 words before
            let isNegated = false;
            for (let j = Math.max(0, i - 3); j < i; j++) {
                if (negationWords.has(words[j])) {
                    isNegated = true;
                    break;
                }
            }
            // Score positive words
            if (positiveWords.has(word)) {
                localScore = 1 * multiplier;
                if (isNegated) {
                    localScore *= -1; // Flip to negative if negated
                    foundNegative.push(word);
                }
                else {
                    foundPositive.push(word);
                }
            }
            // Score negative words
            else if (negativeWords.has(word)) {
                localScore = -1 * multiplier;
                if (isNegated) {
                    localScore *= -1; // Flip to positive if negated
                    foundPositive.push(word);
                }
                else {
                    foundNegative.push(word);
                }
            }
            score += localScore;
        }
        // Normalize score to a -10 to +10 scale
        const wordCount = words.length;
        if (wordCount > 0) {
            // Scale based on text length and number of sentiment words
            const sentimentWordCount = foundPositive.length + foundNegative.length;
            const normalizer = Math.sqrt(Math.min(wordCount, 1000) / 200); // Square root to dampen effect
            score = (score / normalizer);
            // Clamp to -10 to +10 range
            score = Math.max(-10, Math.min(10, score));
        }
        // Count occurrences of each word
        const positiveWordCounts = {};
        const negativeWordCounts = {};
        foundPositive.forEach(word => {
            positiveWordCounts[word] = (positiveWordCounts[word] || 0) + 1;
        });
        foundNegative.forEach(word => {
            negativeWordCounts[word] = (negativeWordCounts[word] || 0) + 1;
        });
        // Sort by count (descending)
        const sortedPositive = Object.entries(positiveWordCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([word]) => word);
        const sortedNegative = Object.entries(negativeWordCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([word]) => word);
        return {
            score,
            positiveWords: sortedPositive,
            negativeWords: sortedNegative
        };
    }
    // Helper to convert sentiment score to a descriptive label
    function getSentimentDescription(score) {
        if (score >= 8)
            return "Extremely Positive";
        if (score >= 6)
            return "Very Positive";
        if (score >= 4)
            return "Positive";
        if (score >= 2)
            return "Somewhat Positive";
        if (score > 0)
            return "Slightly Positive";
        if (score === 0)
            return "Neutral";
        if (score > -2)
            return "Slightly Negative";
        if (score > -4)
            return "Somewhat Negative";
        if (score > -6)
            return "Negative";
        if (score > -8)
            return "Very Negative";
        return "Extremely Negative";
    }
    // ──────────────────────────────────────────────────────────────────────────────
    // 4. Initialize plugins
    // ──────────────────────────────────────────────────────────────────────────────
    try {
        // Plugin system is initialized with the server instance
        await initializePlugins(server);
        console.error("Plugins initialized successfully");
    }
    catch (error) {
        console.error("Error initializing plugins:", error);
    }
    // ──────────────────────────────────────────────────────────────────────────────
    // 5. Start the server over stdio (Claude / VS Code / etc. expect this)
    // ──────────────────────────────────────────────────────────────────────────────
    try {
        await server.connect(new StdioServerTransport());
        // Log to stderr instead of stdout to avoid interfering with JSON communication
        console.error("Server connected successfully");
    }
    catch (error) {
        console.error("Failed to connect server:", error);
        process.exit(1);
    }
}
// Execute the main function
main().catch(error => {
    console.error("Unhandled error:", error);
    process.exit(1);
});
