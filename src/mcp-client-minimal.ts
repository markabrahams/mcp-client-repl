import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/**
 * MCP Error Code definitions
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
        howToHandle: 'Check your API_KEY constant and ensure it\'s valid',
    },
    [MCP_ERROR_CODES.INVALID_SESSION]: {
        code: -32001,
        name: 'Invalid Session',
        description: 'Session ID not found or expired',
        commonCause: 'The session has expired or was not properly initialized',
        howToHandle: 'Reconnect to reinitialize the session',
    },
    [MCP_ERROR_CODES.METHOD_NOT_FOUND]: {
        code: -32002,
        name: 'Method Not Found',
        description: 'The requested method does not exist',
        commonCause: 'Called a tool or method that is not available on this server',
        howToHandle: 'List available tools and verify the method name',
    },
    [MCP_ERROR_CODES.INVALID_PARAMETERS]: {
        code: -32003,
        name: 'Invalid Parameters',
        description: 'Missing or invalid parameters',
        commonCause: 'The parameters provided do not match the expected schema',
        howToHandle: 'Check the tool schema and validate your input parameters',
    },
    [MCP_ERROR_CODES.INTERNAL_ERROR]: {
        code: -32004,
        name: 'Internal Error',
        description: 'Server-side exception occurred',
        commonCause: 'An unexpected error occurred on the server',
        howToHandle: 'Check server logs for details. This may be a bug in the MCP server',
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

async function main() {

    const MCP_URL = "http://localhost:8206/mcp";
    const API_KEY = '<api-key>';

    try {
        const transport = new StreamableHTTPClientTransport(
          new URL(MCP_URL),
            {
                requestInit: {
                    headers: { 'x-api-key': API_KEY },
                }
            }
        );
        const client = new Client({
            name: "minimal-test",
            version: "1.0.0"
        });
        
        await client.connect(transport);
        console.log(`Client connected successfully to ${MCP_URL}`);
        
        const toolsResult = await client.listTools();
        console.log("Tools:");
        toolsResult.tools.forEach(
            (t) => console.log(`- ${t.name}: ${t.description}`)
        );
        
        await client.close();
        console.log("Client closed");
    } catch (error) {
        console.error(`MCP Client Error:\n${formatMcpError(error)}`);
        process.exit(1);
    }
}

main();
