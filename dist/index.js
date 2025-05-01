#!/usr/bin/env node
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { request } from "undici";
import { z } from "zod";
// ──────────────────────────────────────────────────────────────────────────────
// Main function that runs the MCP server
// ──────────────────────────────────────────────────────────────────────────────
async function main() {
    const API_KEY = process.env.LIMITLESS_API_KEY;
    if (!API_KEY) {
        console.error("Error: LIMITLESS_API_KEY environment variable is not set");
        console.error("Please set it to your Limitless API key");
        process.exit(1);
    }
    const BASE = "https://api.limitless.ai/v1";
    const call = async (path, qs = {}) => {
        // Convert all query parameter values to strings
        const params = new URLSearchParams();
        Object.entries(qs).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                params.append(key, String(value));
            }
        });
        try {
            const response = await request(`${BASE}${path}?${params}`, {
                headers: { "X-API-Key": API_KEY }
            });
            return response.body.json();
        }
        catch (error) {
            console.error("API call error:", error);
            throw error;
        }
    };
    // ──────────────────────────────────────────────────────────────────────────────
    // 1. Spin up the server object
    // ──────────────────────────────────────────────────────────────────────────────
    const server = new McpServer({
        name: "limitless",
        version: "0.1.0"
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
    // List lifelogs with enhanced filtering options
    server.tool("list_lifelogs", {
        limit: z.number().optional(),
        date: z.string().optional().describe("Date in YYYY-MM-DD format"),
        timezone: z.string().optional().describe("IANA timezone specifier"),
        start: z.string().optional().describe("Start date/time in YYYY-MM-DD or YYYY-MM-DD HH:mm:SS format"),
        end: z.string().optional().describe("End date/time in YYYY-MM-DD or YYYY-MM-DD HH:mm:SS format"),
        direction: z.enum(["asc", "desc"]).optional().describe("Sort direction: asc or desc")
    }, async ({ limit = 10, date, timezone, start, end, direction }) => {
        const response = await call("/lifelogs", {
            limit,
            date,
            timezone,
            start,
            end,
            direction,
            includeMarkdown: true
        });
        const lifelogs = response.data.lifelogs || [];
        const nextCursor = response.meta?.lifelogs?.nextCursor;
        let resultText = lifelogs.map((l) => {
            let timeInfo = "";
            if (l.startTime) {
                const startDate = new Date(l.startTime);
                timeInfo = ` (${startDate.toLocaleString()})`;
            }
            return `${l.id} — ${l.title}${timeInfo}`;
        }).join("\n");
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
    // Search lifelogs with enhanced filtering
    server.tool("search_lifelogs", {
        query: z.string().describe("Text to search for in lifelogs"),
        limit: z.number().optional(),
        date: z.string().optional().describe("Date in YYYY-MM-DD format"),
        timezone: z.string().optional().describe("IANA timezone specifier"),
        start: z.string().optional().describe("Start date/time in YYYY-MM-DD or YYYY-MM-DD HH:mm:SS format"),
        end: z.string().optional().describe("End date/time in YYYY-MM-DD or YYYY-MM-DD HH:mm:SS format")
    }, async ({ query, limit = 10, date, timezone, start, end }) => {
        // First get the lifelogs based on date criteria
        const response = await call("/lifelogs", {
            limit: Math.min(limit * 3, 25), // Get more than we need to increase search chances
            date,
            timezone,
            start,
            end,
            includeMarkdown: true
        });
        const logs = response.data.lifelogs || [];
        // Then filter them by search term
        const hits = logs.filter((l) => (l.markdown ?? "").toLowerCase().includes(query.toLowerCase()) ||
            (l.title ?? "").toLowerCase().includes(query.toLowerCase())).slice(0, limit);
        let resultText = hits.map((l) => {
            let timeInfo = "";
            if (l.startTime) {
                const startDate = new Date(l.startTime);
                timeInfo = ` (${startDate.toLocaleString()})`;
            }
            return `${l.id} — «${l.title}»${timeInfo}`;
        }).join("\n");
        return {
            content: [{
                    type: "text",
                    text: hits.length
                        ? resultText
                        : "No matches found for the specified criteria."
                }]
        };
    });
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
    // ──────────────────────────────────────────────────────────────────────────────
    // 4. Start the server over stdio (Claude / VS Code / etc. expect this)
    // ──────────────────────────────────────────────────────────────────────────────
    try {
        await server.connect(new StdioServerTransport());
        console.log("Server connected successfully");
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
