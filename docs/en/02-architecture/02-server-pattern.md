# The Server Pattern

## Introduction

Every MCP server in the suite follows a **strict 4-layer architectural pattern**. This pattern guarantees uniformity, maintainability, and testability across all 22 servers. In this section we analyze each layer in detail with real code examples taken from the codebase.

---

## Complete Anatomy of a Server

```
servers/scrum-board/
├── package.json              # Dependencies: core, database, event-bus, sdk, zod
├── tsconfig.json             # Extends ../../tsconfig.base.json
└── src/
    ├── index.ts              # 1. ENTRY POINT: bootstrap and startup
    ├── server.ts             # 2. FACTORY: server creation and tool registration
    ├── collaboration.ts      # 3. COLLABORATION: cross-server event handlers
    ├── tools/                # 4. TOOLS: one file per MCP tool
    │   ├── create-sprint.ts
    │   ├── get-sprint.ts
    │   ├── create-story.ts
    │   ├── create-task.ts
    │   ├── update-task-status.ts
    │   ├── sprint-board.ts
    │   └── get-backlog.ts
    └── services/             # 5. SERVICES: persistence and domain logic
        └── scrum-store.ts
```

---

## Layer 1: Entry Point (index.ts)

The entry point is the simplest file. It has three responsibilities:
1. Create a `LocalEventBus` instance
2. Call the server factory
3. Start the transport

```typescript
#!/usr/bin/env node

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createScrumBoardServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createScrumBoardServer(eventBus);
startServer(suite).catch((error) => {
  console.error('Failed to start scrum-board server:', error);
  process.exit(1);
});
```

**Key points:**
- The shebang `#!/usr/bin/env node` allows direct execution as a binary
- The EventBus is created here and injected into the server (Dependency Injection)
- `startServer()` automatically chooses the transport (STDIO or HTTP) based on configuration
- Fatal errors terminate the process with `process.exit(1)`

---

## Layer 2: Factory (server.ts)

The factory is the heart of the server. It creates the `McpSuiteServer`, instantiates services, registers tools, and configures collaboration.

```typescript
import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { ScrumStore } from './services/scrum-store.js';
import { registerCreateSprint } from './tools/create-sprint.js';
import { registerGetSprint } from './tools/get-sprint.js';
import { registerCreateStory } from './tools/create-story.js';
import { registerCreateTask } from './tools/create-task.js';
import { registerUpdateTaskStatus } from './tools/update-task-status.js';
import { registerSprintBoard } from './tools/sprint-board.js';
import { registerGetBacklog } from './tools/get-backlog.js';
import { setupCollaborationHandlers } from './collaboration.js';

export function createScrumBoardServer(eventBus?: EventBus): McpSuiteServer {
  const suite = createMcpServer({
    name: 'scrum-board',
    version: '0.1.0',
    description: 'MCP server for managing sprints, user stories, tasks',
    eventBus,
  });

  const store = new ScrumStore();

  // Register all tools
  registerCreateSprint(suite.server, store, suite.eventBus);
  registerGetSprint(suite.server, store);
  registerCreateStory(suite.server, store);
  registerCreateTask(suite.server, store);
  registerUpdateTaskStatus(suite.server, store, suite.eventBus);
  registerSprintBoard(suite.server, store);
  registerGetBacklog(suite.server, store);

  // Configure cross-server collaboration (only if EventBus is present)
  if (suite.eventBus) {
    setupCollaborationHandlers(suite.eventBus, store);
  }

  suite.logger.info('All scrum-board tools registered');

  return suite;
}
```

**Key points:**
- `createMcpServer()` is the `@mcp-suite/core` factory that returns `McpSuiteServer`
- The store is created once and shared across all tools
- The `eventBus` is optional (parameter `?`): the server works without it too
- Collaboration is activated only if `suite.eventBus` exists

---

## The createMcpServer Factory

Defined in `@mcp-suite/core`, this function standardizes the creation of all servers:

```typescript
export interface CreateServerOptions {
  name: string;
  version: string;
  description?: string;
  config?: Partial<ServerConfig>;
  eventBus?: EventBus;
}

export interface McpSuiteServer {
  server: McpServer;      // MCP server instance from the official SDK
  config: ServerConfig;   // Loaded and validated configuration
  logger: Logger;         // Structured logger on stderr
  eventBus?: EventBus;    // Optional EventBus
}

export function createMcpServer(options: CreateServerOptions): McpSuiteServer {
  const config = loadConfig(options.name, options.config);
  const logger = new Logger(options.name, config.logLevel);

  logger.info(`Initializing ${options.name} v${options.version}`);

  const server = new McpServer({
    name: options.name,
    version: options.version,
  });

  return { server, config, logger, eventBus: options.eventBus };
}
```

The internal flow:
1. Loads configuration from environment variables (`loadConfig`)
2. Creates the logger with the configured level
3. Instantiates the `McpServer` from the official SDK
4. Returns the complete `McpSuiteServer` bundle

---

## Layer 3: Tool Registration

Each tool is a separate file that exports a `registerXxx` function. This function receives the `McpServer`, the store, and optionally the `EventBus`.

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { ScrumStore } from '../services/scrum-store.js';

