import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function main() {

    const MCP_URL = "http://localhost:8206/mcp";
    const API_KEY = '<api-key>';

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
}

main();
