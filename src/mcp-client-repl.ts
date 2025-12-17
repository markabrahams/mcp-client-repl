import dotenv from 'dotenv';
import readline from 'readline/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/**
 * MCP Error Code definitions and helper functions
 */
const MCP_ERROR_CODES = {
    AUTHENTICATION_ERROR: -32000,
    INVALID_SESSION: -32001,
    METHOD_NOT_FOUND: -32002,
    INVALID_PARAMETERS: -32003,
    INTERNAL_ERROR: -32004,
    PARSE_ERROR: -32005,
} as const;

interface McpErrorInfo {
    code: number;
    name: string;
    description: string;
    commonCause: string;
    howToHandle: string;
}

const MCP_ERROR_INFO: Record<number, McpErrorInfo> = {
    [MCP_ERROR_CODES.AUTHENTICATION_ERROR]: {
        code: -32000,
        name: 'Authentication Error',
        description: 'Missing or invalid authentication token',
        commonCause: 'The API key or authentication credentials are missing or invalid',
        howToHandle: 'Check your MCP_API_KEY environment variable or provide a valid API key when connecting',
    },
    [MCP_ERROR_CODES.INVALID_SESSION]: {
        code: -32001,
        name: 'Invalid Session',
        description: 'Session ID not found or expired',
        commonCause: 'The session has expired or was not properly initialized',
        howToHandle: 'Disconnect and reconnect to reinitialize the session',
    },
    [MCP_ERROR_CODES.METHOD_NOT_FOUND]: {
        code: -32002,
        name: 'Method Not Found',
        description: 'The requested method does not exist',
        commonCause: 'Called a tool or method that is not available on this server',
        howToHandle: 'Use "tools" command to list available tools and verify the method name',
    },
    [MCP_ERROR_CODES.INVALID_PARAMETERS]: {
        code: -32003,
        name: 'Invalid Parameters',
        description: 'Missing or invalid parameters',
        commonCause: 'The parameters provided do not match the expected schema',
        howToHandle: 'Use "tool <toolName>" to see the expected parameters schema and validate your input',
    },
    [MCP_ERROR_CODES.INTERNAL_ERROR]: {
        code: -32004,
        name: 'Internal Error',
        description: 'Server-side exception occurred',
        commonCause: 'An unexpected error occurred on the server',
        howToHandle: 'Check server logs for details. This may be a bug in the MCP server implementation',
    },
    [MCP_ERROR_CODES.PARSE_ERROR]: {
        code: -32005,
        name: 'Parse Error',
        description: 'Invalid JSON format',
        commonCause: 'The request contained malformed JSON',
        howToHandle: 'Verify your JSON syntax. Use proper escaping and formatting',
    },
};

/**
 * Format an error with MCP error code interpretation
 */
function formatMcpError(error: any): string {
    let errorMessage = '';
    
    // Extract error code if available
    let errorCode: number | undefined;
    if (error?.code !== undefined) {
        errorCode = error.code;
    } else if (error?.error?.code !== undefined) {
        errorCode = error.error.code;
    } else if (error?.response?.error?.code !== undefined) {
        errorCode = error.response.error.code;
    }
    
    // Try to extract error message
    let originalMessage = error?.message || error?.error?.message || error?.toString() || 'Unknown error';
    
    errorMessage += `Error: ${originalMessage}\n`;
    
    // If we have a recognized MCP error code, add helpful information
    if (errorCode !== undefined && MCP_ERROR_INFO[errorCode]) {
        const info = MCP_ERROR_INFO[errorCode];
        errorMessage += `\n📋 MCP Error Details:\n`;
        errorMessage += `   Code: ${info.code}\n`;
        errorMessage += `   Name: ${info.name}\n`;
        errorMessage += `   Description: ${info.description}\n`;
        errorMessage += `   Common Cause: ${info.commonCause}\n`;
        errorMessage += `   How to Handle: ${info.howToHandle}\n`;
    } else if (errorCode !== undefined) {
        errorMessage += `\nError Code: ${errorCode} (unknown MCP error code)\n`;
    }
    
    return errorMessage;
}

class McpRepl {

    private mcp: Client;
    private transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport | null = null;
    private connected = false;
    private transportType: 'stdio' | 'sse' | 'http' | null = null;
    private transportTarget: string | null = null;
    private tools: { name: string; description: string; input_schema?: any }[] = [];

    constructor() {
        this.mcp = new Client(
            {
                name: 'mcp-cli',
                version: '1.0.0',
            }
        );
    }

