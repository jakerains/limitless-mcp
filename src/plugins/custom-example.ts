import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LimitlessPlugin } from "./types";

/**
 * Example of a custom plugin that can be dynamically loaded
 */
export class CustomExamplePlugin implements LimitlessPlugin {
  name = "custom-example";
  description = "An example custom plugin that demonstrates the plugin API";
  version = "1.0.0";
  
  private server?: McpServer;
  private config: Record<string, any> = {};
  
  async initialize(server: McpServer, config: Record<string, any>): Promise<void> {
    this.server = server;
    this.config = config;
    
    // Log initialization
    console.error(`Initializing custom example plugin with config:`, config);
    
    // Register a custom tool
    server.tool(
      "custom_greeting",
      {
        name: z.string().describe("Name to greet"),
        format: z.enum(["plain", "fancy"]).default("plain").describe("Greeting format")
      },
      async ({ name, format }) => {
        const greeting = this.generateGreeting(name, format);
        
        return {
          content: [{
            type: "text",
            text: greeting
          }]
        };
      }
    );
  }
  
  // Clean up when plugin is disabled
  async shutdown(): Promise<void> {
    console.error("Custom example plugin shutting down");
    // In a real plugin, you would release resources here
  }
  
  // Generate a greeting message
  private generateGreeting(name: string, format: string): string {
    const message = `Hello, ${name}!`;
    
    if (format === "fancy") {
      return `
╔═══════════════════════════════╗
║                               ║
║    ${message.padEnd(23, ' ')} ║
║                               ║
╚═══════════════════════════════╝
      `;
    }
    
    return message;
  }
}

// Export the plugin class
export default CustomExamplePlugin;