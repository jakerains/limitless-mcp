import { z } from 'zod';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Define the interface that all plugins must implement
export interface LimitlessPlugin {
  // Unique name of the plugin
  name: string;
  
  // Description of what the plugin does
  description: string;
  
  // Version of the plugin
  version: string;
  
  // Initialize the plugin
  initialize(server: McpServer, config: Record<string, any>): Promise<void>;
  
  // Shutdown the plugin (optional)
  shutdown?(): Promise<void>;
}

// Plugin registration options
export interface PluginRegistrationOptions {
  // Enable or disable the plugin
  enabled: boolean;
  
  // Configuration for the plugin
  config: Record<string, any>;
}

// Plugin registry to manage all plugins
export class PluginRegistry {
  private plugins: Map<string, {
    plugin: LimitlessPlugin,
    options: PluginRegistrationOptions
  }> = new Map();
  
  private server?: McpServer;
  
  // Register the server instance
  setServer(server: McpServer): void {
    this.server = server;
  }
  
  // Register a plugin with options
  async register(
    plugin: LimitlessPlugin, 
    options: PluginRegistrationOptions = { enabled: true, config: {} }
  ): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} is already registered`);
    }
    
    this.plugins.set(plugin.name, { plugin, options });
    
    // Initialize immediately if server is available and plugin is enabled
    if (this.server && options.enabled) {
      await plugin.initialize(this.server, options.config);
      console.error(`Plugin ${plugin.name} v${plugin.version} initialized`);
    }
  }
  
  // Initialize all enabled plugins
  async initializePlugins(server: McpServer): Promise<void> {
    if (!this.server) {
      this.server = server;
    }
    
    for (const [name, { plugin, options }] of this.plugins.entries()) {
      if (options.enabled) {
        try {
          await plugin.initialize(server, options.config);
          console.error(`Plugin ${name} v${plugin.version} initialized`);
        } catch (error) {
          console.error(`Failed to initialize plugin ${name}: ${error}`);
        }
      }
    }
  }
  
  // Shutdown all plugins that implement shutdown
  async shutdownPlugins(): Promise<void> {
    for (const [name, { plugin, options }] of this.plugins.entries()) {
      if (options.enabled && plugin.shutdown) {
        try {
          await plugin.shutdown();
          console.error(`Plugin ${name} shutdown`);
        } catch (error) {
          console.error(`Error shutting down plugin ${name}: ${error}`);
        }
      }
    }
  }
  
  // Get a registered plugin by name
  getPlugin(name: string): LimitlessPlugin | undefined {
    return this.plugins.get(name)?.plugin;
  }
  
  // List all registered plugins
  listPlugins(): Array<{ name: string; description: string; version: string; enabled: boolean }> {
    return Array.from(this.plugins.entries()).map(([_, { plugin, options }]) => ({
      name: plugin.name,
      description: plugin.description,
      version: plugin.version,
      enabled: options.enabled
    }));
  }
  
  // Enable a plugin
  async enablePlugin(name: string): Promise<void> {
    const entry = this.plugins.get(name);
    if (!entry) {
      throw new Error(`Plugin ${name} not found`);
    }
    
    if (!entry.options.enabled) {
      entry.options.enabled = true;
      
      if (this.server) {
        await entry.plugin.initialize(this.server, entry.options.config);
        console.error(`Plugin ${name} enabled and initialized`);
      }
    }
  }
  
  // Disable a plugin
  async disablePlugin(name: string): Promise<void> {
    const entry = this.plugins.get(name);
    if (!entry) {
      throw new Error(`Plugin ${name} not found`);
    }
    
    if (entry.options.enabled) {
      entry.options.enabled = false;
      
      if (entry.plugin.shutdown) {
        await entry.plugin.shutdown();
        console.error(`Plugin ${name} disabled and shut down`);
      } else {
        console.error(`Plugin ${name} disabled`);
      }
    }
  }
}

// Create a singleton instance of the plugin registry
export const registry = new PluginRegistry();