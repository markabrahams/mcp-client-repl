# MCP Client REPL

An interactive REPL (Read-Eval-Print Loop) client for interacting with [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) servers via command line.

## Overview

This tool provides a user-friendly command-line interface for connecting to and interacting with MCP servers. It supports multiple transport methods and allows you to list available tools, and call tools, and manage connections interactively.

## Features

- **Multiple Transport Support**: Connect via stdio, SSE (Server-Sent Events), or Streamable HTTP
- **Interactive REPL**: Easy-to-use command-line interface
- **Auto-Connect**: Automatically connect on startup using environment variables
- **Tool Management**: List and call tools from connected MCP servers
- **Environment-Based Configuration**: Configure connections via `.env` file
- **API key authentication**: Supports MCP servers using `x-api-key` header authentication
- **Enhanced Error Handling**: Developer-friendly error messages with detailed explanations and recovery instructions

## Error Handling

The REPL includes comprehensive error handling for common MCP error codes. When an error occurs, you'll receive detailed information including:

- **Error Code**: The numeric MCP error code
- **Description**: What the error means
- **Common Cause**: Why this error typically occurs
- **How to Handle**: Step-by-step instructions to resolve the issue

### Supported Error Codes

| Code   | Error Name           | Description              | Common Cause                       |
|--------|----------------------|--------------------------|------------------------------------|
| -32000 | Authentication Error | Missing or invalid token | Missing or invalid API key         |
| -32001 | Invalid Session      | Session not found        | Session expired or not initialized |
| -32002 | Method Not Found     | Unknown method called    | Tool or method doesn't exist       |
| -32003 | Invalid Parameters   | Bad parameters           | Parameters don't match schema      |
| -32004 | Internal Error       | Server-side exception    | Bug or unexpected server error     |
| -32005 | Parse Error          | Invalid JSON             | Malformed JSON in request          |

### Example Error Output

```
Failed to connect via HTTP:
Error: Authentication failed

📋 MCP Error Details:
   Code: -32000
   Name: Authentication Error
   Description: Missing or invalid authentication token
   Common Cause: The API key or authentication credentials are missing or invalid
   How to Handle: Check your MCP_API_KEY environment variable or provide a valid API key when connecting
```

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd mcp-client-repl
```

2. Install dependencies:
```bash
npm install
```

## Usage

### Starting the REPL

Run the following command to start the REPL:

```bash
npm start
```

You can optionally specify a different environment file to load on startup:

```bash
npm start .env-stdio     # Load .env-stdio file
npm start .env-sse       # Load .env-sse file
npm start .env-http      # Load .env-http file
```

Or use `--help` to see usage information:

```bash
npm start -- --help
```

### Environment Variables (Optional)

Create a `.env` file in the project root to enable automatic connection on startup:

```env
MCP_SERVER_URL=https://your-mcp-server.com/sse
MCP_TRANSPORT=sse  # or 'http' or 'stdio'
MCP_API_KEY=your-api-key-here  # Optional
```

When these environment variables are set, the REPL will automatically attempt to connect on startup.

### Commands

| Command                            | Description                                                       |
|------------------------------------|-------------------------------------------------------------------|
| `connect <type> <target> [apiKey]` | Connect to an MCP server                                          |
| `connectenv <file>`                | Load environment variables from file, disconnect, and reconnect   |
| `disconnect`                       | Disconnect from the current server                                |
| `status`                           | Show connection status                                            |
| `tools [full]`                     | List available tools (add 'full' for complete details)            |
| `call <toolName> <JSON>`           | Call a tool with JSON arguments                                   |
| `help`                             | Show help message                                                 |
| `exit`                             | Exit the REPL                                                     |

### Connect to a Server

**SSE Connection:**
```
mcp> connect sse https://your-server.com/sse
```

**SSE with API Key:**
```
mcp> connect sse https://your-server.com/sse your-api-key
```

**HTTP Connection:**
```
mcp> connect http https://your-server.com/mcp
```

**stdio Connection (local script):**
```
mcp> connect stdio path/to/your/server.js
```

### Switch Between Server Configurations

You can dynamically switch between different MCP server configurations using the `connectenv` command. This is useful when you have multiple environment files (e.g., `.env-stdio`, `.env-sse`, `.env-http`) and want to switch between them without restarting the REPL:

```
mcp> connectenv .env-sse
Loading environment variables from .env-sse
Environment variables loaded from .env-sse
Disconnected from current server
Attempting automatic sse connection from config to http://localhost:3000/sse
Connected via SSE to http://localhost:3000/sse
```

This command will:
1. Disconnect from the current server (if connected)
2. Load new environment variables from the specified file
3. Automatically connect to the new server using the loaded configuration

### List Available Tools

**Basic listing:**
```
mcp> tools
```

**Full details with schemas:**
```
mcp> tools full
```

### Call a Tool

Call a tool with JSON arguments:

```
mcp> call get_weather {"city": "San Francisco"}
```

Example with complex arguments:
```
mcp> call generate_image {"prompt": "A beautiful sunset over mountains", "style": "photorealistic"}
```

### Check Status

```
mcp> status
```

### Example Session

```
$ npm start
Node MCP Client REPL. Type 'help' for commands.

mcp> connect sse https://example.com/mcp/sse my-api-key
Connecting via SSE to https://example.com/mcp/sse
Connected via SSE to https://example.com/mcp/sse
Available tools:
- get_weather: Get current weather information for a location
- search_images: Search for images based on query
- generate_text: Generate text based on prompt

mcp> tools full
Available tools (full details):
[
  {
    "name": "get_weather",
    "description": "Get current weather information for a location",
    "input_schema": {
      "type": "object",
      "properties": {
        "city": {
          "type": "string"
        }
      },
      "required": ["city"]
    }
  }
]

mcp> call get_weather {"city": "New York"}
Invoking tool: get_weather with arguments: {"city":"New York"}
Tool result: ...

mcp> exit
Disconnected from https://example.com/mcp/sse
```

## Project Structure

```
mcp-client-repl/
├── src/
│   └── mcp-client-repl.ts    # Main REPL implementation
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
└── README.md                  # This file
```

## Technologies Used

- **TypeScript**: Type-safe JavaScript
- **tsx**: TypeScript execution engine
- **@modelcontextprotocol/sdk**: Official Node.js MCP SDK
- **dotenv**: Environment variable management
- **readline**: Command-line interface

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Troubleshooting

### Common Issues and Solutions

**Authentication Error (-32000)**
- Check that your API key is correct and properly set in the environment variable or connect command
- Verify that the MCP server expects an `x-api-key` header

**Invalid Session (-32001)**
- Use the `disconnect` command followed by `connect` to reinitialize the session
- Or use `connectenv` to reload configuration and reconnect

**Method Not Found (-32002)**
- Use the `tools` command to see all available tools
- Check for typos in the tool name

**Invalid Parameters (-32003)**
- Use `tool <toolName>` to view the expected parameter schema
- Verify that your JSON is properly formatted and includes all required fields

**Parse Error (-32005)**
- Check your JSON syntax, especially quotes and brackets
- Example: `call get_weather {"city": "New York"}` not `call get_weather {city: New York}`

## Notes

- Make sure your MCP server is running and accessible before connecting
- Ensure you have the correct permissions for stdio-based connections
- All errors include detailed recovery instructions to help you resolve issues quickly
