# @mcp-suite/core

## Introduction

The `@mcp-suite/core` package is the heart of the suite. It provides the fundamental utilities used by all 22 servers: the server creation factory, the configuration system, the structured logger, the error hierarchy, and the shared domain types.

```
packages/core/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts          # Re-export of all modules
    ├── server-factory.ts # createMcpServer, startServer, McpSuiteServer
    ├── config.ts         # loadConfig, ServerConfigSchema
    ├── logger.ts         # Structured logger on stderr
    ├── errors.ts         # Typed error hierarchy
    └── types.ts          # Shared domain types
```

**Dependencies:**
- `@modelcontextprotocol/sdk` - Official MCP protocol SDK
- `@mcp-suite/event-bus` - EventBus for inter-server collaboration
- `zod` - Configuration schema validation and parsing

---

## server-factory.ts

This module contains the main factory for creating MCP servers and the startup functions.

### CreateServerOptions

The interface for server creation options:

```typescript
export interface CreateServerOptions {
  name: string;             // Unique server name (e.g. 'scrum-board')
  version: string;          // Semantic version (e.g. '0.1.0')
  description?: string;     // Human-readable description
  config?: Partial<ServerConfig>;  // Configuration override
  eventBus?: EventBus;      // Optional EventBus for collaboration
}
```

### McpSuiteServer

The interface representing an instantiated server ready for use:

```typescript
export interface McpSuiteServer {
  name: string;           // Unique server name (e.g. 'scrum-board')
  server: McpServer;      // MCP server instance from the official SDK
  config: ServerConfig;   // Configuration loaded and validated with Zod
  logger: Logger;         // Structured logger (writes to stderr)
  eventBus?: EventBus;    // Optional EventBus (undefined if not provided)
  httpServer?: Server;    // Reference to the HTTP server (if HTTP transport is active)
}
```

This interface is the **central contract** of the architecture: every server implements it, every tool registration function receives it (or receives its fields).

### createMcpServer()

The factory that creates the `McpSuiteServer` instance:

```typescript
export function createMcpServer(options: CreateServerOptions): McpSuiteServer {
  // 1. Load configuration from env + overrides
  const config = loadConfig(options.name, options.config);

  // 2. Create logger with the configured level
  const logger = new Logger(options.name, config.logLevel);
  logger.info(`Initializing ${options.name} v${options.version}`);

  // 3. Instantiate McpServer from the official SDK
  const server = new McpServer({
    name: options.name,
    version: options.version,
  });

  // 4. Return the complete bundle
  return { server, config, logger, eventBus: options.eventBus };
}
```

**Flow:**

```
CreateServerOptions
        │
        ├──► loadConfig(name, overrides)  ──► ServerConfig
        │
        ├──► new Logger(name, logLevel)   ──► Logger
        │
        ├──► new McpServer({name, version}) ──► McpServer
        │
        └──► { server, config, logger, eventBus } ──► McpSuiteServer
```

### startServer(), startStdioServer() and startHttpServer()

Functions to start the server with the appropriate transport:

```typescript
export async function startStdioServer(suite: McpSuiteServer): Promise<void> {
  const transport = new StdioServerTransport();
  suite.logger.info('Starting server with STDIO transport');
  await suite.server.connect(transport);
}

export async function startHttpServer(suite: McpSuiteServer): Promise<void> {
  const port = suite.config.port ?? 3000;
  const app = createMcpExpressApp();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),  // Stateful mode
  });

  await suite.server.connect(transport);

  // Standard MCP routes (Streamable HTTP spec)
  app.post('/mcp', async (req, res) => { await transport.handleRequest(req, res, req.body); });
  app.get('/mcp', async (req, res) => { await transport.handleRequest(req, res); });
  app.delete('/mcp', async (req, res) => { await transport.handleRequest(req, res); });

  // Health check
  app.get('/health', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', server: suite.name }));
  });

  suite.httpServer = app.listen(port);
}

export async function startServer(suite: McpSuiteServer): Promise<void> {
  if (suite.config.transport === 'http') {
    await startHttpServer(suite);
  } else {
    await startStdioServer(suite);
  }
}
```

