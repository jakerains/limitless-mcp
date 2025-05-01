# Changelog

All notable changes to the Limitless MCP project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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