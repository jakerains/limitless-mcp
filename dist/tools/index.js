/**
 * Tools registry for Limitless MCP
 */
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import callLimitlessApi from "../api/client.js";
import { registerCacheTools } from "./cache-tools.js";
import { registerLifelogTools } from "./lifelog-tools.js";
import { registerAnalysisTools } from "./analysis-tools.js";
/**
 * Register all tools with the MCP server
 */
export function registerAllTools(server) {
    // Register tool categories
    registerCacheTools(server);
    registerLifelogTools(server);
    registerAnalysisTools(server);
}
/**
 * Register resource endpoints with the MCP server
 */
export function registerResources(server) {
    // Register lifelogs resource
    server.resource("lifelogs", new ResourceTemplate("lifelogs://{id}", {
        list: async () => {
            const response = await callLimitlessApi("/lifelogs", { limit: 25 });
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
        const response = await callLimitlessApi(`/lifelogs/${id}`);
        const lifelog = response.data.lifelog;
        return {
            contents: [{ uri: uri.href, text: lifelog?.markdown ?? "(empty)" }]
        };
    });
}
