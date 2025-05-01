# 🔮 Limitless MCP

[![npm version](https://img.shields.io/npm/v/limitless-mcp.svg)](https://www.npmjs.com/package/limitless-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/limitless-mcp)](https://nodejs.org/)

> Connect your [Limitless](https://www.limitless.ai/) Pendant data to Claude and other LLMs via the Model Context Protocol (MCP).

Limitless MCP is a server implementation of the [Model Context Protocol](https://github.com/modelcontextprotocol/mcp) that provides seamless access to your Limitless API data for AI assistants like Claude.

![Limitless MCP Demo](https://www.limitless.ai/developers/img/developer-api.png)

## ✨ Features

- 🔍 **Search & Explore** your Limitless Lifelogs directly from Claude
- 📅 **Date Filtering** with timezone support for precise data retrieval
- 📝 **Daily Summaries** of your Pendant recordings
- 🔒 **Secure Authentication** using your Limitless API key
- 🔄 **Seamless Integration** with Claude Desktop, Cursor, and other MCP-compatible clients

## 📋 Prerequisites

- Node.js 16 or higher
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

- **Date filtering**:
  ```
  List my lifelogs from last week.
  ```

## 🧰 Available Tools

### `list_lifelogs`
Lists your lifelogs with filtering options:
- `limit`: Maximum number of lifelogs to return (default: 10)
- `date`: Date in YYYY-MM-DD format
- `timezone`: IANA timezone specifier (e.g., "America/Los_Angeles")
- `start`: Start date/time
- `end`: End date/time
- `direction`: Sort direction ("asc" or "desc")

### `search_lifelogs`
Searches your lifelogs by text content:
- `query`: Text to search for
- `limit`: Maximum number of results to return
- `date`, `timezone`, `start`, `end`: Same as above

### `get_day_summary`
Provides a formatted summary of a specific day's lifelogs:
- `date`: Date in YYYY-MM-DD format
- `timezone`: IANA timezone specifier

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

# Start the server
LIMITLESS_API_KEY="your-api-key" npm start
```

### Testing Locally

To test with a locally running instance:

```json
{
  "mcpServers": {
    "limitless-mcp": {
      "command": "node",
      "args": ["/path/to/limitless-mcp/dist/index.js"],
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