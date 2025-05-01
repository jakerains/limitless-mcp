# Project Map: Limitless MCP

## Overview

The Limitless MCP project provides a Model Context Protocol (MCP) server implementation that connects to the Limitless API, allowing AI models like Claude to access Limitless data through the MCP interface.

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

## Core Components

### MCP Server Implementation

The core server logic is implemented in `src/index.ts`. It creates an MCP server with resources and tools for interacting with the Limitless API.

#### Resources

- **lifelogs**: Exposes Limitless Lifelogs as virtual markdown files through the `lifelogs://{id}` URI schema.

#### Tools

- **list_lifelogs**: Lists lifelogs with extensive filtering options:
  - Limit number of results
  - Filter by date or date range
  - Specify timezone
  - Sort direction
  - Results include timestamps and pagination support

- **search_lifelogs**: Searches lifelogs for text content with enhanced filtering:
  - Text search in content and titles
  - Date filtering
  - Timezone specification
  - Results include timestamps

- **get_day_summary**: Creates a formatted summary of a specific day:
  - Shows all lifelogs for a given date
  - Formats timestamps according to specified timezone
  - Provides excerpts of each lifelog
  - Orders entries chronologically

### API Integration

The server connects to the Limitless API using:

- API Key authentication via the `LIMITLESS_API_KEY` environment variable
- TypeScript interfaces defining the API response structure
- Comprehensive error handling and input validation
- Support for all major API parameters (date filtering, pagination, etc.)

## Technical Decisions

1. **ES Modules**: Implemented as an ES module for modern Node.js compatibility.
2. **TypeScript**: Used for type safety and better developer experience.
3. **Error Handling**: Comprehensive error handling for API failures.
4. **URI Schema**: Simple URI schema (`lifelogs://{id}`) for accessing lifelogs.
5. **Resource Listing**: Directory listing capability for discovering available lifelogs.
6. **Parameter Validation**: Using Zod for schema validation with descriptive parameter information.
7. **Timezone Support**: First-class support for timezone specifications in date handling.

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