# @mcp-suite/testing and @mcp-suite/cli

## Part 1: @mcp-suite/testing

### Introduction

The `@mcp-suite/testing` package provides utilities for testing MCP Suite servers in isolation, without requiring a real client or a STDIO connection. It offers two main components: a **test harness** based on `InMemoryTransport` and a **MockEventBus** for verifying event emission.

```
packages/testing/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts              # Re-export of public modules
    ├── test-server.ts        # createTestHarness() and TestHarness
    └── mock-event-bus.ts     # MockEventBus for event testing
```

**Dependencies:**
- `@mcp-suite/core` - Shared types and utilities
- `@mcp-suite/event-bus` - EventBus interfaces for the mock
- `@modelcontextprotocol/sdk` - Client and InMemoryTransport

---

### TestHarness: In-Process Testing

The `TestHarness` creates a client-server pair connected in memory, allowing tool testing without external processes.

#### TestHarness Interface

```typescript
export interface TestHarness {
  client: Client;            // MCP client connected to the server
  close: () => Promise<void>;  // Function to close the connection
}
```

#### createTestHarness()

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export async function createTestHarness(server: McpServer): Promise<TestHarness> {
  // 1. Create a linked pair of in-memory transports
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  // 2. Create a test client
  const client = new Client({
    name: 'test-client',
    version: '1.0.0',
  });

  // 3. Connect server and client to their respective transports
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  // 4. Return the client and a cleanup function
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}
```

#### TestHarness Diagram

```
┌───────────────────────────────────────────────────────┐
│                    Test Process                        │
│                                                       │
│  ┌────────────┐    InMemoryTransport   ┌────────────┐ │
│  │  Client    │◄──────────────────────►│  Server    │ │
│  │  (test)    │    (bidirectional      │  (MCP)     │ │
│  │            │     in-memory          │            │ │
│  │  callTool  │     connection)        │  tools     │ │
│  │  listTools │                        │  resources │ │
│  └────────────┘                        └────────────┘ │
│                                                       │
│  No external processes                                │
│  No network ports                                     │
│  No STDIO files                                       │
└───────────────────────────────────────────────────────┘
```

#### Test Example with Vitest

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { MockEventBus } from '@mcp-suite/testing';
import { createScrumBoardServer } from '../src/server.js';

describe('Scrum Board Server', () => {
  let harness: TestHarness;
  let eventBus: MockEventBus;

  beforeAll(async () => {
    eventBus = new MockEventBus();
    const suite = createScrumBoardServer(eventBus);
    harness = await createTestHarness(suite.server);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('should create a sprint', async () => {
    const result = await harness.client.callTool({
      name: 'create-sprint',
      arguments: {
        name: 'Sprint 1',
        startDate: '2025-01-13',
        endDate: '2025-01-24',
        goals: ['Completare autenticazione'],
      },
    });

    expect(result.content).toBeDefined();
    expect(result.isError).toBeUndefined();
  });

  it('should emit sprint-started event', async () => {
    expect(eventBus.wasPublished('scrum:sprint-started')).toBe(true);

    const events = eventBus.getPublishedEvents('scrum:sprint-started');
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({
      name: 'Sprint 1',
      startDate: '2025-01-13',
    });
  });

  it('should list tools', async () => {
    const tools = await harness.client.listTools();
    expect(tools.tools.length).toBeGreaterThan(0);

    const toolNames = tools.tools.map(t => t.name);
    expect(toolNames).toContain('create-sprint');
    expect(toolNames).toContain('sprint-board');
    expect(toolNames).toContain('get-backlog');
  });
});
```

---

### MockEventBus: Event Verification

The `MockEventBus` implements the `EventBus` interface by recording all published events to allow assertions in tests.

#### Implementation