    async connectScript(scriptPath: string) {
        console.log(`Connecting via stdio to ${scriptPath}`);
        
        try {
            // If scriptPath contains shell commands or starts with a command (npx, node, etc.), use bash
            const isShellCommand = scriptPath.includes('&&') || 
                                   scriptPath.includes('cd ') || 
                                   scriptPath.startsWith('npx ') ||
                                   scriptPath.includes(' ');
            
            if (isShellCommand) {
                this.transport = new StdioClientTransport({
                    command: '/bin/bash',
                    args: ['-c', scriptPath],
                });
            } else {
                // Simple script path without spaces or shell operators, use node to execute
                this.transport = new StdioClientTransport({
                    command: process.execPath,
                    args: [scriptPath],
                });
            }
            
            await this.mcp.connect(this.transport);
            console.log(`Connected via stdio to ${scriptPath}`);
            this.connected = true;
            this.transportType = 'stdio';
            this.transportTarget = scriptPath;
        } catch (error) {
            console.error(`Failed to connect via stdio:\n${formatMcpError(error)}`);
            throw error;
        }
    }

    async connectSSE(url: string, apiKey?: string) {
        console.log(`Connecting via SSE to ${url}`);
        
        try {
            this.transport = new SSEClientTransport(
                new URL(url),
                {
                    requestInit: {
                        headers: apiKey ? { 'x-api-key': apiKey } : undefined,
                    }
                }
            );
            await this.mcp.connect(this.transport);
            console.log(`Connected via SSE to ${url}`);
            this.connected = true;
            this.transportType = 'sse';
            this.transportTarget = url;
        } catch (error) {
            console.error(`Failed to connect via SSE:\n${formatMcpError(error)}`);
            throw error;
        }
    }

    async connectHTTP(url: string, apiKey?: string) {
        console.log(`Connecting via HTTP to ${url}`);
        
        try {
            this.transport = new StreamableHTTPClientTransport(
                new URL(url),
                {
                    requestInit: {
                        headers: apiKey ? { 'x-api-key': apiKey } : undefined,
                    }
                }
            );
            await this.mcp.connect(this.transport);
            console.log(`Connected via HTTP to ${url}`);
            this.connected = true;
            this.transportType = 'http';
            this.transportTarget = url;
        } catch (error) {
            console.error(`Failed to connect via HTTP:\n${formatMcpError(error)}`);
            throw error;
        }
    }

    async disconnect() {
        if ( this.connected ) {
            await this.mcp.close();
        }
        console.log(`Disconnected from ${this.transportTarget}`);
        this.connected = false;
        this.transport = null;
        this.transportType = null;
        this.transportTarget = null;
        this.tools = [];
        
        // Create a new client instance since the old one is now closed and cannot be reused
        this.mcp = new Client(
            {
                name: 'mcp-cli',
                version: '1.0.0',
            }
        );
    }

    status() {
        console.log(this.connected ? `Connected via ${this.transportType} to ${this.transportTarget}` : 'Not connected');
    }

    async listTools(full: boolean = false) {
        if ( ! this.connected ) {
            return console.log('Not connected.');
        }
        
        try {
            const toolsResult = await this.mcp.listTools();
            this.tools = toolsResult.tools.map((t) => ({
                name: t.name,
                description: t.description,
                input_schema: t.inputSchema,
            }));

            if ( this.tools.length === 0 ) {
                return console.log('No tools available.');
            }

            if (full) {
                console.log('Available tools (full details):');
                console.log(JSON.stringify(this.tools, null, 2));
            } else {
                console.log('Available tools:');
                this.tools.forEach((t) => console.log(`- ${t.name}: ${t.description}`));
            }
        } catch (error) {
            console.error(`Failed to list tools:\n${formatMcpError(error)}`);
        }
    }

    async showTool(toolName: string) {
        if ( ! this.connected ) {
            return console.log('Not connected.');
        }
        
        try {
            // Ensure tools are loaded
            if ( this.tools.length === 0 ) {
                await this.listTools();
            }
            
            const tool = this.tools.find((t) => t.name === toolName);
            if ( ! tool ) {
                return console.log(`Tool ${toolName} not found.`);
            }

            console.log(`Tool: ${tool.name}`);
            console.log(JSON.stringify(tool, null, 2));
        } catch (error) {
            console.error(`Failed to show tool:\n${formatMcpError(error)}`);
        }
    }

    async call(toolName: string, args: Record<string, any>) {
        if ( ! this.connected ) {
            return console.log('Not connected.');
        }
        if ( ! this.tools.find((t) => t.name === toolName) ) {
            return console.log(`Tool ${toolName} not found.`);
        }

        try {
            const result = await this.mcp.callTool({
                name: toolName,
                arguments: args
            });
            console.log('Tool result:', result.content);
        } catch (error) {
            console.error(`Failed to call tool:\n${formatMcpError(error)}`);
        }
    }

    async loadEnvFile(filePath: string) {
        console.log(`Loading environment variables from ${filePath}`);
        try {
            // Load the environment file and update process.env
            dotenv.config({
                path: filePath,
                override: true
            });
            console.log(`Environment variables loaded from ${filePath}`);
            return true;
        } catch (error) {
            console.error(`Failed to load environment file ${filePath}:`, error);
            return false;
        }
    }

