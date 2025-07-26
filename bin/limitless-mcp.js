#!/usr/bin/env node

// Check Node.js version before loading any modules
const majorVersion = parseInt(process.version.slice(1).split('.')[0], 10);

if (majorVersion < 18) {
  console.error(`
ERROR: Node.js version 18 or higher is required to run limitless-mcp.
Current version: ${process.version}

This is required for native fetch API support including ReadableStream.

Please upgrade Node.js to version 18 or higher:
- Visit https://nodejs.org/ to download the latest version
- Or use a version manager like nvm: https://github.com/nvm-sh/nvm

For Claude Desktop users:
- Make sure Node.js 18+ is installed and available in your PATH
- You may need to restart Claude Desktop after installing Node.js
`);
  process.exit(1);
}

// Version is OK, load the actual module
import('../dist/main.js');