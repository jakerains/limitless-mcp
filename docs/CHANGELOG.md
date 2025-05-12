# Changelog

All notable changes to the Limitless MCP project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2024-07-15

### Added
- Implemented proper error handling using McpError with specific error codes
- Added advanced caching system with customizable TTL multipliers for different data types
- Added selective cache clearing by data type
- Added extensive environment variable configuration options
- Created comprehensive examples and integration guides
- Added detailed project structure documentation

### Changed
- Completely refactored codebase for improved modularity and maintainability
- Split monolithic index.ts into discrete, focused modules
- Fixed parameter usage issues (includeMarkdown parameter now properly respected)
- Updated Node.js requirement to 18+ for native fetch API support
- Updated dependencies (@modelcontextprotocol/sdk to 1.11.1, zod to 3.24.4)
- Improved API client with retry logic and proper error handling
- Enhanced documentation with detailed examples, integration guides, and project map

### Fixed
- Fixed issue where includeMarkdown parameter was ignored in search results
- Fixed path specification in package.json for main and bin entries

## [0.4.0] - 2024-06-30

### Added
- Implemented caching system with configurable TTL and max size
- Added selective field retrieval for reduced response size and better performance
- Enhanced search with relevance-based scoring and content snippets
- Added semantic search using text embeddings for concept-based retrieval
- Added natural language time reference parsing for intuitive date filtering
- Added automatic summarization with different detail levels and focus areas
- Implemented topic extraction across lifelogs
- Added sentiment analysis for conversations with speaker breakdown
- Created plugin architecture for extending functionality
- Added Content Processor plugin for transforming lifelog content
- Added Decorator plugin for applying templates to lifelog content
- Added Semantic Search plugin for concept-based retrieval
- Added Time Parser plugin for natural language date handling
- Added configuration options via environment variables
- Created comprehensive documentation for new features

### Changed
- Improved response formatting across all tools
- Enhanced error handling and logging
- Updated README with new tools and features

## [0.3.0] - 2024-06-24

### Added
- Added `get_paged_lifelogs` tool for navigating through paginated results
- Added `get_lifelog_metadata` tool to retrieve only metadata without full content
- Added `filter_lifelog_contents` tool to filter lifelog content by speaker, type, or time
- Added `generate_transcript` tool to create formatted transcripts in simple, detailed, or dialogue format
- Added `get_time_summary` tool for time-based statistics and analysis of lifelogs

### Changed
- Updated from version 0.2.3 to 0.3.0 due to significant new functionality
- Improved error handling across all tools

## [0.2.3] - 2024-06-23

### Fixed
- Fixed console output interfering with JSON protocol by redirecting logs to stderr

## [0.2.2] - 2024-06-22

### Fixed
- Updated ESM imports to ensure proper compatibility

## [0.2.1] - 2024-06-21

### Added
- First public npm release
- Added enhanced date filtering capabilities
- Created `get_day_summary` tool for summarizing daily lifelogs
- Expanded `list_lifelogs` and `search_lifelogs` tools with more parameters
- Added `get_lifelog` tool to retrieve full conversation text by ID

### Changed
- Fixed URLSearchParams handling
- Added proper type definitions
- Improved error handling

## [0.1.0] - 2024-06-20

### Added
- Initial implementation of Limitless MCP server
- Basic functionality to connect to Limitless API
- Support for retrieving lifelogs 