```typescript
interface PublishedEvent {
  event: string;
  payload: unknown;
  timestamp: Date;
}

export class MockEventBus implements EventBus {
  public published: PublishedEvent[] = [];   // All published events
  private handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  private patternHandlers: Array<{ pattern: string; handler: PatternHandler }> = [];

  async publish<E extends EventName>(event: E, payload: EventPayload<E>): Promise<void> {
    // Record the event for assertions
    this.published.push({ event, payload, timestamp: new Date() });

    // Still execute registered handlers (for testing subscribers)
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        await handler(payload);
      }
    }
  }

  subscribe<E extends EventName>(event: E, handler: EventHandler<E>): () => void {
    const handlers = this.handlers.get(event) || [];
    handlers.push(handler as (...args: unknown[]) => void);
    this.handlers.set(event, handlers);
    return () => { /* unsubscribe logic */ };
  }

  subscribePattern(pattern: string, handler: PatternHandler): () => void {
    this.patternHandlers.push({ pattern, handler });
    return () => { /* unsubscribe logic */ };
  }

  clear(): void {
    this.published = [];
    this.handlers.clear();
    this.patternHandlers = [];
  }

  // ── Utility methods for tests ──

  getPublishedEvents(eventName?: string): PublishedEvent[] {
    if (eventName) {
      return this.published.filter((e) => e.event === eventName);
    }
    return this.published;
  }

  wasPublished(eventName: string): boolean {
    return this.published.some((e) => e.event === eventName);
  }
}
```

#### Utility Methods for Assertions

| Method | Description | Example |
|--------|-------------|---------|
| `wasPublished(name)` | Checks if an event was published | `expect(bus.wasPublished('scrum:sprint-started')).toBe(true)` |
| `getPublishedEvents(name?)` | Gets published events (optionally filtered) | `bus.getPublishedEvents('time:entry-logged')` |
| `published` | Direct array of all events | `expect(bus.published).toHaveLength(3)` |
| `clear()` | Resets everything for a new test | `bus.clear()` |

#### Example: Verifying Event Payload

```typescript
it('should emit correct payload on task update', async () => {
  await harness.client.callTool({
    name: 'update-task-status',
    arguments: { taskId: 1, status: 'in_progress' },
  });

  const events = eventBus.getPublishedEvents('scrum:task-updated');
  expect(events).toHaveLength(1);

  const payload = events[0].payload as {
    taskId: string;
    previousStatus: string;
    newStatus: string;
  };

  expect(payload.taskId).toBe('1');
  expect(payload.newStatus).toBe('in_progress');
});
```

---

## Part 2: @mcp-suite/cli

### Introduction

The `@mcp-suite/cli` package provides a command-line interface for managing MCP Suite servers: listing them, starting them, and checking their status.

```
packages/cli/
├── package.json
├── tsconfig.json
└── src/
    └── index.ts         # Entry point with Commander.js
```

**Dependencies:**
- `@mcp-suite/core` - Types and configuration
- `@mcp-suite/event-bus` - EventBus for servers
- `@mcp-suite/client-manager` - Client pool for server-to-server communication
- `commander` - CLI framework

### Running the CLI

```bash
# Via npx (without global installation)
npx @mcp-suite/cli <command>

# After build, directly
node packages/cli/dist/index.js <command>
```

---

### Available Commands

#### `list` - List Servers

```bash
npx @mcp-suite/cli list
```

Scans the `servers/` directory and shows all available servers:

```
Available MCP Suite servers:

  - agile-metrics
  - api-documentation
  - cicd-monitor
  - code-review
  - codebase-knowledge
  - data-mock-generator
  - db-schema-explorer
  - dependency-manager
  - docker-compose
  - environment-manager
  - http-client
  - log-analyzer
  - performance-profiler
  - project-economics
  - project-scaffolding
  - regex-builder
  - retrospective-manager
  - scrum-board
  - snippet-manager
  - standup-notes
  - test-generator
  - time-tracking

Total: 22 servers
```

#### `start <server>` - Start a Server

```bash
npx @mcp-suite/cli start scrum-board
npx @mcp-suite/cli start scrum-board --transport http
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-t, --transport <type>` | Transport type (`stdio` or `http`) | `stdio` |

The command:
1. Verifies the server is built (exists `dist/index.js`)
2. Starts the Node.js process with the specified transport
3. Forwards stdin/stdout/stderr to the child process

```typescript
const child = spawn('node', [entryPoint], {
  stdio: 'inherit',
  env: {
    ...process.env,
    MCP_SUITE_TRANSPORT: opts.transport,
  },
});
```

