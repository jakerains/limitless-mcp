# Limitless MCP Project Structure

This document provides an overview of the project structure and code organization in Limitless MCP.

## Directory Structure

```
/
├── dist/             # Compiled JavaScript files
├── docs/             # Documentation
│   ├── CHANGELOG.md  # Version history and changes
│   ├── README.md     # Documentation index
│   ├── examples.md   # Detailed usage examples
│   ├── plugins.md    # Plugin documentation
│   └── project-map.md# This file (project structure)
├── src/              # Source code
│   ├── api/          # API client modules
│   │   └── client.ts # Limitless API client
│   ├── cache/        # Caching system
│   │   └── index.ts  # Cache implementation
│   ├── config.ts     # Configuration module
│   ├── main.ts       # Main entry point
│   ├── plugins/      # Plugin system
│   │   ├── content-processor.ts # Content processing plugin
│   │   ├── custom-example.ts    # Example custom plugin
│   │   ├── decorator.ts         # Template decorator plugin
│   │   ├── index.ts             # Plugin registry
│   │   ├── semantic-search.ts   # Semantic search plugin
│   │   ├── time-parser.ts       # Time reference parser plugin
│   │   └── types.ts             # Plugin type definitions
│   ├── tools/        # MCP tool implementations
│   │   ├── analysis-tools.ts    # Summarization and topic extraction
│   │   ├── cache-tools.ts       # Cache management tools
│   │   ├── index.ts             # Tools registry
│   │   └── lifelog-tools.ts     # Basic lifelog retrieval tools
│   ├── types/        # Type definitions
│   │   └── index.ts  # Common types
│   └── utils/        # Utility functions
│       └── index.ts  # Common utility functions
├── .gitignore        # Git ignore file
├── LICENSE           # MIT license
├── package.json      # NPM package definition
├── README.md         # Project README
└── tsconfig.json     # TypeScript configuration
```

## Key Modules

### Entry Point

**`src/main.ts`**

The main entry point initializes the MCP server, registers resources and tools, and starts the server.

Key functions:
- `main()`: The main function that sets up and runs the server

### Configuration

**`src/config.ts`**

Loads and validates configuration from environment variables with sensible defaults.

Key exports:
- `config`: The configuration object with all settings
- `logConfig()`: Function to log the current configuration

### API Client

**`src/api/client.ts`**

Provides a robust client for the Limitless API with error handling, retries, and caching.

Key exports:
- `callLimitlessApi(path, qs, useCache)`: Function to call the Limitless API

### Cache System

**`src/cache/index.ts`**

Manages the caching system for API responses and computed data.

Key exports:
- `cache`: The NodeCache instance
- `calculateTTL(path, queryParams)`: Calculate appropriate TTL based on data type
- `getCacheTags(path, queryParams)`: Get tags for a cache entry

### Tools

**`src/tools/index.ts`**

Registers all MCP tools and resources.

Key exports:
- `registerAllTools(server)`: Register all tools with the MCP server
- `registerResources(server)`: Register resource endpoints

**`src/tools/lifelog-tools.ts`**

Basic lifelog listing and retrieval tools.

Key functions:
- `registerLifelogTools(server)`: Register lifelog tools

**`src/tools/analysis-tools.ts`**

Advanced analysis tools like summarization and topic extraction.

Key functions:
- `registerAnalysisTools(server)`: Register analysis tools

**`src/tools/cache-tools.ts`**

Cache management tools.

Key functions:
- `registerCacheTools(server)`: Register cache management tools

### Plugins

**`src/plugins/index.ts`**

Plugin registry and initialization.

Key exports:
- `registry`: The plugin registry instance
- `initializePlugins(server)`: Initialize all enabled plugins

**`src/plugins/types.ts`**

Plugin type definitions.

Key interfaces:
- `LimitlessPlugin`: Interface that all plugins must implement
- `PluginRegistrationOptions`: Options for plugin registration

### Utilities

**`src/utils/index.ts`**

Common utility functions.

