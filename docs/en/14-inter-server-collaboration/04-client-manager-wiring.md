# Client Manager Wiring: Synchronous Calls Between Servers

## Overview

**Client Manager Wiring** is the mechanism that allows an MCP server to **call tools on another server** synchronously (request/response). Unlike the EventBus, which handles asynchronous fire-and-forget notifications, Client Manager Wiring is designed for scenarios where a server needs **data from another server** to complete its own operation.

```
Calling Server                    Client Manager                  Target Server
      |                                |                               |
      |-- callTool('target', 'tool') ->|                               |
      |                                |-- MCP JSON-RPC request ------>|
      |                                |                               |
      |                                |<--- MCP JSON-RPC response ----|
      |<-- result --------------------|                               |
      |                                                                |
      |   (synchronous: the caller                                     |
      |    waits for the result)                                       |
```

---

## EventBus vs Client Manager: When to Use What

| Feature | EventBus (Pub/Sub) | Client Manager (RPC) |
|---------|-------------------|---------------------|
| **Communication** | Asynchronous, fire-and-forget | Synchronous, request/response |
| **Direction** | One-to-many (broadcast) | One-to-one (direct call) |
| **Coupling** | None (publisher ignores subscribers) | Low (the caller knows the target) |
| **Typical use** | Notifications, automatic updates | Data queries, result enrichment |
| **Errors** | Ignored (do not impact the publisher) | Handled with graceful degradation |
| **Example** | "Sprint created" -> update metrics | "Give me sprint data" -> calculate velocity |

**Rule of thumb**: use the EventBus when you want to **notify** other servers, use the Client Manager when you **need data** from another server.

---

## The 6 Wiring Scenarios

MCP Suite implements 6 cross-server communication scenarios involving 5 calling servers and 3 target servers:

```
                    +-----------------+
                    |   scrum-board    |
                    |  (target)        |
                    +---^----------^---+
                        |          |
         get-sprint     |          |  sprint-board
         (sprintIds)    |          |  (includeSprintData)
                        |          |
+-----------------+     |    +-----+--------------------+
|  agile-metrics  |-----+    |    standup-notes         |
|  (caller x2)    |          |     (caller)             |
+-------+---------+          +-------------------------+
        |
        | get-timesheet
        | (fetchTimeData)
        |
        v
+-----------------+
|  time-tracking  |<-------- project-economics
|  (target x2)    |          (includeTimeData)
+-----------------+

+-----------------+          +----------------------+
|  db-schema-     |<-------- | data-mock-generator  |
|  explorer       |          | (dbPath)             |
|  (target)       |          +----------------------+
+-----------------+

+-----------------+          +----------------------+
|  codebase-      |<-------- |    test-generator    |
|  knowledge      |          |     (filePath)       |
|  (target)       |          +----------------------+
+-----------------+
```

### Summary Table

| # | Caller | Target | Target Tool | Trigger Parameter | Purpose |
|---|--------|--------|-------------|-------------------|---------|
| 1 | agile-metrics | scrum-board | `get-sprint` | `sprintIds` | Calculate velocity with real sprint data |
| 2 | agile-metrics | time-tracking | `get-timesheet` | `fetchTimeData` | Enrich cycle-time with tracked hours |
| 3 | project-economics | time-tracking | `get-timesheet` | `includeTimeData` | Calculate labor cost from timesheet |
| 4 | data-mock-generator | db-schema-explorer | `explore-schema` | `dbPath` | Generate mock data from real DB schema |
| 5 | test-generator | codebase-knowledge | `explain-module` | `filePath` | Generate tests from module analysis |
| 6 | standup-notes | scrum-board | `sprint-board` | `includeSprintData` | Status report with sprint data |

---

## Detailed Description of the 6 Scenarios

### 1. agile-metrics -> scrum-board (`calculate-velocity`)

The `calculate-velocity` tool can receive a `sprintIds` array. If provided and the Client Manager is available, it calls `get-sprint` on scrum-board for each ID and calculates velocity based on completed tasks.

