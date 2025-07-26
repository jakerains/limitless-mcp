#!/usr/bin/env node
/**
 * Limitless MCP Server
 * Connects to the Limitless API to provide Claude and other LLMs with lifelog data
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { logConfig } from "./config.js";
import { initializePlugins } from "./plugins/index.js";
import { registerAllTools, registerResources } from "./tools/index.js";
/**
 * Main function that runs the MCP server
 */
async function main() {
    // Log configuration
    logConfig();
    // ──────────────────────────────────────────────────────────────────────────────
    // 1. Spin up the server object
    // ──────────────────────────────────────────────────────────────────────────────
    const server = new McpServer({
        name: "limitless",
        version: "0.5.0"
    });
    // ──────────────────────────────────────────────────────────────────────────────
    // 2. Register resources
    // ──────────────────────────────────────────────────────────────────────────────
    registerResources(server);
    // ──────────────────────────────────────────────────────────────────────────────
    // 3. Register all tools
    // ──────────────────────────────────────────────────────────────────────────────
    registerAllTools(server);
    // ──────────────────────────────────────────────────────────────────────────────
    // 4. Initialize plugins
    // ──────────────────────────────────────────────────────────────────────────────
    await initializePlugins(server);
    // ──────────────────────────────────────────────────────────────────────────────
    // 5. Start the server
    // ──────────────────────────────────────────────────────────────────────────────
    console.error("Starting Limitless MCP server...");
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Handle shutdown
    const shutdown = async () => {
        console.error("Shutting down Limitless MCP server...");
        await server.close();
        process.exit(0);
    };
    // Register signal handlers
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}
// Run the main function
main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
