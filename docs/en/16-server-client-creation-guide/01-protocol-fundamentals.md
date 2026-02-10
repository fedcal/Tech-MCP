# Model Context Protocol Fundamentals

## Introduction

This guide walks you through creating an MCP server and client from scratch, progressing to a professional level with persistence, event bus, cross-server communication, and advanced testing.

The **Model Context Protocol (MCP)** is an open standard that defines how AI applications communicate with external systems. It works like a "USB-C for AI applications": a universal protocol that connects any language model to any data source or tool.

---

## The Problem MCP Solves

Without MCP, every integration between an AI application and an external system requires an ad-hoc implementation. With N AI applications and M external services, you would need N x M different integrations.

MCP reduces this complexity to N + M: each application implements an MCP client, each service implements an MCP server, and they all communicate through the same protocol.

```
  WITHOUT MCP                        WITH MCP

  App1 ──── Service1                App1 ─┐
  App1 ──── Service2                App2 ─┤── MCP Protocol ──┤── Server1
  App2 ──── Service1                App3 ─┘                  ├── Server2
  App2 ──── Service2                                         └── Server3
  App3 ──── Service1
  App3 ──── Service2                N + M connections
                                    (instead of N x M)
  N x M connections
```

---

## Protocol Architecture

MCP follows a client-server architecture with three participants:

```
+------------------+       +------------------+       +------------------+
|                  |       |                  |       |                  |
|    MCP Host      |       |    MCP Client    |       |    MCP Server    |
|                  | creates|                 | JSON  |                  |
|  (Claude Desktop,| ───>  |  (one client per | ───>  |  (your code that |
|   VS Code, IDE)  |       |   each server)   | RPC   |   exposes        |
|                  |       |                  | 2.0   |   tools/resources)|
+------------------+       +------------------+       +------------------+
```

### Host

The AI application that the user interacts with. Examples: Claude Desktop, Claude Code, an IDE with an AI extension. The Host coordinates one or more MCP Clients.

### Client

A component created by the Host to communicate with a single Server. It maintains a dedicated 1:1 connection. It handles capability negotiation and session lifecycle management.

### Server

The program that **you** write. It exposes functionality through three main primitives:

| Primitive | Control | Description | Example |
|-----------|---------|-------------|---------|
| **Tools** | Model | Functions that the AI model can invoke | `calculate-velocity`, `log-time` |
| **Resources** | Application | Contextual data accessible by the client | Files, DB records, API responses |
| **Prompts** | User | Templates for structuring interactions | Slash commands, predefined workflows |

---

## The JSON-RPC 2.0 Protocol

MCP uses JSON-RPC 2.0 as its message exchange format. Each message is a UTF-8 encoded JSON object.

### Request (a request expecting a response)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get-weather",
    "arguments": { "city": "Roma" }
  }
}
```

The `id` field identifies the request. The server responds with the same `id`.

### Response (a reply to a request)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      { "type": "text", "text": "Temperature in Roma: 22C, sunny" }
    ]
  }
}
```

### Notification (a message with no response)

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

Notifications **do not have** an `id` field and do not expect a response.

### Error (an error response)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Tool not found: invalid-tool"
  }
}
```

---

## Connection Lifecycle

Every MCP connection goes through three phases:

```
  Client                                Server
    |                                     |
    |  ── initialize (request) ────────>  |    PHASE 1: Initialization
    |  <── initialize (response) ───────  |    (capability negotiation)
    |  ── initialized (notification) ──>  |
    |                                     |
    |  ── tools/list ──────────────────>  |    PHASE 2: Operation
    |  <── tools list result ───────────  |    (message exchange)
    |  ── tools/call ──────────────────>  |
    |  <── tool result ─────────────────  |
    |  ...                                |
    |                                     |
    |  ── disconnect ──────────────────>  |    PHASE 3: Termination
    |                                     |
```

### Phase 1: Initialize

The client sends an `initialize` request declaring the protocol version and its capabilities:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "sampling": {}
    },
    "clientInfo": {
      "name": "my-client",
      "version": "1.0.0"
    }
  }
}
```

The server responds with its own capabilities:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "tools": { "listChanged": true },
      "resources": {},
      "prompts": {}
    },
    "serverInfo": {
      "name": "my-server",
      "version": "1.0.0"
    }
  }
}
```

The client confirms with a `notifications/initialized` notification and the session is ready.

### Phase 2: Operation

Client and server exchange messages according to the negotiated capabilities. The client can list and invoke tools, read resources, and retrieve prompts.

### Phase 3: Termination

The client closes the transport. For STDIO, it terminates the process. For HTTP, it sends a DELETE with the session ID.

---

## Transport: How Messages Travel

The transport is the layer that manages the communication channel. MCP supports two mechanisms:

### STDIO (Standard Input/Output)

The client launches the server as a child process. JSON-RPC messages travel over stdin (client->server) and stdout (server->client). Each message is delimited by a newline.

```
  Client Process                    Server Process (child)
       |                                  |
       |  ── stdin ──────────────────>    |
       |  <── stdout ─────────────────    |
       |       stderr (log) ──────>       | (visible only to the client)
       |                                  |
```

**Fundamental rule**: the server MUST never write anything to stdout that is not a valid JSON-RPC message. For logging, use stderr.

### Streamable HTTP

The server is an independent HTTP process. The client sends messages via POST and receives responses as JSON or as an SSE (Server-Sent Events) stream.

```
  Client                              HTTP Server
    |                                    |
    |  ── POST /mcp (JSON-RPC) ──────>   |
    |  <── 200 OK (JSON or SSE) ──────   |
    |                                    |
    |  ── GET /mcp ──────────────────>   |   (optional: SSE stream)
    |  <── SSE stream ───────────────    |
    |                                    |
```

The server can manage sessions through the `Mcp-Session-Id` header.

---

## Next Step

Now that you know the protocol fundamentals, in the next chapter you will create your first working MCP server.

**Next**: [Creating Your First MCP Server](./02-first-server.md)