The `startServer()` function automatically selects the transport based on configuration (`MCP_SUITE_TRANSPORT=http` or `MCP_SUITE_TRANSPORT=stdio`).

The HTTP transport uses the **Streamable HTTP** protocol from the MCP SDK in **stateful** mode (each session has a UUID). The Express app is created via the SDK's `createMcpExpressApp()`, which handles body parsing and standard routes. The `/health` endpoint enables monitoring.

---

## config.ts

The configuration module handles loading parameters from environment variables with Zod validation.

### ServerConfigSchema

```typescript
export const ServerConfigSchema = z.object({
  transport: z.enum(['stdio', 'http']).default('stdio'),
  port: z.number().optional(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  dataDir: z.string().optional(),
  eventBus: z
    .object({
      type: z.enum(['local', 'redis']).default('local'),
      redisUrl: z.string().optional(),
    })
    .default({ type: 'local' }),
});
```

### loadConfig()

Loading follows a priority cascade:

```
Specific Variable ──► Global Variable ──► Programmatic Override ──► Zod Default
(MCP_SUITE_XXX_YYY)   (MCP_SUITE_YYY)    (overrides parameter)    (schema .default())
```

```typescript
export function loadConfig(
  serverName: string,
  overrides?: Partial<ServerConfig>
): ServerConfig {
  const raw: Record<string, unknown> = {};

  // Look for specific variable, then global
  const transport = process.env[envKey(serverName, 'TRANSPORT')]
                 || process.env.MCP_SUITE_TRANSPORT;
  if (transport) raw.transport = transport;

  // ... other fields ...

  const merged = { ...raw, ...overrides };
  return ServerConfigSchema.parse(merged);  // Validation + defaults
}
```

The `envKey` helper function converts the server name to the environment variable format:

```typescript
function envKey(serverName: string, field: string): string {
  const prefix = serverName.replace(/-/g, '_').toUpperCase();
  return `MCP_SUITE_${prefix}_${field.toUpperCase()}`;
}
// envKey('scrum-board', 'LOG_LEVEL') => 'MCP_SUITE_SCRUM_BOARD_LOG_LEVEL'
```

---

## logger.ts

The Logger writes structured logs in JSON format to `stderr`. Using stderr is essential: the MCP protocol uses `stdout` for JSON-RPC communication, so logs must go to a separate channel.

### Logger Class

```typescript
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private level: number;

  constructor(
    private readonly name: string,    // Server name
    level: LogLevel = 'info',         // Minimum log level
  ) {
    this.level = LOG_LEVELS[level];
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < this.level) return;  // Level filtering

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      server: this.name,
      message,
      ...data,  // Additional structured data
    };

    process.stderr.write(JSON.stringify(entry) + '\n');
  }
}
```

**Output example:**
```json
{"timestamp":"2025-01-15T10:30:00.000Z","level":"info","server":"scrum-board","message":"All scrum-board tools registered"}
```

### Why stderr?

```
┌───────────────────────────────────┐
│         Node.js Process           │
│                                   │
│  stdout ──► JSON-RPC (MCP)        │  ← communication with client
│  stderr ──► Structured logs       │  ← diagnostic messages
└───────────────────────────────────┘
```

If logs went to stdout, they would corrupt the JSON-RPC stream and the MCP client would be unable to communicate with the server.

---

## errors.ts

A typed error hierarchy for handling different types of failures uniformly.

```
McpSuiteError (base)
├── ConfigError          (configuration errors)
├── ConnectionError      (connection errors)
├── ToolExecutionError   (errors during tool execution)
├── NotFoundError        (resource not found)
└── ValidationError      (input validation errors)
```

### McpSuiteError (base class)

```typescript
export class McpSuiteError extends Error {
  constructor(
    message: string,
    public readonly code: string,      // Machine-readable error code
    public readonly details?: unknown,  // Additional details
  ) {
    super(message);
    this.name = 'McpSuiteError';
  }
}
```

