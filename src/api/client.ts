/**
 * API client for the Limitless API
 */
import { request } from 'undici';
import { McpError, ErrorCode } from '../utils/errors';
import { LifelogResponse } from '../types';
import config from '../config';
import cache, { calculateTTL, getCacheTags } from '../cache';

/**
 * Build a cache key from a path and query parameters
 */
function buildCacheKey(path: string, qs: Record<string, unknown>): string {
  const cacheParams = new URLSearchParams();
  // Sort keys for consistent cache key generation
  Object.keys(qs).sort().forEach(key => {
    const value = qs[key];
    if (value !== undefined && value !== null) {
      cacheParams.append(key, String(value));
    }
  });
  
  return `${path}?${cacheParams.toString()}`;
}

/**
 * Convert query parameters to URLSearchParams for API call
 */
function prepareQueryParams(qs: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(qs).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  });
  return params;
}

/**
 * Call the Limitless API with proper error handling and caching
 */
export async function callLimitlessApi(
  path: string, 
  qs: Record<string, unknown> = {}, 
  useCache: boolean = true
): Promise<LifelogResponse> {
  // Build cache key based on path and query params
  const cacheKey = buildCacheKey(path, qs);
  
  // Check cache if enabled
  if (useCache) {
    const cachedData = cache.get<LifelogResponse>(cacheKey);
    if (cachedData) {
      console.error(`Cache hit for: ${cacheKey}`);
      return cachedData;
    }
    console.error(`Cache miss for: ${cacheKey}`);
  }
  
  // Convert all query parameter values to strings for API call
  const params = prepareQueryParams(qs);
  
  try {
    // Apply configured timeout and retry logic
    const requestOptions = {
      headers: { "X-API-Key": config.API_KEY },
      bodyTimeout: config.API_TIMEOUT_MS,
      headersTimeout: config.API_TIMEOUT_MS
    };
    
    // Make the API request with retry logic
    let response;
    let retryCount = 0;
    let lastError;
    
    while (retryCount <= config.API_MAX_RETRIES) {
      try {
        if (retryCount > 0) {
          console.error(`Retry attempt ${retryCount}/${config.API_MAX_RETRIES} for ${path}`);
          // Exponential backoff: 1s, 2s, 4s, etc.
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount - 1) * 1000));
        }
        
        response = await request(`${config.API_BASE_URL}${path}?${params}`, requestOptions);
        break; // Success - exit retry loop
      } catch (err: unknown) {
        lastError = err as Error;
        
        // Only retry on network errors or 5xx errors
        const errWithStatus = err as { statusCode?: number };
        if (errWithStatus.statusCode && errWithStatus.statusCode < 500) {
          throw err; // Don't retry client errors (4xx)
        }
        
        retryCount++;
        if (retryCount > config.API_MAX_RETRIES) {
          console.error(`All ${config.API_MAX_RETRIES} retry attempts failed for ${path}`);
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
    
    const data = await response.body.json() as LifelogResponse;
    
    // Store in cache if enabled
    if (useCache) {
      // Calculate TTL based on the type of data
      const ttl = calculateTTL(path, qs);
      
      // Get any applicable tags
      const tags = getCacheTags(path, qs);
      
      // Store in cache
      cache.set(cacheKey, data, ttl);
      console.error(`Cached data for: ${cacheKey} with TTL ${ttl}s (tags: ${tags.join(', ')})`);
    }
    
    return data;
  } catch (error: unknown) {
    const err = error as { response?: { statusCode: number }, statusCode?: number, message?: string };
    console.error("API call error:", err.message || String(error));
    
    // Add status code to the error object for better error handling
    if (err.response) {
      err.statusCode = err.response.statusCode;
    }
    
    // Map to appropriate MCP error
    if (err.statusCode) {
      if (err.statusCode === 404) {
        throw new McpError(`Resource not found: ${path}`, ErrorCode.NOT_FOUND);
      } else if (err.statusCode === 401 || err.statusCode === 403) {
        throw new McpError(`Unauthorized access to Limitless API`, ErrorCode.UNAUTHORIZED);
      } else if (err.statusCode >= 500) {
        throw new McpError(`Limitless API service error: ${err.statusCode}`, ErrorCode.API_ERROR);
      }
    }
    
    throw error;
  }
}

export default callLimitlessApi;