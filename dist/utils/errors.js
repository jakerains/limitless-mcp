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
