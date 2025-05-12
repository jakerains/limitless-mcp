# 🔮 Limitless MCP

[![npm version](https://img.shields.io/npm/v/limitless-mcp.svg)](https://www.npmjs.com/package/limitless-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/limitless-mcp)](https://nodejs.org/)

> Connect your [Limitless](https://www.limitless.ai/) Pendant data to Claude and other LLMs via the Model Context Protocol (MCP).

Limitless MCP is a server implementation of the [Model Context Protocol](https://github.com/modelcontextprotocol/mcp) that provides seamless access to your Limitless API data for AI assistants like Claude.

<img src="https://app.limitless.ai/limitless-opengraph.jpg" alt="Limitless Logo" width="400" />

## ✨ Features

- 🔍 **Enhanced Search** with relevance-based scoring and content snippets
- 🔮 **Semantic Search** using text embeddings for concept-based retrieval
- 📅 **Natural Language Time** parsing for intuitive date filtering (e.g., "last week")
- 📝 **Smart Summarization** at different detail levels and focus areas
- 📄 **Transcript Generation** in multiple formats for easy reading
- 📊 **Time Analysis** to understand your recording patterns
- 🔎 **Content Filtering** by speaker, type, or timeframe
- 🧠 **Topic Extraction** to identify key themes across lifelogs
- 😊 **Sentiment Analysis** for conversations with speaker breakdown
- 🔌 **Plugin Architecture** for extending functionality with custom features
- ⚡ **Performance Optimization** with configurable caching
- 🎛️ **Customizable** via environment variables
- 🔒 **Secure Authentication** using your Limitless API key
- 🔄 **Seamless Integration** with Claude Desktop, Cursor, and other MCP-compatible clients

## 📋 Prerequisites

- Node.js 18 or higher (required for fetch API used by the client)
- A [Limitless](https://www.limitless.ai/) account with a paired Pendant
- A [Limitless API key](https://www.limitless.ai/developers) (available to Pendant owners)

## 🚀 Installation

```bash
npm install -g limitless-mcp
```

## 🔧 Configuration & Setup

### Claude Desktop

1. Open your Claude Desktop configuration file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. Add the Limitless MCP server to your configuration:

```json
{
  "mcpServers": {
    "limitless-mcp": {
      "command": "npx",
      "args": ["-y", "limitless-mcp"],
      "env": {
        "LIMITLESS_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

3. Restart Claude Desktop

### Cursor

1. Open your Cursor MCP configuration file:
   - **macOS**: `~/.cursor/mcp.json`
   - **Windows**: `%USERPROFILE%\.cursor\mcp.json`
   - **Linux**: `~/.cursor/mcp.json`

2. Add the Limitless MCP server to your configuration:

```json
{
  "mcpServers": {
    "limitless-mcp": {
      "command": "npx",
      "args": ["-y", "limitless-mcp"],
      "env": {
        "LIMITLESS_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

3. Restart Cursor

### Other MCP-Compatible Applications

Any application that supports the Model Context Protocol can use limitless-mcp with a similar configuration. The essential elements are:

```json
{
  "command": "npx",
  "args": ["-y", "limitless-mcp"],
  "env": {
    "LIMITLESS_API_KEY": "your-api-key-here"
  }
}
```

## 🎮 Usage

Once configured, you can interact with your Limitless data using natural language within Claude or other MCP-enabled AI assistants.

### Example Commands

- **List recent lifelogs**:
  ```
  Show me my recent lifelogs.
  ```

- **Search for specific content**:
  ```
  Search my lifelogs for conversations about artificial intelligence.
  ```

- **Get a daily summary**:
  ```
  Give me a summary of my day on May 1, 2025.
  ```

- **Retrieve a full conversation**:
  ```
  Show me the full text of lifelog OFe86CdN11YCe22I9Jv4.
  ```

- **Generate a transcript**:
  ```
  Create a dialogue transcript from lifelog OFe86CdN11YCe22I9Jv4.
  ```

- **Analyze recording time**:
  ```
  Show me a time analysis of my recordings from last week.
  ```

- **Filter by speaker**:
  ```
  Filter lifelog OFe86CdN11YCe22I9Jv4 to only show what Jake said.
  ```

## 🧰 Available Tools

### Core Tools

#### `list_lifelogs`
Lists your lifelogs with filtering options:
- `limit`: Maximum number of lifelogs to return (default: 10)
- `date`: Date in YYYY-MM-DD format
- `timezone`: IANA timezone specifier (e.g., "America/Los_Angeles")
- `start`: Start date/time
- `end`: End date/time
- `direction`: Sort direction ("asc" or "desc")
- `includeContent`: Whether to include markdown content
- `fields`: Specific fields to include (title, time, id, etc.)

#### `get_paged_lifelogs`
Navigates through paginated results:
- `cursor`: Pagination cursor from previous results
- `limit`: Maximum number of lifelogs to return
- `date`, `timezone`, `direction`: Same as above
- `includeContent`: Whether to include markdown content
- `fields`: Specific fields to include (title, time, id, etc.)

#### `search_lifelogs`
Searches your lifelogs with relevance-based scoring:
- `query`: Text to search for
- `limit`: Maximum number of results to return
- `date`, `timezone`, `start`, `end`: Same as above
- `searchMode`: Search mode ("basic" or "advanced" with scoring)
- `includeSnippets`: Whether to include matching content snippets

#### `get_lifelog`
Retrieves a specific lifelog with selective field retrieval:
- `id`: The ID of the lifelog to retrieve
- `includeContent`: Whether to include full content or just metadata
- `fields`: Specific fields to include (title, time, speakers, etc.)

#### `get_lifelog_metadata`
Retrieves only metadata about a lifelog (faster than full content):
- `id`: The ID of the lifelog to retrieve metadata for

#### `filter_lifelog_contents`
Filters lifelog content by various criteria:
- `id`: The ID of the lifelog to filter
- `speakerName`: Filter by speaker name
- `contentType`: Filter by content type (e.g., heading1, blockquote)
- `timeStart`: Filter content after this time (ISO-8601)
- `timeEnd`: Filter content before this time (ISO-8601)

#### `generate_transcript`
Creates a formatted transcript from a lifelog:
- `id`: The ID of the lifelog to generate transcript from
- `format`: Transcript format style ("simple", "detailed", or "dialogue")

#### `get_time_summary`
Provides time-based analytics of your recordings:
- `date`: Date in YYYY-MM-DD format
- `timezone`: IANA timezone specifier
- `start`: Start date for range analysis
- `end`: End date for range analysis
- `groupBy`: How to group statistics ("hour", "day", or "week")

#### `get_day_summary`
Provides a formatted summary of a specific day's lifelogs:
- `date`: Date in YYYY-MM-DD format
- `timezone`: IANA timezone specifier

### Advanced Analysis Tools

#### `summarize_lifelog`
Creates intelligent summaries at different levels of detail:
- `id`: The ID of the lifelog to summarize
- `level`: Level of summarization detail ("brief", "detailed", or "comprehensive")
- `focus`: Focus of the summary ("general", "key_points", "decisions", "questions", "action_items")

#### `summarize_lifelogs`
Summarizes multiple lifelogs with optional combined view:
- `ids`: Array of lifelog IDs to summarize
- `level`: Level of detail ("brief" or "detailed")
- `combinedView`: Whether to provide a combined summary

#### `extract_topics`
Identifies key topics and themes across lifelogs:
- `ids`: Array of lifelog IDs to analyze
- `maxTopics`: Maximum number of topics to extract
- `minOccurrences`: Minimum occurrences required for a topic
- `mode`: Extraction mode ("keywords" or "phrases")
- `excludeCommonWords`: Whether to exclude common English words

#### `analyze_sentiment`
Analyzes sentiment in lifelog content:
- `id`: The ID of the lifelog to analyze sentiment for
- `bySpeaker`: Whether to analyze sentiment by speaker
- `includeSentences`: Whether to include individual sentences in the analysis

#### `compare_sentiment`
Compares sentiment across multiple lifelogs:
- `ids`: Array of lifelog IDs to compare sentiment
- `bySpeaker`: Whether to compare sentiment by speaker across lifelogs

### System Tools

#### `manage_cache`
Manages the caching system:
- `action`: Action to perform ("stats" or "clear")

#### `manage_plugins`
Manages the plugin system:
- `action`: Action to perform ("list", "enable", "disable", or "info")
- `name`: Plugin name for enable/disable/info actions

### Plugin-Provided Tools

#### Content Processor Plugin

##### `process_content`
Processes and transforms lifelog content:
- `id`: The ID of the lifelog to process
- `operations`: List of operations to perform (filter, replace, extract, transform)
- `format`: Output format (markdown, text, or json)

##### `batch_process`
Processes multiple lifelogs with the same operations:
- `ids`: Array of lifelog IDs to process
- `operations`: List of operations to perform
- `mergeResults`: Whether to merge results into a single output

#### Decorator Plugin

##### `apply_template`
Applies templates to format lifelog content:
- `id`: The ID of the lifelog to format
- `template`: Name of the template to use or custom template string
- `variables`: Additional variables to use in the template

##### `manage_templates`
Manages content templates:
- `action`: Action to perform ("list", "get", "add", or "delete")
- `name`: Template name for get/add/delete actions
- `template`: Template content for add action

#### Semantic Search Plugin

##### `create_embeddings`
Creates embeddings for a lifelog to enable semantic search:
- `id`: The ID of the lifelog to create embeddings for
- `chunkSize`: Size of text chunks for embeddings (in characters)
- `chunkOverlap`: Overlap between chunks (in characters)
- `forceRefresh`: Whether to force refresh embeddings

##### `semantic_search`
Searches for semantically similar content:
- `query`: The query to search for semantically similar content
- `ids`: Optional array of specific lifelog IDs to search within
- `topK`: Number of top results to return
- `threshold`: Similarity threshold (0-1)

##### `manage_embeddings`
Manages semantic search embeddings:
- `action`: Action to perform ("list", "delete", "clear", or "info")
- `id`: Lifelog ID for delete/info actions

#### Time Parser Plugin

##### `parse_time_reference`
Parses natural language time references:
- `timeReference`: Natural language time reference (e.g., "yesterday", "last week")
- `timezone`: IANA timezone specifier
- `referenceDate`: Reference date (defaults to today)

##### `search_with_time`
Searches lifelogs with natural language time references:
- `query`: Search query text
- `timeReference`: Natural language time reference (e.g., "yesterday", "last week")
- `timezone`: IANA timezone specifier
- `limit`: Maximum number of results to return
- `includeContent`: Whether to include content in results

## ⚙️ Configuration

Limitless MCP can be configured using environment variables:

### API Configuration

- `LIMITLESS_API_KEY`: Your Limitless API key (required)
- `LIMITLESS_API_BASE_URL`: Limitless API base URL (default: "https://api.limitless.ai/v1")
- `LIMITLESS_API_TIMEOUT_MS`: Timeout in milliseconds for API calls (default: 120000)
- `LIMITLESS_API_MAX_RETRIES`: Maximum retries for failed API calls (default: 3)

### Pagination Configuration

- `LIMITLESS_MAX_LIFELOG_LIMIT`: Maximum number of results per request (default: 100)
- `LIMITLESS_DEFAULT_PAGE_SIZE`: Default page size for listing results (default: 10)
- `LIMITLESS_SEARCH_MULTIPLIER`: Multiplier for search results retrieval (default: 3)

### Caching Configuration

- `LIMITLESS_CACHE_TTL`: Cache time-to-live in seconds (default: 300)
- `LIMITLESS_CACHE_CHECK_PERIOD`: Cache cleanup interval in seconds (default: 600)
- `LIMITLESS_CACHE_MAX_KEYS`: Maximum number of items in cache (default: 500)
- `CACHE_TTL_METADATA`: TTL multiplier for metadata (default: 3)
- `CACHE_TTL_LISTINGS`: TTL multiplier for listings (default: 2)
- `CACHE_TTL_SEARCH`: TTL multiplier for search results (default: 1.5)
- `CACHE_TTL_SUMMARIES`: TTL multiplier for summaries (default: 4)

### Plugin Configuration

- `LIMITLESS_PLUGINS_ENABLED`: Set to "false" to disable all plugins
- `LIMITLESS_PLUGIN_CONTENT_PROCESSOR`: Set to "false" to disable the Content Processor plugin
- `LIMITLESS_PLUGIN_DECORATOR`: Set to "false" to disable the Decorator plugin
- `LIMITLESS_DECORATOR_TEMPLATES`: JSON string with custom templates
- `LIMITLESS_PLUGIN_SEMANTIC_SEARCH`: Set to "false" to disable the Semantic Search plugin
- `LIMITLESS_SEMANTIC_SEARCH_TTL`: TTL for embeddings cache in seconds (default: 3600)
- `LIMITLESS_SEMANTIC_SEARCH_MAX_KEYS`: Maximum number of embeddings to cache (default: 1000)
- `LIMITLESS_PLUGIN_TIME_PARSER`: Set to "false" to disable the Time Parser plugin
- `LIMITLESS_DEFAULT_TIMEZONE`: Default timezone for time parsing (default: "UTC")

For more details on plugin configuration, see [plugins.md](docs/plugins.md).

## 🛠️ Development

### Local Setup

```bash
# Clone the repository
git clone https://github.com/jakerains/limitless-mcp.git
cd limitless-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode with auto-reload
LIMITLESS_API_KEY="your-api-key" npm run dev

# Or start the production server
LIMITLESS_API_KEY="your-api-key" npm start
```

### Testing Locally

To test with a locally running instance:

```json
{
  "mcpServers": {
    "limitless-mcp": {
      "command": "node",
      "args": ["/path/to/limitless-mcp/dist/main.js"],
      "env": {
        "LIMITLESS_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Limitless AI](https://www.limitless.ai/) for their incredible Pendant device and API
- [Model Context Protocol](https://github.com/modelcontextprotocol/mcp) team for creating the standard
- All contributors and users of this project

---

<p align="center">Made with ❤️ for enhancing AI interactions with your personal data</p> 