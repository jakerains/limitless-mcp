// Plugin registry to manage all plugins
export class PluginRegistry {
    constructor() {
        this.plugins = new Map();
    }
    // Register the server instance
    setServer(server) {
        this.server = server;
    }
    // Register a plugin with options
    async register(plugin, options = { enabled: true, config: {} }) {
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
    async initializePlugins(server) {
        if (!this.server) {
            this.server = server;
        }
        for (const [name, { plugin, options }] of this.plugins.entries()) {
            if (options.enabled) {
                try {
                    await plugin.initialize(server, options.config);
                    console.error(`Plugin ${name} v${plugin.version} initialized`);
                }
                catch (error) {
                    console.error(`Failed to initialize plugin ${name}: ${error}`);
                }
            }
        }
    }
    // Shutdown all plugins that implement shutdown
    async shutdownPlugins() {
        for (const [name, { plugin, options }] of this.plugins.entries()) {
            if (options.enabled && plugin.shutdown) {
                try {
                    await plugin.shutdown();
                    console.error(`Plugin ${name} shutdown`);
                }
                catch (error) {
                    console.error(`Error shutting down plugin ${name}: ${error}`);
                }
            }
        }
    }
    // Get a registered plugin by name
    getPlugin(name) {
        return this.plugins.get(name)?.plugin;
    }
    // List all registered plugins
    listPlugins() {
        return Array.from(this.plugins.entries()).map(([_, { plugin, options }]) => ({
            name: plugin.name,
            description: plugin.description,
            version: plugin.version,
            enabled: options.enabled
        }));
    }
    // Enable a plugin
    async enablePlugin(name) {
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
    async disablePlugin(name) {
        const entry = this.plugins.get(name);
        if (!entry) {
            throw new Error(`Plugin ${name} not found`);
        }
        if (entry.options.enabled) {
            entry.options.enabled = false;
            if (entry.plugin.shutdown) {
                await entry.plugin.shutdown();
                console.error(`Plugin ${name} disabled and shut down`);
            }
            else {
                console.error(`Plugin ${name} disabled`);
            }
        }
    }
}
// Create a singleton instance of the plugin registry
export const registry = new PluginRegistry();
