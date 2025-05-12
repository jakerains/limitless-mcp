# Limitless MCP Plugin Architecture

Limitless MCP supports a plugin architecture that allows you to extend its functionality with custom features.

## Built-in Plugins

The following plugins are included with Limitless MCP:

### Content Processor Plugin

The Content Processor plugin provides tools for processing and transforming lifelog content with various filters, replacements, and transformations.

**Tools:**

- `process_content`: Process a single lifelog with a series of operations
- `batch_process`: Process multiple lifelogs with the same operations

**Example:**

```json
{
  "id": "abc123",
  "operations": [
    {
      "type": "filter",
      "params": {
        "include": "important",
        "exclude": ["irrelevant", "noise"]
      }
    },
    {
      "type": "replace",
      "params": {
        "pattern": "old term",
        "replacement": "new term"
      }
    },
    {
      "type": "transform",
      "params": {
        "type": "bulletList"
      }
    }
  ],
  "format": "markdown"
}
```

### Decorator Plugin

The Decorator plugin adds templating capabilities to format lifelog content according to predefined or custom templates.

**Tools:**

- `apply_template`: Apply a template to format lifelog content
- `manage_templates`: List, get, add, or delete templates

**Example:**

```json
{
  "id": "abc123",
  "template": "report",
  "variables": {
    "summary": "This is a custom summary",
    "customField": "Custom value"
  }
}
```

### Semantic Search Plugin

The Semantic Search plugin enables concept-based search of lifelogs using text embeddings.

**Tools:**

- `create_embeddings`: Create embeddings for lifelog content
- `semantic_search`: Search for semantically similar content
- `manage_embeddings`: Manage semantic search embeddings

**Example:**

```json
{
  "query": "team collaboration challenges",
  "topK": 5,
  "threshold": 0.7
}
```

### Time Parser Plugin

The Time Parser plugin adds natural language time reference parsing for intuitive date filtering.

**Tools:**

- `parse_time_reference`: Parse natural language time references
- `search_with_time`: Search lifelogs using natural language time references

**Example:**

```json
{
  "timeReference": "last week",
  "timezone": "America/New_York"
}
```

## Using Plugins

Plugins are enabled by default. You can manage them using environment variables or the `manage_plugins` tool.

### Environment Variables

- `LIMITLESS_PLUGINS_ENABLED`: Set to "false" to disable all plugins
- `LIMITLESS_PLUGIN_CONTENT_PROCESSOR`: Set to "false" to disable the Content Processor plugin
- `LIMITLESS_PLUGIN_DECORATOR`: Set to "false" to disable the Decorator plugin
- `LIMITLESS_DECORATOR_TEMPLATES`: JSON string with custom templates
- `LIMITLESS_PLUGIN_SEMANTIC_SEARCH`: Set to "false" to disable the Semantic Search plugin
- `LIMITLESS_SEMANTIC_SEARCH_TTL`: TTL for embeddings cache in seconds (default: 3600)
- `LIMITLESS_SEMANTIC_SEARCH_MAX_KEYS`: Maximum number of embeddings to cache (default: 1000)
- `LIMITLESS_PLUGIN_TIME_PARSER`: Set to "false" to disable the Time Parser plugin
- `LIMITLESS_DEFAULT_TIMEZONE`: Default timezone for time parsing (default: "UTC")

### Managing Plugins

Use the `manage_plugins` tool to list, enable, disable, or get information about plugins:

```json
{
  "action": "list"
}
```

```json
{
  "action": "enable",
  "name": "content-processor"
}
```

```json
{
  "action": "disable",
  "name": "decorator"
}
```

```json
{
  "action": "info",
  "name": "content-processor"
}
```

## Creating Custom Plugins

You can create your own plugins by implementing the `LimitlessPlugin` interface. Here's a basic template:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LimitlessPlugin } from "./types";

export class MyCustomPlugin implements LimitlessPlugin {
  name = "my-custom-plugin";
  description = "Description of what my plugin does";
  version = "1.0.0";
  
  async initialize(server: McpServer, config: Record<string, any>): Promise<void> {
    // Register tools and resources here
    server.tool(
      "my_custom_tool",
      { /* schema */ },
      async (params) => {
        // Tool implementation
        return {
          content: [{ type: "text", text: "Result" }]
        };
      }
    );
  }
  
  async shutdown(): Promise<void> {
    // Clean up resources
  }
}
```

### Loading Custom Plugins

To use a custom plugin, import it and register it with the plugin registry:

```typescript
import { registry } from "./plugins/index.js";
import { MyCustomPlugin } from "./my-custom-plugin.js";

const myPlugin = new MyCustomPlugin();
await registry.register(myPlugin, {
  enabled: true,
  config: {
    // Custom configuration
  }
});
```

## Plugin API Reference

### LimitlessPlugin Interface

```typescript
interface LimitlessPlugin {
  name: string;
  description: string;
  version: string;
  initialize(server: McpServer, config: Record<string, any>): Promise<void>;
  shutdown?(): Promise<void>;
}
```

### PluginRegistry Methods

- `register(plugin, options)`: Register a plugin
- `enablePlugin(name)`: Enable a plugin
- `disablePlugin(name)`: Disable a plugin
- `getPlugin(name)`: Get a plugin by name
- `listPlugins()`: List all registered plugins