Key functions:
- `extractTopics(lifelogs, maxTopics, minOccurrences, mode, excludeCommonWords)`: Extract topics from lifelogs
- `generateSummary(lifelog, level, focus)`: Generate a summary for a lifelog
- `generateCombinedSummary(lifelogs, level)`: Generate a combined summary for multiple lifelogs
- `getTimeRangeText(lifelogs)`: Generate a time range description

### Types

**`src/types/index.ts`**

Common type definitions.

Key interfaces:
- `Lifelog`: Interface for a lifelog
- `LifelogContent`: Interface for lifelog content blocks
- `LifelogResponse`: Interface for Limitless API responses
- `LimitlessConfig`: Interface for configuration
- `Topic`: Interface for extracted topics

## Plugin System

The plugin system allows extending Limitless MCP with custom functionality:

1. Plugins implement the `LimitlessPlugin` interface
2. The plugin registry manages plugin lifecycle
3. Plugins are initialized with the server instance when it starts
4. Each plugin can register its own tools and resources

## Development Workflow

1. **Setup**: Clone the repository and install dependencies
   ```bash
   git clone https://github.com/jakerains/limitless-mcp.git
   cd limitless-mcp
   npm install
   ```

2. **Development**: Use the dev script to run with auto-reload
   ```bash
   npm run dev
   ```

3. **Build**: Compile TypeScript code to JavaScript
   ```bash
   npm run build
   ```

4. **Test**: Run the server with your API key
   ```bash
   LIMITLESS_API_KEY="your-api-key" npm start
   ```

## Adding a New Tool

To add a new tool:

1. Choose the appropriate module in `src/tools/` or create a new one
2. Create a function to register your tool
3. Call `server.tool()` with name, schema, and handler
4. Add your registration function to `registerAllTools()` in `src/tools/index.ts`

Example:
```typescript
// In src/tools/my-tools.ts
export function registerMyTools(server: McpServer): void {
  server.tool(
    "my_custom_tool",
    { 
      param1: z.string().describe("Parameter description"),
      param2: z.number().optional().describe("Optional parameter")
    },
    async ({ param1, param2 }) => {
      // Implement tool logic
      return {
        content: [{
          type: "text",
          text: `Result for ${param1}`
        }]
      };
    }
  );
}

// In src/tools/index.ts
import { registerMyTools } from "./my-tools";

export function registerAllTools(server: McpServer): void {
  // ...existing registrations
  registerMyTools(server);
}
```

## Creating a New Plugin

To create a custom plugin:

1. Create a new file in `src/plugins/`
2. Implement the `LimitlessPlugin` interface
3. Register your plugin in `src/plugins/index.ts`

Example:
```typescript
// In src/plugins/my-plugin.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LimitlessPlugin } from "./types";

export class MyPlugin implements LimitlessPlugin {
  name = "my-plugin";
  description = "My custom plugin for Limitless MCP";
  version = "1.0.0";
  
  async initialize(server: McpServer, config: Record<string, any>): Promise<void> {
    // Register tools or resources
    server.tool(
      "my_plugin_tool",
      { /* schema */ },
      async (params) => {
        // Implementation
        return { content: [{ type: "text", text: "Result" }] };
      }
    );
  }
}

// In src/plugins/index.ts
import { MyPlugin } from "./my-plugin.js";

// Add to availablePlugins array
const availablePlugins: Array<new () => LimitlessPlugin> = [
  // ...existing plugins
  MyPlugin
];
```

## Making Configuration Changes

To add new configuration options:

1. Update `src/config.ts` with your new options and default values
2. Update the `LimitlessConfig` interface in `src/types/index.ts`
3. Document the new options in the README.md

## Documentation

When making changes, be sure to update the relevant documentation:

- `README.md`: Main documentation
- `docs/CHANGELOG.md`: Version history
- `docs/examples.md`: Usage examples
- `docs/plugins.md`: Plugin documentation
- `docs/project-map.md`: This file (update when structure changes)