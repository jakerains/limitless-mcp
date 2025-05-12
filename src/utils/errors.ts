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