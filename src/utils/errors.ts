/**
 * Error handling utilities for the MCP server
 */

// Define error codes
export enum ErrorCode {
  UNKNOWN_ERROR = 'unknown_error',
  INVALID_REQUEST = 'invalid_request',
  NOT_FOUND = 'not_found',
  UNAUTHORIZED = 'unauthorized',
  API_ERROR = 'api_error',
  RATE_LIMITED = 'rate_limited',
  TIMEOUT = 'timeout',
  
  // Legacy error codes for compatibility
  NotFound = 'not_found',
  Unauthorized = 'unauthorized',
  ServiceUnavailable = 'service_unavailable',
  Internal = 'internal_error',
  InvalidParams = 'invalid_params'
}

// Allow string values to be used as ErrorCode
export type ErrorCodeString = ErrorCode | string;

// Define API error interface
export interface ApiError {
  statusCode?: number;
  response?: {
    statusCode?: number;
  };
  message?: string;
}

// Custom error class for MCP errors
export class McpError extends Error {
  code: any;
  httpStatus?: number;
  
  constructor(message: any, code?: any, httpStatus?: any) {
    // Accept any parameter order and types to handle all legacy code
    if (typeof message === 'string') {
      super(message);
      this.name = 'McpError';
      this.code = code || ErrorCode.UNKNOWN_ERROR;
      this.httpStatus = httpStatus;
    } else {
      // Handle legacy format: new McpError(code, message, metadata)
      super(String(code || ''));
      this.name = 'McpError';
      this.code = message;
    }
  }
}

/**
 * Type guard to check if an unknown error has API error properties
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' && 
    error !== null && 
    (
      ('statusCode' in error) || 
      ('response' in error && typeof error.response === 'object' && error.response !== null) ||
      ('message' in error && typeof error.message === 'string')
    )
  );
}

/**
 * Safely get status code from an unknown error
 */
export function getErrorStatusCode(error: unknown): number | undefined {
  if (!isApiError(error)) return undefined;
  
  // Direct statusCode property
  if (error.statusCode) return error.statusCode;
  
  // Nested in response
  if (error.response?.statusCode) return error.response.statusCode;
  
  return undefined;
}

/**
 * Safely get error message from an unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'Unknown error';
  return error.message || 'Unknown error';
}

/**
 * Enhance an unknown error with API error properties
 */
export function enhanceError(error: unknown): ApiError {
  if (!isApiError(error)) {
    return { message: String(error) };
  }
  
  // Add statusCode from response if needed
  if (!error.statusCode && error.response?.statusCode) {
    return {
      ...error,
      statusCode: error.response.statusCode
    };
  }
  
  return error;
}