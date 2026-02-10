# @mcp-suite/client-manager

## Introduction

The `@mcp-suite/client-manager` package manages a **pool of MCP clients** for synchronous server-to-server communication. It allows a server to call tools exposed by other servers as if they were local functions, fully abstracting transport details (STDIO, HTTP, InMemory).

```
packages/client-manager/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts       # Re-export of McpClientManager and ServerRegistryEntry
    └── manager.ts     # Client pool implementation
```

**Dependencies:**
- `@modelcontextprotocol/sdk` - Official MCP client and transports
- `@mcp-suite/core` - Logger for diagnostic messages

---

## Key Concepts

### The Problem

In an environment with 22 independent MCP servers, some tools need data that resides in other servers. Without the Client Manager, the only options would be to duplicate logic or use manual HTTP calls.

### The Solution

The Client Manager offers:

1. **Registry**: registers target servers with their connection information
2. **Lazy connection**: clients are created only on first use
3. **Pool**: connections are reused across subsequent calls
4. **Multi-transport**: supports STDIO, HTTP (Streamable HTTP), and InMemory

```
┌─────────────────────────────────────────────────┐
│                McpClientManager                 │
│                                                 │
│    Registry       Client Pool      Transports   │
│  ┌───────────┐   ┌───────────┐    ┌───────────┐ │
│  │ scrum-    │   │ Client A  │    │ HTTP      │ │
│  │ board     │──►│           │───►│ Transport │ │
│  ├───────────┤   ├───────────┤    ├───────────┤ │
│  │ time-     │   │ Client B  │    │ STDIO     │ │
│  │ tracking  │──►│           │───►│ Transport │ │
│  ├───────────┤   ├───────────┤    ├───────────┤ │
│  │ db-schema │   │ Client C  │    │ InMemory  │ │
│  │ explorer  │──►│           │───►│ Transport │ │
│  └───────────┘   └───────────┘    └───────────┘ │
└─────────────────────────────────────────────────┘
```

---

## API

### ServerRegistryEntry

The interface for registering a target server in the pool:

```typescript
export interface ServerRegistryEntry {
  name: string;                              // Unique target server name
  transport: 'stdio' | 'http' | 'in-memory'; // Transport type
  command?: string;    // Command for STDIO (e.g. 'node')
  args?: string[];     // Arguments for STDIO (e.g. ['dist/index.js'])
  url?: string;        // URL for HTTP (e.g. 'http://localhost:3018/mcp')
  env?: Record<string, string>;  // Environment variables for STDIO
}
```

| Field | Required for | Description |
|-------|-------------|-------------|
| `name` | All | Unique identifier used in `callTool()` |
| `transport` | All | Connection type |
| `command` | STDIO | Executable to launch |
| `args` | STDIO | Command arguments |
| `url` | HTTP | Server endpoint (path `/mcp` included) |
| `env` | STDIO | Subprocess environment variables |

### McpClientManager

The main class of the package:

```typescript
class McpClientManager {
  // --- Registration ---
  register(entry: ServerRegistryEntry): void;
  registerMany(entries: ServerRegistryEntry[]): void;

  // --- Connection ---
  getClient(serverName: string): Promise<Client>;
  static createInMemoryPair(): [Transport, Transport];
  connectInMemoryWithTransport(serverName: string, clientTransport: Transport): Promise<void>;

  // --- RPC Calls ---
  callTool(serverName: string, toolName: string, args?: Record<string, unknown>): Promise<unknown>;
  readResource(serverName: string, uri: string): Promise<unknown>;

  // --- Lifecycle Management ---
  disconnect(serverName: string): Promise<void>;
  disconnectAll(): Promise<void>;

  // --- Query ---
  getRegisteredServers(): string[];
  isConnected(serverName: string): boolean;
}
```

---

## Supported Transports

### 1. HTTP (Streamable HTTP)

For communication between servers in separate processes or machines. Uses the official SDK's MCP Streamable HTTP protocol.

