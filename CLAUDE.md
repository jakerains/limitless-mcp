# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Limitless MCP is a Model Context Protocol server that connects Limitless Pendant data to AI assistants like Claude. It's built as a Node.js TypeScript application using the MCP SDK.

## Commands

### Build
```bash
npm run build       # Build with TypeScript (continues on errors)
npm run build:force # Force build despite TypeScript errors
```

### Development
```bash
npm run dev         # Run in development mode with tsx
npm start          # Run the built production server
```

Note: There are no lint or test commands configured. TypeScript compilation serves as the primary code validation.

## Architecture

### Core Components

1. **MCP Server Entry Point** (`src/main.ts`)
   - Initializes the MCP server
   - Registers resources, tools, and plugins
   - Handles server lifecycle and shutdown

2. **Tool System** (`src/tools/`)
   - **index.ts**: Central registry that orchestrates all tool registration
   - **lifelog-tools.ts**: Core CRUD operations for lifelogs
   - **analysis-tools.ts**: Advanced analysis (summarization, sentiment, topics)
   - **cache-tools.ts**: Cache management functionality

3. **Plugin Architecture** (`src/plugins/`)
   - **index.ts**: Plugin loader and registry
   - **types.ts**: Plugin interface definitions
   - Built-in plugins:
     - Content Processor: Transform and filter lifelog content
     - Decorator: Apply templates to format output
     - Semantic Search: Embeddings-based search
     - Time Parser: Natural language time parsing

4. **API Client** (`src/api/client.ts`)
   - Handles all Limitless API communication
   - Implements retry logic and error handling
   - Manages authentication via API key

5. **Configuration** (`src/config.ts`)
   - Centralized environment variable management
   - Configurable timeouts, retries, cache settings
   - Plugin enable/disable controls

## Key Development Patterns

1. **Tool Registration**: All tools follow a consistent registration pattern via the MCP SDK's server.tool() method

2. **Error Handling**: Custom error types in `src/utils/errors.ts` for API failures, validation issues, and plugin errors

3. **Caching Strategy**: NodeCache with configurable TTLs for different data types (metadata, listings, search results, summaries)

4. **Plugin Development**: Plugins implement the `LimitlessPlugin` interface and can register their own tools and resources

## Environment Variables

Required:
- `LIMITLESS_API_KEY`: Authentication for Limitless API

Important optional settings:
- `LIMITLESS_API_TIMEOUT_MS`: API request timeout (default: 120000)
- `LIMITLESS_CACHE_TTL`: Base cache TTL in seconds (default: 300)
- `LIMITLESS_PLUGINS_ENABLED`: Enable/disable plugin system (default: true)

## Common Tasks

### Adding a New Tool
1. Create the tool function in the appropriate file under `src/tools/`
2. Register it in the corresponding register function
3. Update the tool's schema with proper input/output types

### Creating a Plugin
1. Create a new file in `src/plugins/` implementing the `LimitlessPlugin` interface
2. Add plugin initialization in `src/plugins/index.ts`
3. Add environment variable controls in `src/config.ts` if needed

### Debugging API Issues
- Check `src/api/client.ts` for request/response handling
- API errors are logged to stderr to avoid interfering with MCP communication
- Use `LIMITLESS_API_TIMEOUT_MS` and `LIMITLESS_API_MAX_RETRIES` for reliability tuning