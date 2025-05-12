import { DecoratorPlugin } from "./decorator.js";
import { TimeParserPlugin } from "./time-parser.js";
import { ContentProcessorPlugin } from "./content-processor.js";
import { SemanticSearchPlugin } from "./semantic-search.js";
// Import other plugins as needed
// List of available plugins
const availablePlugins = [
    DecoratorPlugin,
    TimeParserPlugin,
    ContentProcessorPlugin,
    SemanticSearchPlugin,
    // Add other plugin classes here
];
export async function initializePlugins(server) {
    console.error("Initializing Limitless MCP plugins...");
    const config = {}; // Load plugin config if needed
    for (const PluginClass of availablePlugins) {
        try {
            const pluginInstance = new PluginClass();
            await pluginInstance.initialize(server, config);
            console.error(`Plugin "${pluginInstance.name}" v${pluginInstance.version} initialized successfully.`);
        }
        catch (error) {
            console.error(`Failed to initialize plugin ${PluginClass.name}:`, error);
        }
    }
}
