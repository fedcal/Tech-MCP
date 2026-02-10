# HTTP Transport and Deployment

## Introduction

So far you have used the STDIO transport, where the client launches the server as a child process. In this chapter you will switch to the **Streamable HTTP** transport, which allows running the server as an independent service accessible over the network.

---

## STDIO vs HTTP: When to Use What

| Aspect | STDIO | Streamable HTTP |
|--------|-------|-----------------|
| **Architecture** | Client launches the server | Independent server |
| **Connections** | 1:1 (one client per process) | N:1 (many clients, one server) |
| **Deployment** | Local, same host | Local or remote |
| **Sessions** | Implicit (process lifetime) | Explicit (session ID) |
| **Authentication** | Not needed (same host) | Required |
| **Use case** | Claude Desktop, IDE | Microservices, shared APIs |

---

## HTTP Server with Express

The MCP SDK provides a direct integration with Express via `StreamableHTTPServerTransport`.

### Setup

Add the dependencies:

```bash
npm install express
npm install -D @types/express
```

### Implementation

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";

// Create the MCP server
const server = new McpServer({
  name: "notes-http-server",
  version: "1.0.0",
});

// Register tools (same API as STDIO)
const notes: Map<string, string> = new Map();

server.tool(
  "add-note",
  "Adds a new note",
  {
    title: z.string(),
    content: z.string(),
  },
  async ({ title, content }) => {
    notes.set(title, content);
    return {
      content: [{ type: "text", text: `Note "${title}" saved.` }],
    };
  },
);

// --- HTTP Transport ---

const app = express();
app.use(express.json());

// Create transport with sessions
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
});

// Connect the MCP server to the transport
await server.connect(transport);

// MCP endpoint: POST (client -> server messages)
app.post("/mcp", async (req, res) => {
  await transport.handleRequest(req, res, req.body);
});

// MCP endpoint: GET (SSE stream server -> client)
app.get("/mcp", async (req, res) => {
  await transport.handleRequest(req, res);
});

// MCP endpoint: DELETE (session termination)
app.delete("/mcp", async (req, res) => {
  await transport.handleRequest(req, res);
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "notes-http-server" });
});

// Start the HTTP server
const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`MCP HTTP Server listening on http://localhost:${PORT}/mcp`);
});
```

### Key Points

**Session ID Generator**: each client connection receives a unique session ID. The client includes it in the `Mcp-Session-Id` header for all subsequent requests.

```typescript
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
});
```

**Three endpoints on /mcp**:
- `POST /mcp` -- the client sends JSON-RPC messages (request, notification, response)
- `GET /mcp` -- the client opens an SSE stream to receive push notifications from the server
- `DELETE /mcp` -- the client terminates the session explicitly

**`server.connect()` only once**: unlike STDIO where each connection creates a new server, in HTTP the server connects to the transport once and handles all sessions.

---

## HTTP Client

To connect to an HTTP server, use `StreamableHTTPClientTransport`:

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

// From here on, same API as STDIO
const tools = await client.listTools();
console.log("Available tools:", tools.tools.map((t) => t.name));

const result = await client.callTool({
  name: "add-note",
  arguments: { title: "Test", content: "Test content" },
});
console.log("Result:", result);

await client.close();
```

### Session Management

The `StreamableHTTPClientTransport` automatically handles:
- Sending the `Mcp-Session-Id` header after initialization
- Sending the `MCP-Protocol-Version` header in all requests
- Reconnection in case of expired session (HTTP 404)

---

## Stateful Pattern: One Server for Many Clients

In production, the HTTP server manages multiple sessions:

```typescript
import { randomUUID } from "node:crypto";

// Map sessions -> state
const sessions = new Map<string, { notes: Map<string, string> }>();

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => {
    const sessionId = randomUUID();
    sessions.set(sessionId, { notes: new Map() });
    return sessionId;
  },
});
```

To access the current session from a tool handler, use the transport metadata or a dependency injection pattern.

---

## Dual Transport: STDIO + HTTP

A professional server supports both transports, choosing based on configuration:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { randomUUID } from "node:crypto";

// Create and configure the MCP server (tools, resources, prompts)
function createServer(): McpServer {
  const server = new McpServer({ name: "my-server", version: "1.0.0" });
  // ... register tools ...
  return server;
}

// Conditional startup
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
  console.error("Server started on STDIO");
}
```

Configuration:
- `MCP_TRANSPORT=stdio` (default) -- for Claude Desktop
- `MCP_TRANSPORT=http PORT=3000` -- for HTTP deployment

---

## HTTP Transport Security

### Origin Validation

To prevent DNS rebinding attacks, validate the `Origin` header:

```typescript
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = ["http://localhost:3000", "https://myapp.example.com"];
  if (origin && !allowed.includes(origin)) {
    res.status(403).json({ error: "Origin not allowed" });
    return;
  }
  next();
});
```

### Local Binding

For local servers, bind only to localhost:

```typescript
app.listen(port, "127.0.0.1", () => {
  console.log(`Server listening only on localhost:${port}`);
});
```

### Authentication

For remote servers, implement authentication with a Bearer token:

```typescript
app.use("/mcp", (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing token" });
    return;
  }
  const token = auth.slice(7);
  if (!isValidToken(token)) {
    res.status(403).json({ error: "Invalid token" });
    return;
  }
  next();
});
```

---

## Summary

In this chapter you learned:

1. The differences between STDIO and Streamable HTTP transports
2. How to create an HTTP server with Express and `StreamableHTTPServerTransport`
3. Session management with `sessionIdGenerator`
4. How to create an HTTP client with `StreamableHTTPClientTransport`
5. The dual-transport pattern to support both STDIO and HTTP
6. Security measures: Origin validation, local binding, authentication

**Next**: [Persistence with SQLite](./06-sqlite-persistence.md)
