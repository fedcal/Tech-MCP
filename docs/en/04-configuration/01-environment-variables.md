# Environment Variables and Configuration

## Introduction

Each MCP Suite server loads its own configuration from **environment variables** following a predictable pattern. The configuration is validated at runtime via Zod, ensuring that incorrect values are reported immediately at startup.

---

## Environment Variable Pattern

Variables follow the format:

```
MCP_SUITE_<SERVER_NAME>_<FIELD>
```

The server name is converted: hyphens (`-`) become underscores (`_`) and everything is in UPPERCASE.

**Examples:**
| Server | Variable |
|--------|----------|
| `scrum-board` | `MCP_SUITE_SCRUM_BOARD_LOG_LEVEL` |
| `time-tracking` | `MCP_SUITE_TIME_TRACKING_DATA_DIR` |
| `db-schema-explorer` | `MCP_SUITE_DB_SCHEMA_EXPLORER_TRANSPORT` |
| `cicd-monitor` | `MCP_SUITE_CICD_MONITOR_PORT` |

### Global Variables (fallback)

If a server-specific variable is not defined, the system looks for the global variable without the server prefix:

```
MCP_SUITE_<FIELD>
```

**Resolution order:**
1. `MCP_SUITE_SCRUM_BOARD_LOG_LEVEL` (server-specific)
2. `MCP_SUITE_LOG_LEVEL` (global, used as fallback)
3. Default value from the Zod schema

---

## Available Fields

| Field | Specific Variable | Global Variable | Type | Default |
|-------|-------------------|-----------------|------|---------|
| **transport** | `MCP_SUITE_<SERVER>_TRANSPORT` | `MCP_SUITE_TRANSPORT` | `'stdio' \| 'http'` | `'stdio'` |
| **port** | `MCP_SUITE_<SERVER>_PORT` | `MCP_SUITE_PORT` | `number` | (none) |
| **logLevel** | `MCP_SUITE_<SERVER>_LOG_LEVEL` | `MCP_SUITE_LOG_LEVEL` | `'debug' \| 'info' \| 'warn' \| 'error'` | `'info'` |
| **dataDir** | `MCP_SUITE_<SERVER>_DATA_DIR` | `MCP_SUITE_DATA_DIR` | `string` (path) | `~/.mcp-suite/data/` |
| **eventBus.type** | `MCP_SUITE_<SERVER>_EVENT_BUS_TYPE` | `MCP_SUITE_EVENT_BUS_TYPE` | `'local' \| 'redis'` | `'local'` |
| **eventBus.redisUrl** | `MCP_SUITE_<SERVER>_REDIS_URL` | `MCP_SUITE_REDIS_URL` | `string` (URL) | (none) |

---

## Configuration Zod Schema

The configuration is defined and validated through the following schema in `@mcp-suite/core`:

```typescript
import { z } from 'zod';

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

export type ServerConfig = z.infer<typeof ServerConfigSchema>;
```

**Resulting `ServerConfig` type:**
```typescript
interface ServerConfig {
  transport: 'stdio' | 'http';
  port?: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  dataDir?: string;
  eventBus: {
    type: 'local' | 'redis';
    redisUrl?: string;
  };
}
```

---

## The loadConfig Function

The `loadConfig` function in `@mcp-suite/core` handles the loading:

```typescript
export function loadConfig(serverName: string, overrides?: Partial<ServerConfig>): ServerConfig {
  const raw: Record<string, unknown> = {};

  // 1. Look for the server-specific variable, then the global one
  const transport = process.env[envKey(serverName, 'TRANSPORT')]
                 || process.env.MCP_SUITE_TRANSPORT;
  if (transport) raw.transport = transport;

  const port = process.env[envKey(serverName, 'PORT')]
            || process.env.MCP_SUITE_PORT;
  if (port) raw.port = parseInt(port, 10);

  const logLevel = process.env[envKey(serverName, 'LOG_LEVEL')]
                || process.env.MCP_SUITE_LOG_LEVEL;
  if (logLevel) raw.logLevel = logLevel;

  // ... other fields ...

  // 2. Merge with any programmatic overrides
  const merged = { ...raw, ...overrides };

  // 3. Validation with Zod (applies defaults)
  return ServerConfigSchema.parse(merged);
}
```