```typescript
const clientManager = new McpClientManager();

clientManager.register({
  name: 'scrum-board',
  transport: 'http',
  url: 'http://localhost:3018/mcp',
});

// The client is automatically created on the first call
const result = await clientManager.callTool('scrum-board', 'get-sprint', { sprintId: 1 });
```

### 2. STDIO

For servers launched as subprocesses. The Client Manager spawns the process and communicates via stdin/stdout.

```typescript
clientManager.register({
  name: 'scrum-board',
  transport: 'stdio',
  command: 'node',
  args: ['servers/scrum-board/dist/index.js'],
  env: { MCP_SUITE_TRANSPORT: 'stdio' },
});
```

### 3. InMemory

For tests and in-process scenarios where caller and target live in the same Node.js process. Uses the SDK's `InMemoryTransport.createLinkedPair()`.

```typescript
// 1. Create the linked pair
const [clientTransport, serverTransport] = McpClientManager.createInMemoryPair();

// 2. Connect the target server to its side (FIRST)
await targetServer.connect(serverTransport);

// 3. Connect the client manager to the client side (AFTER)
await clientManager.connectInMemoryWithTransport('target-server', clientTransport);

// 4. Call tools as usual
const result = await clientManager.callTool('target-server', 'my-tool', { arg: 'value' });
```

**Connection order**: the server MUST connect to `serverTransport` BEFORE the client connects to `clientTransport`. The client immediately sends the `initialize` message upon connection, and the server must be listening.

---

## Lazy Connection and Pool

The Client Manager creates clients in a **lazy** manner: the connection is established only on the first `getClient()` or `callTool()` call:

```
First call to callTool('scrum-board', ...)
  │
  ├── getClient('scrum-board')
  │     │
  │     ├── clients.has('scrum-board')? → No
  │     │
  │     ├── registry.get('scrum-board') → { transport: 'http', url: '...' }
  │     │
  │     ├── connectHttp(entry)
  │     │     ├── new StreamableHTTPClientTransport(url)
  │     │     ├── new Client(...)
  │     │     ├── await client.connect(transport)
  │     │     └── clients.set('scrum-board', client)  ← cached
  │     │
  │     └── return client
  │
  └── client.callTool({ name: toolName, arguments: args })

Second call to callTool('scrum-board', ...)
  │
  ├── getClient('scrum-board')
  │     │
  │     └── clients.has('scrum-board')? → Yes → return cached client  ← reuse
  │
  └── client.callTool(...)
```

---

## Complete Example: Usage in a Server

```typescript
// servers/agile-metrics/src/index.ts
import { LocalEventBus } from '@mcp-suite/event-bus';
import { McpClientManager } from '@mcp-suite/client-manager';
import { startServer } from '@mcp-suite/core';
import { createAgileMetricsServer } from './server.js';

const eventBus = new LocalEventBus();

const clientManager = new McpClientManager();
clientManager.registerMany([
  {
    name: 'scrum-board',
    transport: 'http',
    url: process.env.MCP_SUITE_SCRUM_BOARD_URL || 'http://localhost:3018/mcp',
  },
  {
    name: 'time-tracking',
    transport: 'http',
    url: process.env.MCP_SUITE_TIME_TRACKING_URL || 'http://localhost:3022/mcp',
  },
]);

const suite = createAgileMetricsServer({ eventBus, clientManager });
await startServer(suite);
```

---

## Error Handling

If a target server is unreachable, `callTool()` throws an error. Calling tools handle this with the graceful degradation pattern:

```typescript
if (enrichFromExternal && clientManager) {
  try {
    const result = await clientManager.callTool('target', 'tool', args);
    // use the result
  } catch (error) {
    // The tool still works, without enrichment
    logger.warn('Cross-server call failed, continuing without enrichment');
  }
}
```

This ensures that an unavailable target server does not prevent the calling server from functioning.