export function registerCreateSprint(
  server: McpServer,
  store: ScrumStore,
  eventBus?: EventBus,
): void {
  server.tool(
    'create-sprint',                                       // Tool name
    'Create a new sprint with a name, date range, and goals',  // Description
    {                                                       // Parameter schema (Zod)
      name: z.string().describe('Sprint name (e.g. "Sprint 12")'),
      startDate: z.string().describe('Start date in ISO format (YYYY-MM-DD)'),
      endDate: z.string().describe('End date in ISO format (YYYY-MM-DD)'),
      goals: z.array(z.string()).describe('Sprint goals'),
    },
    async ({ name, startDate, endDate, goals }) => {       // Handler
      try {
        const sprint = store.createSprint({ name, startDate, endDate, goals });

        // Fire-and-forget event publishing
        eventBus?.publish('scrum:sprint-started', {
          sprintId: String(sprint.id),
          name: sprint.name,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(sprint, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Failed to create sprint: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        };
      }
    },
  );
}
```

**Tool registration pattern:**

| Element | Description |
|---------|-------------|
| Tool name | Unique string within the server (e.g. `'create-sprint'`) |
| Description | LLM-readable text to understand what the tool does |
| Zod schema | Validation and documentation of input parameters |
| Async handler | Function that executes the logic and returns the result |
| EventBus | Optional parameter, used with `eventBus?.publish(...)` |

**Return convention:**
```typescript
// Success
return {
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
};

// Error
return {
  content: [{ type: 'text', text: `Error: ${message}` }],
  isError: true,
};
```

---

## Layer 4: Services and Store

Services contain the business logic and persistence. The Store is the main class that manages operations on the SQLite database.

```typescript
import type Database from 'better-sqlite3';
import { createDatabase } from '@mcp-suite/database';
import { runMigrations, type Migration } from '@mcp-suite/database';

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create sprints, stories, and tasks tables',
    up: `
      CREATE TABLE IF NOT EXISTS sprints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        goals TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'planning',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
      -- ... other tables ...
    `,
  },
];

export class ScrumStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    this.db = createDatabase({
      serverName: 'scrum-board',
      inMemory: options?.inMemory,
      dataDir: options?.dataDir,
    });
    runMigrations(this.db, migrations);
  }

  createSprint(input: { name: string; startDate: string; endDate: string; goals: string[] }): Sprint {
    const stmt = this.db.prepare(
      'INSERT INTO sprints (name, startDate, endDate, goals) VALUES (?, ?, ?, ?)',
    );
    const result = stmt.run(input.name, input.startDate, input.endDate, JSON.stringify(input.goals));
    return this.getSprint(Number(result.lastInsertRowid))!;
  }

  // ... other CRUD methods ...
}
```

**Key points about the Store:**
- Uses `createDatabase()` from `@mcp-suite/database` to create the database
- Migrations are defined as an array of `Migration` objects
- The constructor supports `inMemory: true` for testing
- JSON arrays are serialized with `JSON.stringify` and deserialized with `JSON.parse`

---

## Cross-Server Collaboration

The `collaboration.ts` file configures subscriptions to events coming from other servers:

```typescript
import type { EventBus } from '@mcp-suite/core';
import type { ScrumStore } from './services/scrum-store.js';

export function setupCollaborationHandlers(eventBus: EventBus, _store: ScrumStore): void {
  // When a retrospective creates an action item, the scrum-board takes note
  eventBus.subscribe('retro:action-item-created', (payload) => {
    // Future: automatically create a task from the action item
    void payload;
  });
}
```

**Collaboration pattern:**
- The `setupCollaborationHandlers` function is called only if the EventBus exists
- It receives the EventBus and the store to be able to react to events
- Uses `eventBus.subscribe()` to listen for specific events
- Uses `eventBus.subscribePattern()` to listen for groups of events (e.g. `'scrum:*'`)

---

## How the EventBus is Injected

The EventBus injection flow is as follows:

```
index.ts                    server.ts                        tools/xxx.ts
────────                    ─────────                        ────────────

const eventBus =            function createXxxServer(         function registerXxx(
  new LocalEventBus();        eventBus?: EventBus             server, store,
                            ) {                                eventBus?: EventBus
const suite =                 const suite = createMcpServer({ ) {
  createXxxServer(              eventBus,                       // usage:
    eventBus                  });                                eventBus?.publish(...)
  );                                                           }

                              registerXxx(
                                suite.server,
                                store,
                                suite.eventBus    // <-- passed to tools
                              );
                            }
```

The pattern is:
1. `index.ts` creates the `LocalEventBus`
2. Passes it to the server factory as an optional parameter
3. The factory includes it in the `McpSuiteServer` object
4. Passes it to the tool registration functions that need it
5. Tools use it with the optional chaining operator: `eventBus?.publish(...)`

This **fire-and-forget** design means that:
- If the EventBus does not exist, the call `eventBus?.publish(...)` does nothing
- If the EventBus exists but no one is listening, the event is ignored
- The tool never waits for the event response: it publishes and moves on

---

## Pattern Summary

```
┌──────────────────────────────────────────────────────────┐
│                      index.ts                            │
│  Creates EventBus → Calls factory → Starts server        │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│                      server.ts                           │
│  createMcpServer() → Creates Store → Registers Tools     │
│  → Sets up Collaboration                                │
└──────────┬──────────────────────────┬────────────────────┘
           │                          │
           ▼                          ▼
┌────────────────────┐   ┌─────────────────────────────────┐
│     tools/         │   │          services/               │
│  registerXxx()     │   │  Store with SQLite + Migrations  │
│  Zod Schema        │   │  Domain logic                    │
│  Async Handler     │   │  CRUD operations                 │
│  EventBus publish  │   │                                  │
└────────────────────┘   └─────────────────────────────────┘
```
