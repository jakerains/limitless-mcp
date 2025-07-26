/**
 * Error handling utilities for the MCP server
 */
// Define error codes
export var ErrorCode;
(function (ErrorCode) {
    ErrorCode["UNKNOWN_ERROR"] = "unknown_error";
    ErrorCode["INVALID_REQUEST"] = "invalid_request";
    ErrorCode["NOT_FOUND"] = "not_found";
    ErrorCode["UNAUTHORIZED"] = "unauthorized";
    ErrorCode["API_ERROR"] = "api_error";
    ErrorCode["RATE_LIMITED"] = "rate_limited";
    ErrorCode["TIMEOUT"] = "timeout";
    // Legacy error codes for compatibility
    ErrorCode["NotFound"] = "not_found";
    ErrorCode["Unauthorized"] = "unauthorized";
    ErrorCode["ServiceUnavailable"] = "service_unavailable";
    ErrorCode["Internal"] = "internal_error";
    ErrorCode["InvalidParams"] = "invalid_params";
})(ErrorCode || (ErrorCode = {}));
// Custom error class for MCP errors
export class McpError extends Error {
    constructor(message, code, httpStatus) {
        // Accept any parameter order and types to handle all legacy code
        if (typeof message === 'string') {
            super(message);
            this.name = 'McpError';
            this.code = code || ErrorCode.UNKNOWN_ERROR;
            this.httpStatus = httpStatus;
        }
        else {
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
export function isApiError(error) {
    return (typeof error === 'object' &&
        error !== null &&
        (('statusCode' in error) ||
            ('response' in error && typeof error.response === 'object' && error.response !== null) ||
            ('message' in error && typeof error.message === 'string')));
}
/**
 * Safely get status code from an unknown error
 */
export function getErrorStatusCode(error) {
    if (!isApiError(error))
        return undefined;
    // Direct statusCode property
    if (error.statusCode)
        return error.statusCode;
    // Nested in response
    if (error.response?.statusCode)
        return error.response.statusCode;
    return undefined;
}
/**
 * Safely get error message from an unknown error
 */
export function getErrorMessage(error) {
    if (!isApiError(error))
        return 'Unknown error';
    return error.message || 'Unknown error';
}
/**
 * Enhance an unknown error with API error properties
 */
export function enhanceError(error) {
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
