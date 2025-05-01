# Limitless MCP Project Map

## Overview
Limitless MCP is a server implementation of the Model Context Protocol (MCP) that provides AI assistants like Claude with access to Limitless API data from a user's Pendant device. The server acts as a bridge between AI systems and personal data collected via the Limitless Pendant.

## Architecture

### Core Components
- **MCP Server**: Implements the Model Context Protocol for communication with AI assistants.
- **Limitless API Client**: Handles authentication and data retrieval from the Limitless API.
- **Resource System**: Provides virtual resources (files) that Claude can read.
- **Tool System**: Provides callable functions that Claude can use to query and manipulate data.

### Technical Decisions
1. Built on TypeScript with ES module support for better type safety and modern JavaScript features.
2. Uses the official MCP SDK for reliable protocol compatibility.
3. Communicates over stdio for compatibility with Claude Desktop and other MCP-compatible clients.
4. Error messages and logs are directed to stderr to avoid interfering with the JSON protocol.

## Resources
- `lifelogs://{id}` - Virtual resource that returns the markdown content of a lifelog when read.

## Tools

### Data Retrieval Tools
- `list_lifelogs` - Lists lifelogs with enhanced filtering options (date, timezone, pagination).
- `get_paged_lifelogs` - Handles pagination for larger result sets via cursor.
- `search_lifelogs` - Searches lifelogs by text content with date filtering.
- `get_lifelog` - Retrieves a complete lifelog by ID.
- `get_lifelog_metadata` - Retrieves only metadata about a lifelog for quicker operations.

### Data Analysis Tools
- `get_day_summary` - Provides a formatted summary of a specific day's lifelogs.
- `get_time_summary` - Generates time-based statistics and analysis of lifelogs (counts, durations, etc.).

### Content Processing Tools
- `filter_lifelog_contents` - Filters lifelog content by speaker, content type, or time range.
- `generate_transcript` - Creates formatted transcripts in various styles (simple, detailed, dialogue).

## Configuration
- Reads the Limitless API key from the `LIMITLESS_API_KEY` environment variable.
- Supports various date formats and timezones for flexible querying.
- Configurable result limits for tools that return multiple items.

## API Integration
- Primary endpoint: `https://api.limitless.ai/v1/lifelogs`
- Authentication via `X-API-Key` header
- Support for query parameters:
  - Basic: date, timezone
  - Advanced: cursor, start/end times, direction, includeMarkdown
- Individual lifelog retrieval via `/lifelogs/{id}`

## Future Development
1. Additional endpoints as they become available in the Limitless API
2. Enhanced caching for frequently accessed data
3. LLM fine-tuning integration for personalized AI experiences
4. Real-time notifications of new Pendant recordings

## Version History
- v0.1.0 - Initial implementation with basic functionality
- v0.2.x - Enhanced filtering, better error handling, full lifelog retrieval
- v0.3.0 - Added pagination, transcript generation, content filtering, time analysis, and metadata tools

## Project Structure

```
limitless-mcp/
├── src/                  # Source code
│   └── index.ts          # Main server implementation
├── dist/                 # Compiled JavaScript output
├── docs/                 # Documentation
│   ├── README.md         # General usage documentation
│   ├── CHANGELOG.md      # Version history
│   └── project-map.md    # This file
├── package.json          # Project metadata and dependencies
└── tsconfig.json         # TypeScript configuration
```

## Dependencies

- **@modelcontextprotocol/sdk**: Core MCP SDK for server implementation.
- **undici**: Used for HTTP requests to the Limitless API.
- **zod**: Schema validation for tool parameters.
- **typescript**: Development dependency for TypeScript compilation.

## Future Enhancements

- Support for additional Limitless API endpoints as they become available
- Enhanced search capabilities with fuzzy matching or semantic search
- Improved caching for better performance
- Additional MCP tools for specific use cases
- Support for cross-lifelog analysis and summarization 