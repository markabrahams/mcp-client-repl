import dotenv from 'dotenv';
import readline from 'readline/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

dotenv.config({
    quiet: true
});

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
        this.transport = new StdioClientTransport({
            command: process.execPath,
            args: [scriptPath],
        });
        await this.mcp.connect(this.transport);
        console.log(`Connected via stdio to ${scriptPath}`);
        this.connected = true;
        this.transportType = 'stdio';
        this.transportTarget = scriptPath;
        const toolsResult = await this.mcp.listTools();
        this.tools = toolsResult.tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.inputSchema,
        }));
        await this.listTools();
    }

    async connectSSE(url: string, apiKey?: string) {
        console.log(`Connecting via SSE to ${url}`);
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
        const toolsResult = await this.mcp.listTools();
        this.tools = toolsResult.tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.inputSchema,
        }));
        await this.listTools();
    }

    async connectHTTP(url: string, apiKey?: string) {
        console.log(`Connecting via HTTP to ${url}`);
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
        const toolsResult = await this.mcp.listTools();
        this.tools = toolsResult.tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.inputSchema,
        }));
        await this.listTools();
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
    }

    status() {
        console.log(this.connected ? `Connected via ${this.transportType} to ${this.transportTarget}` : 'Not connected');
    }

    async listTools(full: boolean = false) {
        if ( ! this.connected ) {
            return console.log('Not connected.');
        }
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
        } catch (err) {
            console.error('Failed to call tool:', err);
        }
    }

    async autoConnect() {
        const serverUrl = process.env.MCP_SERVER_URL;
        const transport = process.env.MCP_TRANSPORT;
        const apiKey = process.env.MCP_API_KEY;

        if ( ! serverUrl || ! transport ) {
            console.log('No MCP_SERVER_URL or MCP_TRANSPORT found in environment variables.');
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
            console.error('Automatic connection failed:', error);
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
  disconnect                                       Disconnect from MCP server
  status                                           Show connection status
  tools [full]                                     List available tools (add 'full' for complete details)
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
                    if ( type === 'stdio' ) {
                        await this.connectScript(target);
                    } else if ( type === 'http' ) {
                        await this.connectHTTP(target, apiKey);
                    } else if ( type === 'sse' ) {
                        await this.connectSSE(target, apiKey);
                    } else {
                        console.log(`Unknown transport type: ${type}`);
                    }
                    break;
                case 'disconnect':
                    await this.disconnect();
                    break;
                case 'tools':
                    const full = args.includes('full');
                    await this.listTools(full);
                    break;
                case 'call':
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
                case '':
                    break;
                default:
                    console.log("Unknown command. Type 'help' for a list of commands.");
            }
        }
    }
}

async function main() {
    const client = new McpRepl();
    await client.repl();
}

main();
