// Placeholder for plugin initialization logic
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LimitlessPlugin } from "./types";
import { DecoratorPlugin } from "./decorator.js";
import { TimeParserPlugin } from "./time-parser.js";
import { ContentProcessorPlugin } from "./content-processor.js";
import { SemanticSearchPlugin } from "./semantic-search.js";
// Import other plugins as needed

// List of available plugins
const availablePlugins: Array<new () => LimitlessPlugin> = [
  DecoratorPlugin,
  TimeParserPlugin,
  ContentProcessorPlugin,
  SemanticSearchPlugin,
  // Add other plugin classes here
];

export async function initializePlugins(server: McpServer): Promise<void> {
  console.error("Initializing Limitless MCP plugins...");
  
  const config = {}; // Load plugin config if needed
  
  for (const PluginClass of availablePlugins) {
    try {
      const pluginInstance = new PluginClass();
      await pluginInstance.initialize(server, config);
      console.error(`Plugin "${pluginInstance.name}" v${pluginInstance.version} initialized successfully.`);
    } catch (error) {
      console.error(`Failed to initialize plugin ${PluginClass.name}:`, error);
    }
  }
}
