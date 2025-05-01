# Limitless MCP Server

This package provides a [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/mcp) server for the [Limitless API](https://www.limitless.ai/developers). It allows Claude and other LLMs to access your Limitless data (currently Pendant lifelogs) via the MCP protocol.

## Installation

```bash
npm install -g limitless-mcp
```

Or use it directly with npx:

```bash
npx limitless-mcp
```

## Usage

### Configuration

You need to set your Limitless API key as an environment variable:

```bash
export LIMITLESS_API_KEY="your-api-key-here"
```

Then run the MCP server:

```bash
limitless-mcp
```

### MCP Host Configuration

To use this server with Claude or other MCP-enabled LLMs, add it to your MCP host configuration:

```json
{
  "mcpServers": {
    "limitless-mcp": {
      "command": "npx",
      "args": ["-y", "limitless-mcp"],     // pulls latest package & runs it
      "env": {
        "LIMITLESS_API_KEY": "your-api-key-here"     // only secret the user needs to add
      }
    }
  }
}
```

### Available Resources and Tools

This MCP server provides the following resources and tools for LLMs to use:

#### Resources

- `lifelogs://{id}` - Access a specific lifelog by ID

#### Tools

- `list_lifelogs` - Lists your lifelogs with filtering options
  - Parameters:
    - `limit` (optional): Maximum number of lifelogs to return (default: 10)
    - `date` (optional): Date in YYYY-MM-DD format
    - `timezone` (optional): IANA timezone specifier (e.g., "America/Los_Angeles")
    - `start` (optional): Start date/time in YYYY-MM-DD or YYYY-MM-DD HH:mm:SS format
    - `end` (optional): End date/time in YYYY-MM-DD or YYYY-MM-DD HH:mm:SS format
    - `direction` (optional): Sort direction ("asc" or "desc")

- `search_lifelogs` - Search your lifelogs by text content
  - Parameters:
    - `query`: Text to search for in lifelogs
    - `limit` (optional): Maximum number of results to return (default: 10)
    - `date` (optional): Date in YYYY-MM-DD format
    - `timezone` (optional): IANA timezone specifier
    - `start` (optional): Start date/time in YYYY-MM-DD or YYYY-MM-DD HH:mm:SS format
    - `end` (optional): End date/time in YYYY-MM-DD or YYYY-MM-DD HH:mm:SS format

- `get_day_summary` - Get a formatted summary of a specific day's lifelogs
  - Parameters:
    - `date`: Date in YYYY-MM-DD format
    - `timezone` (optional): IANA timezone specifier (default: "America/Los_Angeles")

### Example Usage (with Claude)

```
List my lifelogs from April, 29, 2024.
Search my lifelogs for conversations about AI.
Get a summary of my day on April, 29, 2024.
```

## Development

### Prerequisites

- Node.js 16+
- npm or yarn

### Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the project: `npm run build`
4. Set your API key: `export LIMITLESS_API_KEY="your-api-key-here"`
5. Run the server: `npm start`

### Building from Source

```bash
git clone https://github.com/your-username/limitless-mcp.git
cd limitless-mcp
npm install
npm run build
```

## License

[MIT](LICENSE) 