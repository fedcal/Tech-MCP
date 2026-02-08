# Creare il Primo Client MCP

## Introduzione

Un client MCP si connette a uno o piu' server, scopre i tool disponibili e li invoca per conto di un modello di linguaggio. In questo capitolo costruirai un client CLI che usa Claude come modello per decidere quali tool invocare.

---

## Setup del Progetto

```bash
mkdir mcp-client && cd mcp-client
npm init -y
npm install @modelcontextprotocol/sdk @anthropic-ai/sdk dotenv
npm install -D typescript @types/node
```

Crea `tsconfig.json` (stesso del server) e aggiungi a `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

Crea `.env` con la tua API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Client Minimo

Crea `src/index.ts`:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import * as readline from "node:readline";

config(); // Carica .env

// Tipo per i tool compatibili con l'API Anthropic
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
   * Connessione al server MCP via STDIO.
   * Il client lancia il server come processo figlio.
   */
  async connect(serverCommand: string, serverArgs: string[]): Promise<void> {
    const transport = new StdioClientTransport({
      command: serverCommand,
      args: serverArgs,
    });

    // connect() esegue il lifecycle: initialize -> initialized
    await this.client.connect(transport);

    // Scopri i tool disponibili
    const result = await this.client.listTools();
    this.tools = result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Record<string, unknown>,
    }));

    console.error(
      `Connesso al server. Tool disponibili: ${this.tools.map((t) => t.name).join(", ")}`,
    );
  }

  /**
   * Elabora una query utente con il ciclo tool-use di Claude.
   */
  async chat(userMessage: string): Promise<string> {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: userMessage },
    ];

    // Prima chiamata a Claude con i tool disponibili
    let response = await this.anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages,
      tools: this.tools as Anthropic.Tool[],
    });

    // Ciclo tool-use: Claude puo' richiedere piu' tool in sequenza
    while (response.stop_reason === "tool_use") {
      const assistantContent = response.content;
      messages.push({ role: "assistant", content: assistantContent });

      // Esegui tutti i tool richiesti
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of assistantContent) {
        if (block.type === "tool_use") {
          console.error(`  -> Invocazione tool: ${block.name}(${JSON.stringify(block.input)})`);

          // Chiama il tool sul server MCP
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

      // Richiama Claude con i risultati dei tool
      response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages,
        tools: this.tools as Anthropic.Tool[],
      });
    }

    // Estrai il testo finale
    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }
}

// --- Main: CLI interattiva ---

async function main() {
  const serverScript = process.argv[2];
  if (!serverScript) {
    console.error("Uso: npm start -- /percorso/al/server/dist/index.js");
    process.exit(1);
  }

  const client = new McpChatClient();
  await client.connect("node", [serverScript]);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("Chat MCP avviata. Scrivi 'exit' per uscire.\n");

  const askQuestion = (): void => {
    rl.question("Tu: ", async (input) => {
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
        console.error("Errore:", error);
      }
      askQuestion();
    });
  };

  askQuestion();
}

main().catch(console.error);
```

---

## Il Flusso Tool-Use

Il cuore del client e' il ciclo tool-use. Ecco come funziona:

```
  Utente          Client             Claude API          Server MCP
    |                |                    |                   |
    | "Aggiungi      |                    |                   |
    |  nota X"       |                    |                   |
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
    |                |    "Nota salvata"  |                   |
    | <────────────  |                    |                   |
    | "Nota salvata" |                    |                   |
```

### Passaggi chiave:

1. Il client invia la query utente a Claude **insieme alla lista dei tool** (nomi, descrizioni, schemi)
2. Claude analizza la query e decide se usare un tool (risponde con `stop_reason: "tool_use"`)
3. Il client invoca il tool sul server MCP con `client.callTool()`
4. Il risultato torna a Claude come `tool_result`
5. Claude puo' richiedere altri tool o generare la risposta finale (`stop_reason: "end_turn"`)

---

## Connessione a Piu' Server

Un client puo' connettersi a server multipli contemporaneamente:

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
        name: `${name}__${tool.name}`,  // Prefisso per evitare collisioni
        description: `[${name}] ${tool.description}`,
        input_schema: tool.inputSchema as Record<string, unknown>,
      });
    }

    this.clients.set(name, client);
  }

  async callTool(prefixedName: string, args: Record<string, unknown>): Promise<unknown> {
    const [serverName, toolName] = prefixedName.split("__");
    const client = this.clients.get(serverName);
    if (!client) throw new Error(`Server ${serverName} non connesso`);
    return client.callTool({ name: toolName, arguments: args });
  }
}
```

---

## Client con InMemoryTransport (per Testing)

Per i test non serve lanciare processi. L'SDK fornisce `InMemoryTransport`:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

async function testInMemory() {
  // Crea server
  const server = new McpServer({ name: "test-server", version: "1.0.0" });
  server.tool("ping", "Test ping", {}, async () => ({
    content: [{ type: "text", text: "pong" }],
  }));

  // Crea coppia di transport collegati
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  // IMPORTANTE: il server si connette PRIMA del client
  await server.connect(serverTransport);

  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(clientTransport);

  // Invoca tool
  const result = await client.callTool({ name: "ping", arguments: {} });
  console.log(result); // { content: [{ type: "text", text: "pong" }] }

  // Cleanup
  await client.close();
  await server.close();
}
```

**Ordine critico**: `server.connect()` deve essere chiamato PRIMA di `client.connect()`. Il client invia `initialize` immediatamente al `connect()`, e il server deve gia' essere in ascolto.

---

## Riepilogo

In questo capitolo hai imparato:

1. Come creare un client MCP che si connette a un server via STDIO
2. Il ciclo tool-use: query -> Claude -> tool_use -> callTool -> tool_result -> risposta
3. Come gestire tool multipli in sequenza
4. Come connettersi a server multipli con prefissi per evitare collisioni di nomi
5. InMemoryTransport per testing senza processi

**Prossimo**: [Resources e Prompts](./04-resources-prompts.md)