```typescript
// Tool call with wiring
await callTool('calculate-velocity', {
  sprintIds: [1, 2, 3],
  // sprints is no longer needed: data comes from the target server
});
```

**Enriched result**: the `sprints` field contains `completedPoints` and `totalPoints` calculated from the actual tasks present in the scrum-board sprint.

### 2. agile-metrics -> time-tracking (`calculate-cycle-time`)

When `fetchTimeData: true` is provided along with a `dateRange`, the tool calls `get-timesheet` on time-tracking and adds a `timeTracking` field to the result:

```typescript
const result = await callTool('calculate-cycle-time', {
  tasks: [
    { startedAt: '2025-06-10T09:00:00Z', completedAt: '2025-06-12T17:00:00Z' },
  ],
  fetchTimeData: true,
  dateRange: { start: '2025-06-10', end: '2025-06-12' },
});

// result.timeTracking = {
//   totalTrackedHours: 3,
//   avgTrackedHoursPerTask: 1.5,
// }
```

### 3. project-economics -> time-tracking (`forecast-budget`)

The `forecast-budget` tool can include a labor cost analysis based on actual hours. With `includeTimeData: true` and an `hourlyRate`, it calls `get-timesheet` and calculates:

```typescript
const result = await callTool('forecast-budget', {
  projectName: 'my-project',
  includeTimeData: true,
  hourlyRate: 75,
});

// result.laborAnalysis = {
//   trackedHours: 8,
//   hourlyRate: 75,
//   estimatedLaborCost: 600,   // 8h * 75 EUR
//   timesheetEntries: 1,
// }
```

### 4. data-mock-generator -> db-schema-explorer (`generate-mock-data`)

Instead of defining the schema manually, you can pass a `dbPath` to a SQLite database. The tool calls `explore-schema` on db-schema-explorer, maps SQL columns to mock data generators, and produces rows consistent with the real schema:

```typescript
const result = await callTool('generate-mock-data', {
  dbPath: '/path/to/database.db',
  tableName: 'users',
  count: 100,
});
// Generates 100 rows with the columns from the 'users' table
// Auto-increment primary key columns are excluded
```

**SQL -> Generator Mapping**: the tool uses heuristics based on column names (`email` -> email generator, `phone` -> phone generator) and SQL type as fallback (`INTEGER` -> integer, `BOOLEAN` -> boolean).

### 5. test-generator -> codebase-knowledge (`generate-unit-tests`)

The `generate-unit-tests` tool accepts a `filePath` as an alternative to the `code` parameter. If provided, it calls `explain-module` on codebase-knowledge to analyze the file, extract exported functions, and generate skeleton tests for each:

```typescript
const result = await callTool('generate-unit-tests', {
  filePath: '/path/to/module.ts',
  framework: 'vitest',
});
// Generates skeleton tests based on the functions found in the file
```

### 6. standup-notes -> scrum-board (`generate-status-report`)

With `includeSprintData: true`, the status report is enriched with real-time data from the sprint board:

```typescript
const result = await callTool('generate-status-report', {
  team: 'backend',
  includeSprintData: true,
  sprintId: 42,
});

// result.sprintBoard = {
//   sprintName: 'Sprint 42',
//   sprintStatus: 'active',
//   taskCounts: { todo: 3, inProgress: 2, inReview: 1, done: 5, blocked: 0 },
// }
```

---

## Implementation Pattern

### Structure in the Calling Server

