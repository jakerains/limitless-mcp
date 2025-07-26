import { McpError, ErrorCode, getErrorStatusCode, getErrorMessage } from '../utils/errors.js';
import { z } from "zod";
import callLimitlessApi from "../api/client.js";
import config from "../config.js";
/**
 * Register lifelog listing and retrieval tools on the MCP server
 */
export function registerLifelogTools(server) {
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
    }, async ({ limit = config.DEFAULT_PAGE_SIZE, date, timezone, start, end, direction, includeContent, fields }) => {
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
        const response = await callLimitlessApi("/lifelogs", queryParams);
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
    }, async ({ cursor, limit = config.DEFAULT_PAGE_SIZE, date, timezone, direction, includeContent, fields }) => {
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
        const response = await callLimitlessApi("/lifelogs", queryParams);
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
            const response = await callLimitlessApi(`/lifelogs/${id}`, queryParams);
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
            // Include the content if requested
            let content = header;
            if (includeContent && lifelog.markdown) {
                content += lifelog.markdown;
            }
            else {
                content += "(Content not included. Set includeContent=true to view full content.)";
            }
            return {
                content: [{
                        type: "text",
                        text: content
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
            const statusCode = getErrorStatusCode(error);
            if (statusCode) {
                if (statusCode === 404) {
                    throw new McpError(`Lifelog with ID ${id} not found`, ErrorCode.NotFound);
                }
                else if (statusCode === 401 || statusCode === 403) {
                    throw new McpError(`Unauthorized access to Limitless API`, ErrorCode.Unauthorized);
                }
                else if (statusCode >= 500) {
                    throw new McpError(`Limitless API service error: ${statusCode}`, ErrorCode.ServiceUnavailable);
                }
            }
            // Generic error fallback
            throw new McpError(`Error retrieving lifelog ${id}: ${getErrorMessage(error)}`, ErrorCode.Internal);
        }
    });
    // Get only metadata for a lifelog
    server.tool("get_lifelog_metadata", {
        id: z.string().describe("The ID of the lifelog to retrieve metadata for")
    }, async ({ id }) => {
        try {
            const response = await callLimitlessApi(`/lifelogs/${id}`, { includeMarkdown: false });
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
            const statusCode = getErrorStatusCode(error);
            if (statusCode) {
                if (statusCode === 404) {
                    throw new McpError(`Lifelog with ID ${id} not found`, ErrorCode.NotFound);
                }
                else if (statusCode === 401 || statusCode === 403) {
                    throw new McpError(`Unauthorized access to Limitless API`, ErrorCode.Unauthorized);
                }
                else if (statusCode >= 500) {
                    throw new McpError(`Limitless API service error: ${statusCode}`, ErrorCode.ServiceUnavailable);
                }
            }
            // Generic error fallback
            throw new McpError(`Error retrieving lifelog metadata for ${id}: ${getErrorMessage(error)}`, ErrorCode.Internal);
        }
    });
}
