# Creating Your First MCP Client

## Introduction

An MCP client connects to one or more servers, discovers available tools, and invokes them on behalf of a language model. In this chapter you will build a CLI client that uses Claude as the model to decide which tools to invoke.

---

## Project Setup

```bash
mkdir mcp-client && cd mcp-client
npm init -y
npm install @modelcontextprotocol/sdk @anthropic-ai/sdk dotenv
npm install -D typescript @types/node
```

Create `tsconfig.json` (same as the server) and add to `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

Create `.env` with your API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Minimal Client

Create `src/index.ts`:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import * as readline from "node:readline";

config(); // Load .env

// Type for tools compatible with the Anthropic API
interface AnthropicTool {
  name: string;
  description: string | undefined;
  input_schema: Record<string, unknown>;
}

class McpChatClient {
  private client: Client;
  private anthropic: Anthropic;
  private tools: AnthropicTool[] = [];

  constructor() {
    this.client = new Client({
      name: "mcp-chat-client",
      version: "1.0.0",
    });
    this.anthropic = new Anthropic();
  }

  /**
   * Connect to the MCP server via STDIO.
   * The client launches the server as a child process.
   */
  async connect(serverCommand: string, serverArgs: string[]): Promise<void> {
    const transport = new StdioClientTransport({
      command: serverCommand,
      args: serverArgs,
    });

    // connect() performs the lifecycle: initialize -> initialized
    await this.client.connect(transport);

    // Discover available tools
    const result = await this.client.listTools();
    this.tools = result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Record<string, unknown>,
    }));

    console.error(
      `Connected to server. Available tools: ${this.tools.map((t) => t.name).join(", ")}`,
    );
  }

  /**
   * Process a user query with Claude's tool-use cycle.
   */
  async chat(userMessage: string): Promise<string> {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: userMessage },
    ];

    // First call to Claude with available tools
    let response = await this.anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages,
      tools: this.tools as Anthropic.Tool[],
    });

    // Tool-use cycle: Claude may request multiple tools in sequence
    while (response.stop_reason === "tool_use") {
      const assistantContent = response.content;
      messages.push({ role: "assistant", content: assistantContent });

      // Execute all requested tools
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of assistantContent) {
        if (block.type === "tool_use") {
          console.error(`  -> Tool invocation: ${block.name}(${JSON.stringify(block.input)})`);

          // Call the tool on the MCP server
          const result = await this.client.callTool({
            name: block.name,
            arguments: block.input as Record<string, unknown>,
          });

          const text = (result.content as Array<{ type: string; text: string }>)
            .map((c) => c.text)
            .join("\n");

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: text,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });

      // Call Claude again with the tool results
      response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages,
        tools: this.tools as Anthropic.Tool[],
      });
    }

    // Extract the final text
    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }
}

// --- Main: interactive CLI ---

async function main() {
  const serverScript = process.argv[2];
  if (!serverScript) {
    console.error("Usage: npm start -- /path/to/server/dist/index.js");
    process.exit(1);
  }

  const client = new McpChatClient();
  await client.connect("node", [serverScript]);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("MCP Chat started. Type 'exit' to quit.\n");

  const askQuestion = (): void => {
    rl.question("You: ", async (input) => {
      const trimmed = input.trim();
      if (trimmed === "exit") {
        await client.disconnect();
        rl.close();
        return;
      }
      if (!trimmed) {
        askQuestion();
        return;
      }

      try {
        const reply = await client.chat(trimmed);
        console.log(`\nClaude: ${reply}\n`);
      } catch (error) {
        console.error("Error:", error);
      }
      askQuestion();
    });
  };

  askQuestion();
}

main().catch(console.error);
```

---

## The Tool-Use Flow

The core of the client is the tool-use cycle. Here is how it works:

```
  User            Client             Claude API          MCP Server
    |                |                    |                   |
    | "Add           |                    |                   |
    |  note X"       |                    |                   |
    | ────────────>  |                    |                   |
    |                | ── messages ─────> |                   |
    |                |    + tools list    |                   |
    |                |                    |                   |
    |                | <── tool_use ────  |                   |
    |                |    "add-note"      |                   |
    |                |                    |                   |
    |                | ── callTool ────────────────────────>  |
    |                |    "add-note"      |                   |
    |                | <── result ─────────────────────────   |
    |                |                    |                   |
    |                | ── tool_result ──> |                   |
    |                |                    |                   |
    |                | <── text ────────  |                   |
    |                |    "Note saved"    |                   |
    | <────────────  |                    |                   |
    | "Note saved"   |                    |                   |
```

### Key steps:

1. The client sends the user query to Claude **along with the list of tools** (names, descriptions, schemas)
2. Claude analyzes the query and decides whether to use a tool (responds with `stop_reason: "tool_use"`)
3. The client invokes the tool on the MCP server with `client.callTool()`
4. The result goes back to Claude as a `tool_result`
5. Claude may request additional tools or generate the final response (`stop_reason: "end_turn"`)

---

## Connecting to Multiple Servers

A client can connect to multiple servers simultaneously:

```typescript
class MultiServerClient {
  private clients: Map<string, Client> = new Map();
  private allTools: AnthropicTool[] = [];

  async addServer(name: string, command: string, args: string[]): Promise<void> {
    const client = new Client({ name: `client-${name}`, version: "1.0.0" });
    const transport = new StdioClientTransport({ command, args });
    await client.connect(transport);

    const result = await client.listTools();
    for (const tool of result.tools) {
      this.allTools.push({
        name: `${name}__${tool.name}`,  // Prefix to avoid collisions
        description: `[${name}] ${tool.description}`,
        input_schema: tool.inputSchema as Record<string, unknown>,
      });
    }

    this.clients.set(name, client);
  }

  async callTool(prefixedName: string, args: Record<string, unknown>): Promise<unknown> {
    const [serverName, toolName] = prefixedName.split("__");
    const client = this.clients.get(serverName);
    if (!client) throw new Error(`Server ${serverName} not connected`);
    return client.callTool({ name: toolName, arguments: args });
  }
}
```

---

## Client with InMemoryTransport (for Testing)

For tests you do not need to launch processes. The SDK provides `InMemoryTransport`:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

async function testInMemory() {
  // Create server
  const server = new McpServer({ name: "test-server", version: "1.0.0" });
  server.tool("ping", "Test ping", {}, async () => ({
    content: [{ type: "text", text: "pong" }],
  }));

  // Create a linked pair of transports
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  // IMPORTANT: the server connects BEFORE the client
  await server.connect(serverTransport);

  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(clientTransport);

  // Invoke tool
  const result = await client.callTool({ name: "ping", arguments: {} });
  console.log(result); // { content: [{ type: "text", text: "pong" }] }

  // Cleanup
  await client.close();
  await server.close();
}
```

**Critical order**: `server.connect()` must be called BEFORE `client.connect()`. The client sends `initialize` immediately on `connect()`, and the server must already be listening.

---

## Summary

In this chapter you learned:

1. How to create an MCP client that connects to a server via STDIO
2. The tool-use cycle: query -> Claude -> tool_use -> callTool -> tool_result -> response
3. How to handle multiple tools in sequence
4. How to connect to multiple servers with prefixes to avoid name collisions
5. InMemoryTransport for testing without processes

**Next**: [Resources and Prompts](./04-resources-prompts.md)