#### `status` - Check Status

```bash
npx @mcp-suite/cli status
```

Shows which servers are built and which are not:

```
MCP Suite Status:

  Total servers: 22
  Built: 20
  Not built: 2

  Built servers:
    + agile-metrics
    + api-documentation
    + cicd-monitor
    ...

  Not built:
    x docker-compose
    x performance-profiler
```

---

### How It Works Internally

The CLI uses `commander` to define commands and relies on filesystem scanning:

```typescript
function getAvailableServers(): string[] {
  if (!existsSync(SERVERS_DIR)) return [];
  return readdirSync(SERVERS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())       // Directories only
    .map((d) => d.name)                    // Extract names
    .sort();                               // Sort alphabetically
}
```

The project root directory is calculated relative to the CLI's location:

```typescript
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');   // Goes up from packages/cli/dist/
const SERVERS_DIR = join(ROOT, 'servers');
```

---

### Using the CLI for Development

#### Typical development workflow

```bash
# 1. Check status after a change
npx @mcp-suite/cli status

# 2. If needed, rebuild
pnpm build

# 3. Start the server under development
npx @mcp-suite/cli start scrum-board

# 4. In another terminal, test with MCP Inspector
npx @modelcontextprotocol/inspector node servers/scrum-board/dist/index.js
```

#### Development with watch mode

For continuous development, use TypeScript's watch mode:

```bash
# In one terminal: automatic compilation
pnpm dev

# In another terminal: start the server
npx @mcp-suite/cli start scrum-board
```

The `pnpm dev` command runs `turbo run dev --parallel` which executes `tsc -b --watch` on all packages simultaneously.

---

## Part 3: @mcp-suite/client-manager

### Introduction

The `@mcp-suite/client-manager` package manages a pool of MCP clients for server-to-server communication. It allows a server to programmatically call tools on other servers.

### McpClientManager

```typescript
export class McpClientManager {
  // Register a server in the registry
  register(entry: ServerRegistryEntry): void;
  registerMany(entries: ServerRegistryEntry[]): void;

  // Get or create a connection to a server
  async getClient(serverName: string): Promise<Client>;

  // Call a tool on another server
  async callTool(serverName: string, toolName: string, args?: Record<string, unknown>): Promise<unknown>;

  // Read a resource from another server
  async readResource(serverName: string, uri: string): Promise<unknown>;

  // Connection management
  async disconnect(serverName: string): Promise<void>;
  async disconnectAll(): Promise<void>;
  getRegisteredServers(): string[];
  isConnected(serverName: string): boolean;
}
```

### ServerRegistryEntry

```typescript
export interface ServerRegistryEntry {
  name: string;                    // Server name
  transport: 'stdio' | 'http';    // Transport type
  command?: string;                // Command for STDIO (e.g. 'node')
  args?: string[];                 // Command arguments
  url?: string;                    // URL for HTTP (future)
  env?: Record<string, string>;    // Environment variables
}
```

### Server-to-Server Communication Example

```typescript
import { McpClientManager } from '@mcp-suite/client-manager';

const manager = new McpClientManager();

// Register the servers to communicate with
manager.register({
  name: 'scrum-board',
  transport: 'stdio',
  command: 'node',
  args: ['servers/scrum-board/dist/index.js'],
});

// Call a tool on another server
const result = await manager.callTool('scrum-board', 'get-backlog', {});

// Disconnect when done
await manager.disconnectAll();
```

### Communication Diagram

```
┌─────────────────────┐           ┌────────────────────┐
│  Server A           │           │  Server B          │
│  (agile-metrics)    │           │  (scrum-board)     │
│                     │           │                    │
│  McpClientManager   │  STDIO    │                    │
│  ─► callTool(       │ ────────► │  tool: get-sprint  │
│      'scrum-board', │           │                    │
│      'get-sprint',  │ ◄──────── │  { data: ... }     │
│      { id: 1 }      │ JSON-RPC  │                    │
│     )               │           │                    │
└─────────────────────┘           └────────────────────┘
```

Unlike the EventBus (fire-and-forget, asynchronous), the ClientManager provides **synchronous request/response** communication between servers.