---

## .env File Example

Create a `.env` file in the project root (or in the execution directory) and load it with a tool like `dotenv`:

```bash
# ── Global Configuration ──────────────────────────────────


# Log level for all servers (default: info)
MCP_SUITE_LOG_LEVEL=info

# Directory for SQLite databases (default: ~/.mcp-suite/data/)
MCP_SUITE_DATA_DIR=/home/user/.mcp-suite/data

# Transport type (default: stdio)
MCP_SUITE_TRANSPORT=stdio

# EventBus type (default: local)
MCP_SUITE_EVENT_BUS_TYPE=local

# ── Server-Specific Overrides ─────────────────────────────

# Debug enabled only for the scrum-board server
MCP_SUITE_SCRUM_BOARD_LOG_LEVEL=debug

# Time-tracking database in a different directory
MCP_SUITE_TIME_TRACKING_DATA_DIR=/var/data/mcp/time-tracking

# The http-client server on port 3100 (when using HTTP transport)
MCP_SUITE_HTTP_CLIENT_TRANSPORT=http
MCP_SUITE_HTTP_CLIENT_PORT=3100
```

**Note:** MCP Suite servers do not automatically load `.env` files. To use them, start the server with a tool like `dotenv-cli`:

```bash
npx dotenv-cli -- node servers/scrum-board/dist/index.js
```

Or pass the variables through the Claude Desktop configuration:

```json
{
  "scrum-board": {
    "command": "node",
    "args": ["/path/to/servers/scrum-board/dist/index.js"],
    "env": {
      "MCP_SUITE_SCRUM_BOARD_LOG_LEVEL": "debug"
    }
  }
}
```

---

## Data Directory

### Default path

```
~/.mcp-suite/data/
```

This directory contains the SQLite database files, one for each server that uses persistence:

```
~/.mcp-suite/data/
├── scrum-board.db          # Scrum board database
├── standup-notes.db        # Standup notes database
├── time-tracking.db        # Time tracking database
├── snippet-manager.db      # Snippets database
├── project-economics.db    # Project economics database
├── retrospective-manager.db # Retrospectives database
└── ...
```

### How it is created

The directory is automatically created on the first startup of a server that uses the database. The code in `@mcp-suite/database`:

```typescript
const DEFAULT_DATA_DIR = join(homedir(), '.mcp-suite', 'data');

export function createDatabase(options: DatabaseOptions): Database.Database {
  const dataDir = options.dataDir || DEFAULT_DATA_DIR;
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = join(dataDir, `${options.serverName}.db`);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return db;
}
```

### Customize the path

```bash
# Global for all servers
export MCP_SUITE_DATA_DIR=/custom/path/data

# Only for a specific server
export MCP_SUITE_SCRUM_BOARD_DATA_DIR=/path/to/scrum-data
```

---

## Log Levels

Logs are written to `stderr` in structured JSON format.

| Level | Numeric Value | Description |
|-------|--------------|-------------|
| `debug` | 0 | Detailed information for debugging |
| `info` | 1 | General execution information (default) |
| `warn` | 2 | Warnings about abnormal situations |
| `error` | 3 | Errors that require attention |

### Log format

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "level": "info",
  "server": "scrum-board",
  "message": "Initializing scrum-board v0.1.0"
}
```

### Filtering logs

When redirecting logs to a file, you can filter them by level with `jq`:

```bash
# Show only errors
node servers/scrum-board/dist/index.js 2>&1 >/dev/null | jq 'select(.level == "error")'

# Show errors and warnings
node servers/scrum-board/dist/index.js 2>&1 >/dev/null | jq 'select(.level == "error" or .level == "warn")'
```

---

## Defaults Summary

| Parameter | Default Value |
|-----------|--------------|
| Transport | `stdio` |
| Port | Not defined (required only for HTTP) |
| Log Level | `info` |
| Data Directory | `~/.mcp-suite/data/` |
| EventBus Type | `local` |
| Redis URL | Not defined |
