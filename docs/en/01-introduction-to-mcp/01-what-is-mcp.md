# What is the Model Context Protocol (MCP)

## Introduction

The **Model Context Protocol (MCP)** is an open standard developed by Anthropic that defines how AI applications (such as Claude Desktop, Cursor, VS Code with Copilot) communicate with external tools. MCP solves a fundamental problem: giving language models the ability to **act** in the real world, not just generate text.

Before MCP, every integration between an AI and an external tool required a custom implementation. MCP standardizes this communication, creating an ecosystem where any tool can be made accessible to any compatible AI.

---

## The Problem MCP Solves

Large Language Models (LLMs) are powerful at reasoning and text generation, but they have fundamental limitations:

- **They cannot access real-time data** (training has a cutoff date)
- **They cannot perform actions** (create files, call APIs, interact with databases)
- **They lack local context** (they don't know your project, your tasks, your environment)

MCP bridges this gap by providing a **bidirectional communication protocol** between the AI and the external world.

```
+-------------------+         MCP Protocol          +-------------------+
|                   |  <=========================>  |                   |
|   AI Application  |    Tool calls + Results       |     MCP Server    |
|  (Claude Desktop) |    Resources + Prompts        |   (your tool)     |
|                   |                               |                   |
+-------------------+                               +-------------------+
      Host/Client                                        Server
```

---

## Fundamental Concepts

### 1. Host

The **Host** is the AI application that the user directly interacts with. Examples:

- Claude Desktop
- Cursor IDE
- VS Code with MCP extensions
- Custom applications using the MCP SDK

The Host manages the user session, connects MCP servers, and orchestrates tool calls.

### 2. Client

The **Client** is the software component within the Host that implements the client side of the MCP protocol. It maintains a 1:1 connection with an MCP server and handles:

- Capability negotiation
- Message routing
- Connection lifecycle management

### 3. Server

The **Server** is the component that exposes functionality to the AI. An MCP server can offer three types of primitives:

| Primitive | Description | Example |
|-----------|-------------|---------|
| **Tools** | Functions that the AI can call | `create-sprint`, `analyze-diff` |
| **Resources** | Data that the AI can read | Files, databases, API responses |
| **Prompts** | Predefined templates | "Analyze this code for bugs" |

### 4. Transport

The **Transport** is the communication mechanism between Client and Server:

- **STDIO** (Standard Input/Output) - The most common. Client and Server communicate via the process's stdin/stdout. Ideal for local processes.
- **HTTP + SSE** (Server-Sent Events) - For remote servers. The client sends HTTP requests, the server responds via SSE for streaming.

---

## How a Tool Call Works

```
User: "Create a sprint called Sprint-15"
    |
    v
[1] Claude reasons and decides to call the "create-sprint" tool
    |
    v
[2] The MCP Client serializes the request in JSON-RPC
    { "method": "tools/call",
      "params": { "name": "create-sprint",
                  "arguments": { "name": "Sprint-15", ... } } }
    |
    v
[3] The MCP Server receives, executes the logic, returns the result
    { "content": [{ "type": "text", "text": "Sprint created with id 42" }] }
    |
    v
[4] Claude receives the result and presents it to the user
    "I created sprint Sprint-15 (ID: 42)"
```

### Detailed Flow

1. **Discovery**: At startup, the Client asks the Server for the list of available tools (`tools/list`)
2. **Schema**: Each tool declares its parameters with a JSON/Zod schema
3. **Invocation**: The AI autonomously decides when and which tool to call
4. **Execution**: The Server executes the logic and returns the result
5. **Composition**: The AI can combine multiple tool calls to complete complex tasks

---

## MCP vs REST API vs Plugin

| Feature | REST API | AI Plugin | MCP |
|---------|----------|-----------|-----|
| Standardized | Yes (HTTP) | No (vendor-specific) | Yes (open protocol) |
| Automatic discovery | No | Partial | Yes |
| Parameter typing | OpenAPI | Varies | Zod/JSON Schema |
| Bidirectional | No | No | Yes |
| Streaming support | Not native | Varies | Yes (SSE) |
| Vendor lock-in | No | Yes | No |
| Composability | Manual | Limited | Native |

---

## Why MCP Matters

1. **Interoperability**: An MCP server works with Claude Desktop, Cursor, and any other compatible client without modifications.

2. **Composability**: The AI can combine tools from different servers in a single workflow. E.g.: "Analyze the code (code-review), generate the tests (test-generator), and log the time (time-tracking)".

3. **Security**: The protocol clearly defines what a server can do. The user always maintains control over action approval.

4. **Open ecosystem**: Anyone can create an MCP server. No vendor permission is required.

5. **Persistent context**: Unlike stateless APIs, MCP supports stateful sessions, allowing the server to maintain context between calls.

---

## MCP Suite in Context

MCP Suite implements 22 MCP servers that, together, cover the entire software development lifecycle:

```
  Planning          Development        Testing           Deploy
  +-----------+     +-----------+     +-----------+     +-----------+
  | scrum-    |     | code-     |     | test-     |     | docker-   |
  | board     |---->| review    |---->| generator |---->| compose   |
  | agile-    |     | snippet-  |     | perf-     |     | cicd-     |
  | metrics   |     | manager   |     | profiler  |     | monitor   |
  +-----------+     +-----------+     +-----------+     +-----------+
       |                  |                 |                 |
       v                  v                 v                 v
  +-----------+     +-----------+     +-----------+     +-----------+
  | time-     |     | codebase- |     | db-schema |     | log-      |
  | tracking  |     | knowledge |     | explorer  |     | analyzer  |
  | project-  |     | api-docs  |     | data-mock |     | env-      |
  | economics |     | regex     |     | generator |     | manager   |
  +-----------+     +-----------+     +-----------+     +-----------+
```

Each server is designed to be:

- **Independent**: Works on its own without the other parts of the suite
- **Collaborative**: When connected to other servers, it exchanges events to automate workflows
- **Extensible**: Easy to add new tools or new servers following the established pattern