### Derived Classes

| Class | Code | Usage |
|-------|------|-------|
| `ConfigError` | `CONFIG_ERROR` | Invalid or missing configuration |
| `ConnectionError` | `CONNECTION_ERROR` | Connection problems with database or external services |
| `ToolExecutionError` | `TOOL_EXECUTION_ERROR` | Error during MCP tool execution |
| `NotFoundError` | `NOT_FOUND` | Requested resource not found (e.g. sprint, task) |
| `ValidationError` | `VALIDATION_ERROR` | Invalid user input |

### Usage Example

```typescript
import { NotFoundError, ToolExecutionError } from '@mcp-suite/core';

// In a store
const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(id);
if (!sprint) {
  throw new NotFoundError('Sprint', String(id));
  // Message: "Sprint with id '42' not found"
  // Code:    "NOT_FOUND"
}

// In a tool handler
try {
  const result = store.createSprint(input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
} catch (error) {
  if (error instanceof NotFoundError) {
    return { content: [{ type: 'text', text: error.message }], isError: true };
  }
  throw new ToolExecutionError('Failed to create sprint', error);
}
```

---

## types.ts

This module defines all shared domain types across servers. Types are organized by functional area.

### Tool Result Types

```typescript
export interface ToolSuccess<T = unknown> {
  success: true;
  data: T;
  metadata?: Record<string, unknown>;
}

export interface ToolError {
  success: false;
  error: string;
  code: string;
  details?: unknown;
}

export type ToolResult<T = unknown> = ToolSuccess<T> | ToolError;
```

### Types Organized by Domain

| Domain | Types | Used by |
|--------|-------|---------|
| Code & Git | `FileReference`, `GitCommitInfo`, `CodeIssue` | code-review, codebase-knowledge |
| Project Management | `TaskStatus`, `TaskReference`, `UserStory`, `SprintInfo` | scrum-board, agile-metrics |
| Time Tracking | `TimeEntry` | time-tracking |
| Agile Metrics | `ProjectMetrics`, `BurndownPoint` | agile-metrics |
| Economics | `BudgetInfo`, `BudgetCategory`, `CostEntry` | project-economics |
| Retrospective | `RetroFormat`, `RetroItem`, `ActionItem` | retrospective-manager |
| Environment | `EnvVariable`, `EnvironmentConfig` | environment-manager |
| Snippet | `CodeSnippet` | snippet-manager |
| HTTP | `HttpRequest`, `HttpResponse` | http-client |
| Docker | `DockerService` | docker-compose |
| CI/CD | `PipelineStatus`, `PipelineRun`, `PipelineStage` | cicd-monitor |
| Database | `TableInfo`, `ColumnInfo`, `IndexInfo`, `ForeignKeyInfo` | db-schema-explorer |

---

## Package Exports

The `index.ts` file re-exports everything in an organized way:

```typescript
// Factory and server
export { createMcpServer, startStdioServer, startHttpServer, startServer,
         type CreateServerOptions, type McpSuiteServer } from './server-factory.js';

// EventBus (re-exported for convenience)
export type { EventBus } from '@mcp-suite/event-bus';

// Configuration
export { loadConfig, ServerConfigSchema, type ServerConfig } from './config.js';

// Logger
export { Logger, type LogLevel } from './logger.js';

// Errors
export { McpSuiteError, ConfigError, ConnectionError,
         ToolExecutionError, NotFoundError, ValidationError } from './errors.js';

// Domain types (30+ types exported)
export type { ToolSuccess, ToolError, ToolResult, FileReference,
             GitCommitInfo, CodeIssue, TaskStatus, /* ... */ } from './types.js';
```

This allows servers to import everything from a single entry point:

```typescript
import {
  createMcpServer,
  type McpSuiteServer,
  type EventBus,
  Logger,
  NotFoundError
} from '@mcp-suite/core';
```
