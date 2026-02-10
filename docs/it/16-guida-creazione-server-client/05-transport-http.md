# Transport HTTP e Deployment

## Introduzione

Finora hai usato il transport STDIO, dove il client lancia il server come processo figlio. In questo capitolo passerai al transport **Streamable HTTP**, che permette di eseguire il server come servizio indipendente accessibile via rete.

---

## STDIO vs HTTP: Quando Usare Cosa

| Aspetto | STDIO | Streamable HTTP |
|---------|-------|-----------------|
| **Architettura** | Client lancia il server | Server indipendente |
| **Connessioni** | 1:1 (un client per processo) | N:1 (molti client, un server) |
| **Deployment** | Locale, stesso host | Locale o remoto |
| **Sessioni** | Implicita (vita del processo) | Esplicita (session ID) |
| **Autenticazione** | Non necessaria (stesso host) | Necessaria |
| **Caso d'uso** | Claude Desktop, IDE | Microservizi, API condivise |

---

## Server HTTP con Express

L'SDK MCP fornisce un'integrazione diretta con Express tramite `StreamableHTTPServerTransport`.

### Setup

Aggiungi le dipendenze:

```bash
npm install express
npm install -D @types/express
```

### Implementazione

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";

// Crea il server MCP
const server = new McpServer({
  name: "notes-http-server",
  version: "1.0.0",
});

// Registra i tool (stessa API di STDIO)
const notes: Map<string, string> = new Map();

server.tool(
  "add-note",
  "Aggiunge una nuova nota",
  {
    title: z.string(),
    content: z.string(),
  },
  async ({ title, content }) => {
    notes.set(title, content);
    return {
      content: [{ type: "text", text: `Nota "${title}" salvata.` }],
    };
  },
);

// --- Transport HTTP ---

const app = express();
app.use(express.json());

// Crea transport con sessioni
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
});

// Connetti il server MCP al transport
await server.connect(transport);

// Endpoint MCP: POST (messaggi client -> server)
app.post("/mcp", async (req, res) => {
  await transport.handleRequest(req, res, req.body);
});

// Endpoint MCP: GET (SSE stream server -> client)
app.get("/mcp", async (req, res) => {
  await transport.handleRequest(req, res);
});

// Endpoint MCP: DELETE (terminazione sessione)
app.delete("/mcp", async (req, res) => {
  await transport.handleRequest(req, res);
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "notes-http-server" });
});

// Avvia il server HTTP
const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server MCP HTTP in ascolto su http://localhost:${PORT}/mcp`);
});
```

### Punti Chiave

**Session ID Generator**: ogni connessione client riceve un ID sessione univoco. Il client lo include nell'header `Mcp-Session-Id` per tutte le richieste successive.

```typescript
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
});
```

**Tre endpoint su /mcp**:
- `POST /mcp` — il client invia messaggi JSON-RPC (request, notification, response)
- `GET /mcp` — il client apre un SSE stream per ricevere notifiche push dal server
- `DELETE /mcp` — il client termina la sessione esplicitamente

**`server.connect()` una sola volta**: a differenza di STDIO dove ogni connessione crea un nuovo server, in HTTP il server si connette al transport una volta e gestisce tutte le sessioni.

---

## Client HTTP

Per connettersi a un server HTTP, usa `StreamableHTTPClientTransport`:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({
  name: "http-client",
  version: "1.0.0",
});

const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:3000/mcp"),
);

await client.connect(transport);

// Da qui in poi, stessa API di STDIO
const tools = await client.listTools();
console.log("Tool disponibili:", tools.tools.map((t) => t.name));

const result = await client.callTool({
  name: "add-note",
  arguments: { title: "Test", content: "Contenuto di prova" },
});
console.log("Risultato:", result);

await client.close();
```

### Gestione della Sessione

Il `StreamableHTTPClientTransport` gestisce automaticamente:
- Invio dell'header `Mcp-Session-Id` dopo l'inizializzazione
- Invio dell'header `MCP-Protocol-Version` in tutte le richieste
- Riconnessione in caso di sessione scaduta (HTTP 404)

---

## Pattern Stateful: Un Server per Molti Client

In produzione, il server HTTP gestisce sessioni multiple:

```typescript
import { randomUUID } from "node:crypto";

// Mappa sessioni -> stato
const sessions = new Map<string, { notes: Map<string, string> }>();

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => {
    const sessionId = randomUUID();
    sessions.set(sessionId, { notes: new Map() });
    return sessionId;
  },
});
```

Per accedere alla sessione corrente dall'handler di un tool, usa i metadata del transport o un pattern di dependency injection.

---

## Dual Transport: STDIO + HTTP

Un server professionale supporta entrambi i transport, decidendo in base alla configurazione:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { randomUUID } from "node:crypto";

// Crea e configura il server MCP (tool, resource, prompt)
function createServer(): McpServer {
  const server = new McpServer({ name: "my-server", version: "1.0.0" });
  // ... registra tool ...
  return server;
}

// Avvio condizionale
const mode = process.env.MCP_TRANSPORT ?? "stdio";

if (mode === "http") {
  const server = createServer();
  const app = express();
  app.use(express.json());

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });
  await server.connect(transport);

  app.post("/mcp", async (req, res) => await transport.handleRequest(req, res, req.body));
  app.get("/mcp", async (req, res) => await transport.handleRequest(req, res));
  app.delete("/mcp", async (req, res) => await transport.handleRequest(req, res));
  app.get("/health", (_, res) => res.json({ status: "ok" }));

  const port = process.env.PORT ?? 3000;
  app.listen(port, () => console.log(`HTTP server on port ${port}`));
} else {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Server avviato su STDIO");
}
```

Configurazione:
- `MCP_TRANSPORT=stdio` (default) — per Claude Desktop
- `MCP_TRANSPORT=http PORT=3000` — per deployment HTTP

---

## Sicurezza del Transport HTTP

### Validazione Origin

Per prevenire attacchi DNS rebinding, valida l'header `Origin`:

```typescript
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = ["http://localhost:3000", "https://myapp.example.com"];
  if (origin && !allowed.includes(origin)) {
    res.status(403).json({ error: "Origin non consentito" });
    return;
  }
  next();
});
```

### Binding Locale

Per server locali, binda solo su localhost:

```typescript
app.listen(port, "127.0.0.1", () => {
  console.log(`Server in ascolto solo su localhost:${port}`);
});
```

### Autenticazione

Per server remoti, implementa autenticazione con Bearer token:

```typescript
app.use("/mcp", (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token mancante" });
    return;
  }
  const token = auth.slice(7);
  if (!isValidToken(token)) {
    res.status(403).json({ error: "Token non valido" });
    return;
  }
  next();
});
```

---

## Riepilogo

In questo capitolo hai imparato:

1. Le differenze tra transport STDIO e Streamable HTTP
2. Come creare un server HTTP con Express e `StreamableHTTPServerTransport`
3. La gestione delle sessioni con `sessionIdGenerator`
4. Come creare un client HTTP con `StreamableHTTPClientTransport`
5. Il pattern dual-transport per supportare sia STDIO che HTTP
6. Misure di sicurezza: validazione Origin, binding locale, autenticazione

**Prossimo**: [Persistenza con SQLite](./06-persistenza-sqlite.md)