    async autoConnect() {
        const serverUrl = process.env.MCP_SERVER_URL;
        const transport = process.env.MCP_TRANSPORT;
        const apiKey = process.env.MCP_API_KEY;

        if ( ! serverUrl || ! transport ) {
            console.log('No automatic connection (use MCP_SERVER_URL or MCP_TRANSPORT environment variables for this)');
            return false;
        }

        console.log(`Attempting automatic ${transport} connection from config to ${serverUrl}`);
        
        try {
            switch (transport.toLowerCase()) {
                case 'sse':
                    await this.connectSSE(serverUrl, apiKey);
                    return true;
                case 'http':
                    await this.connectHTTP(serverUrl, apiKey);
                    return true;
                case 'stdio':
                    await this.connectScript(serverUrl);
                    return true;
                default:
                    console.log(`Unsupported transport type: ${transport}. Supported types: sse, http, stdio`);
                    return false;
            }
        } catch (error) {
            console.error(`Automatic connection failed:\n${formatMcpError(error)}`);
            return false;
        }
    }

    async repl() {
        const rl: readline.Interface = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        console.log("Node MCP Client REPL. Type 'help' for commands.");

        // Attempt automatic connection
        await this.autoConnect();

        while (true) {
            const line: string = await rl.question('\nmcp> ');
            const [cmd, ...args] = line.trim().split(' ');

            switch (cmd) {
                case 'help':
                    console.log(`
Commands:
  connect sse|http|stdio <url_or_script> [apiKey]  Connect to MCP server
  connectenv <file>                                Load environment variables from file, disconnect, and reconnect
  disconnect                                       Disconnect from MCP server
  status                                           Show connection status
  tools [full]                                     List available tools (add 'full' for complete details)
  tool <toolName>                                  Show full description for a single tool
  call <toolName> <JSON>                           Call a tool with JSON arguments e.g. call generate_image {"prompt": "A beautiful sunset"}
  help                                             Show this help
  exit                                             Exit the REPL`);
                    break;
                case 'exit':
                    await this.disconnect();
                    rl.close();
                    return;
                case 'status':
                    this.status();
                    break;
                case 'connect':
                    const [type, target, apiKey] = args;
                    if ( ! type || ! target ) {
                        console.log('Usage: connect sse|http|stdio <url_or_script> [apiKey]');
                        break;
                    }
                    try {
                        if ( type === 'stdio' ) {
                            await this.connectScript(target);
                        } else if ( type === 'http' ) {
                            await this.connectHTTP(target, apiKey);
                        } else if ( type === 'sse' ) {
                            await this.connectSSE(target, apiKey);
                        } else {
                            console.log(`Unknown transport type: ${type}`);
                        }
                    } catch (error) {
                        // Error already formatted and logged in connect methods
                    }
                    break;
                case 'connectenv': {
                    const [envFile] = args;
                    if ( ! envFile ) {
                        console.log('Usage: connectenv <file>');
                        break;
                    }
                    // Disconnect if currently connected
                    if (this.connected) {
                        await this.disconnect();
                    }
                    // Load new environment variables from file
                    const loaded = await this.loadEnvFile(envFile);
                    if (loaded) {
                        // Connect using the newly loaded environment variables
                        await this.autoConnect();
                    }
                    break;
                }
                case 'disconnect':
                    await this.disconnect();
                    break;
                case 'tools':
                    const full = args.includes('full');
                    await this.listTools(full);
                    break;
                case 'tool': {
                    const toolName = args[0];
                    if ( ! toolName ) {
                        console.log('Usage: tool <toolName>');
                        break;
                    }
                    await this.showTool(toolName);
                    break;
                }
                case 'call': {
                    const [toolName, ...jsonParts] = args;
                    if ( ! toolName ) {
                        console.log('Usage: call <toolName> <JSON>');
                        break;
                    }
                    let parsedArgs = {};
                    try {
                        parsedArgs = JSON.parse(jsonParts.join(' ') || '{}');
                    } catch (err) {
                        console.error('Invalid JSON:', err);
                        console.log('Format example: call get_product {"id":"P0234"}');
                        break;
                    }
                    console.log(`Invoking tool: ${toolName} with arguments: ${JSON.stringify(parsedArgs)}`);
                    await this.call(toolName, parsedArgs);
                    break;
                }
                case '':
                    break;
                default:
                    console.log("Unknown command. Type 'help' for a list of commands.");
            }
        }
    }
}

async function main() {
    // Parse command-line arguments
    const args = process.argv.slice(2);
    
    // Check for help flag
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Usage: npm start [envFile]
       tsx src/mcp-client-repl.ts [envFile]

Arguments:
  envFile    Optional path to .env file to load on startup (default: .env)

Examples:
  npm start                  # Load default .env file
  npm start .env-stdio       # Load .env-stdio file
  npm start .env-sse         # Load .env-sse file
`);
        process.exit(0);
    }
    
    // Load environment variables from specified file or default
    const envFile = args[0];
    if (envFile) {
        console.log(`Loading environment from ${envFile}`);
        dotenv.config({
            path: envFile,
            override: true
        });
    } else {
        // Load default .env file if it exists
        dotenv.config({
            quiet: true
        });
    }
    
    const client = new McpRepl();
    await client.repl();
}

main();