```typescript
// 1. server.ts - Accept and propagate the clientManager
export function createMyServer(options?: {
  eventBus?: EventBus;
  clientManager?: McpClientManager;  // <-- optional
  storeOptions?: { inMemory?: boolean };
}): McpSuiteServer {
  const suite = createMcpServer({ ... });
  const store = new MyStore(...);

  // Pass clientManager to tools that need it
  registerMyTool(suite.server, store, options?.clientManager);

  return suite;
}

// 2. tools/my-tool.ts - Use clientManager if available
export function registerMyTool(
  server: McpServer,
  store: MyStore,
  clientManager?: McpClientManager,  // <-- optional
): void {
  server.tool('my-tool', 'description', {
    // Normal parameters...
    enrichFromExternal: z.boolean().optional(),  // <-- trigger
  }, async ({ enrichFromExternal }) => {
    let enrichment = undefined;

    // Wiring: only if requested AND clientManager is available
    if (enrichFromExternal && clientManager) {
      const result = await clientManager.callTool(
        'target-server',
        'target-tool',
        { /* args */ },
      );
      const content = (result as { content: Array<{ type: string; text: string }> }).content;
      enrichment = JSON.parse(content[0].text);
    }

    // Base result + optional enrichment
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ ...baseResult, enrichment }),
      }],
    };
  });
}

// 3. index.ts - Create and configure the clientManager
import { McpClientManager } from '@mcp-suite/client-manager';

const clientManager = new McpClientManager();
clientManager.registerMany([
  {
    name: 'target-server',
    transport: 'http',
    url: process.env.MCP_SUITE_TARGET_URL || 'http://localhost:3001/mcp',
  },
]);

const suite = createMyServer({ eventBus, clientManager });
```

### Graceful Degradation

The fundamental principle of wiring is **graceful degradation**: every tool works perfectly even without Client Manager. The wiring enriches the result, but it is never mandatory.

```typescript
// The if (param && clientManager) pattern ensures:
// 1. Without clientManager: the tool works normally
// 2. Without the trigger parameter: wiring is not activated
// 3. With both: the result is enriched with external data
if (enrichFromExternal && clientManager) {
  // cross-server call
}
```

---

## Testing the Wiring

Integration tests for wiring use `InMemoryTransport` to connect servers in-process without networking:

```typescript
import { McpClientManager } from '@mcp-suite/client-manager';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';

describe('caller -> target wiring', () => {
  let callerHarness: TestHarness;
  let clientManager: McpClientManager;

  afterEach(async () => {
    if (callerHarness) await callerHarness.close();
    if (clientManager) await clientManager.disconnectAll();
  });

  it('should enrich result with data from target server', async () => {
    // 1. Create the target server in-memory
    const targetSuite = createTargetServer({ storeOptions: { inMemory: true } });

    // 2. Create a linked transport pair
    const [clientTransport, serverTransport] = McpClientManager.createInMemoryPair();
    clientManager = new McpClientManager();

    // 3. Connect: server FIRST, THEN client
    await targetSuite.server.connect(serverTransport);
    await clientManager.connectInMemoryWithTransport('target', clientTransport);

    // 4. Populate data in the target server (if needed)
    await clientManager.callTool('target', 'create-item', { name: 'Test' });

    // 5. Create the calling server with the clientManager
    const callerSuite = createCallerServer({
      clientManager,
      storeOptions: { inMemory: true },
    });
    callerHarness = await createTestHarness(callerSuite.server);

    // 6. Call the tool with the wiring parameter
    const result = await callerHarness.client.callTool({
      name: 'enriched-tool',
      arguments: { enrichFromExternal: true },
    });

    // 7. Verify the enriched result
    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0].text);
    expect(data.enrichment).toBeDefined();
  });
});
```

**Important note**: with `InMemoryTransport`, the server MUST connect to its transport BEFORE the client connects to its own. The client immediately sends the `initialize` message upon connection.

---

## HTTP Ports for Target Servers

When servers communicate via HTTP (production deployment), each server listens on a dedicated port. The target servers used in wiring:

| Target Server | Default Port | Environment Variable |
|--------------|-------------|---------------------|
| scrum-board | 3018 | `MCP_SUITE_SCRUM_BOARD_URL` |
| time-tracking | 3022 | `MCP_SUITE_TIME_TRACKING_URL` |
| db-schema-explorer | 3007 | `MCP_SUITE_DB_SCHEMA_EXPLORER_URL` |
| codebase-knowledge | 3005 | `MCP_SUITE_CODEBASE_KNOWLEDGE_URL` |

URLs are configurable via environment variables; the default is `http://localhost:<port>/mcp`.
