# @mcp-suite/database

## Introduction

The `@mcp-suite/database` package provides an abstraction for creating and managing SQLite databases used by MCP Suite servers. It offers two main features: a factory for creating database connections (`createDatabase`) and an incremental migration system (`runMigrations`).

```
packages/database/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts          # Re-export of public modules
    ├── connection.ts     # createDatabase(), DatabaseOptions
    └── migrations.ts     # runMigrations(), Migration
```

**Dependencies:**
- `@mcp-suite/core` - For the error hierarchy and shared types
- `better-sqlite3` - High-performance native synchronous SQLite driver

---

## createDatabase()

The `createDatabase` function is the main factory for creating database connections. It automatically handles directory creation, WAL mode configuration, and foreign key enablement.

### DatabaseOptions Interface

```typescript
export interface DatabaseOptions {
  serverName: string;     // Server name (becomes the .db filename)
  dataDir?: string;       // Custom directory (default: ~/.mcp-suite/data/)
  inMemory?: boolean;     // If true, uses an in-memory database (for tests)
}
```

### Implementation

```typescript
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_DATA_DIR = join(homedir(), '.mcp-suite', 'data');

export function createDatabase(options: DatabaseOptions): Database.Database {
  // In-memory mode for tests
  if (options.inMemory) {
    return new Database(':memory:');
  }

  // Create directory if it doesn't exist
  const dataDir = options.dataDir || DEFAULT_DATA_DIR;
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Create the database with the server name
  const dbPath = join(dataDir, `${options.serverName}.db`);
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Optimal SQLite configuration
  db.pragma('journal_mode = WAL');     // Write-Ahead Logging
  db.pragma('foreign_keys = ON');      // Referential integrity

  return db;
}
```

### Creation Flow

```
createDatabase({ serverName: 'scrum-board' })
        │
        ├── options.inMemory?
        │       └── Yes ──► new Database(':memory:')
        │
        ├── Determine dataDir
        │       └── options.dataDir || ~/.mcp-suite/data/
        │
        ├── Create directory (if it doesn't exist)
        │       └── mkdirSync(dataDir, { recursive: true })
        │
        ├── Build database path
        │       └── ~/.mcp-suite/data/scrum-board.db
        │
        ├── Create SQLite connection
        │       └── new Database(dbPath)
        │
        ├── Configure pragmas
        │       ├── journal_mode = WAL
        │       └── foreign_keys = ON
        │
        └── Return ──► Database.Database
```

---

## Database Directory

### Default Path

The default path is `~/.mcp-suite/data/` which expands to:

| Operating System | Actual Path |
|------------------|-------------|
| **Linux** | `/home/user/.mcp-suite/data/` |
| **macOS** | `/Users/user/.mcp-suite/data/` |
| **Windows** | `C:\Users\user\.mcp-suite\data\` |

### Directory Structure

```
~/.mcp-suite/data/
├── scrum-board.db              # Sprints, stories, tasks
├── scrum-board.db-wal          # WAL file (Write-Ahead Log)
├── scrum-board.db-shm          # Shared memory for WAL
├── standup-notes.db            # Standup notes
├── time-tracking.db            # Time entries
├── snippet-manager.db          # Code snippets
├── project-economics.db        # Budget, costs, economics
├── retrospective-manager.db    # Retrospectives and action items
├── environment-manager.db      # Environment variables
└── ...                         # One file per server with persistence
```

### Path Customization

```bash
# Global (all servers)
export MCP_SUITE_DATA_DIR=/var/data/mcp-suite

# For a single server
export MCP_SUITE_SCRUM_BOARD_DATA_DIR=/var/data/scrum
```

---

## WAL Journal Mode

**Write-Ahead Logging (WAL)** is a SQLite journal mode that offers significant advantages over the default (rollback journal):

```
┌─────────────────────────────────────────────────────┐
│                    WAL Mode                         │
│                                                     │
│  Readers ──► Read from the main file                │
│              (not blocked by writes)                │
│                                                     │
│  Writer ──► Writes to the WAL file                  │
│             (does not block readers)                │
│                                                     │
│  Checkpoint ──► Periodically, the WAL is            │
│                 synchronized to the main file       │
└─────────────────────────────────────────────────────┘
```

**WAL mode advantages:**
- **Concurrent reads**: multiple simultaneous readers without blocking
- **Non-blocking writes**: writes do not block reads
- **Better performance**: fewer I/O operations per transaction
- **Crash recovery**: the WAL file enables recovery after crashes

### Foreign Keys

Enabling foreign keys with `PRAGMA foreign_keys = ON` guarantees referential integrity:

```sql
-- With foreign_keys ON, this operation will fail if the story
-- does not exist in the stories table
INSERT INTO tasks (title, storyId) VALUES ('Bug fix', 999);
-- Error: FOREIGN KEY constraint failed
```

---

## Migration System

The migration system allows servers to evolve their database schema incrementally and safely.

### Migration Interface

```typescript
export interface Migration {
  version: number;        // Progressive migration number
  description: string;    // Human-readable migration description
  up: string;             // SQL to execute to apply the migration
}
```

### runMigrations Function

```typescript
export function runMigrations(db: Database.Database, migrations: Migration[]): void {
  // 1. Create the _migrations table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 2. Read already applied migrations
  const applied = db
    .prepare('SELECT version FROM _migrations ORDER BY version')
    .all() as Array<{ version: number }>;
  const appliedVersions = new Set(applied.map((m) => m.version));

  // 3. Sort migrations by version
  const sorted = [...migrations].sort((a, b) => a.version - b.version);

  // 4. Apply only new migrations
  const insertMigration = db.prepare(
    'INSERT INTO _migrations (version, description) VALUES (?, ?)',
  );

  for (const migration of sorted) {
    if (appliedVersions.has(migration.version)) continue;

    db.exec(migration.up);                                    // Execute SQL
    insertMigration.run(migration.version, migration.description);  // Record
  }
}
```

### Migration Flow

```
runMigrations(db, migrations)
        │
        ├── Create _migrations table (if it doesn't exist)
        │       └── version | description | applied_at
        │
        ├── Read already applied versions
        │       └── SELECT version FROM _migrations
        │
        ├── For each unapplied migration (in order):
        │       ├── Execute SQL (db.exec(migration.up))
        │       └── Record in the _migrations table
        │
        └── Complete (schema updated)
```

---

## How Servers Define Their Schemas

Each server that needs persistence defines its own migrations in the store/service file:

```typescript
// In servers/scrum-board/src/services/scrum-store.ts

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

      CREATE TABLE IF NOT EXISTS stories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        acceptanceCriteria TEXT NOT NULL DEFAULT '[]',
        storyPoints INTEGER NOT NULL DEFAULT 0,
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'todo',
        sprintId INTEGER REFERENCES sprints(id),
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'todo',
        assignee TEXT,
        storyId INTEGER NOT NULL REFERENCES stories(id),
        sprintId INTEGER REFERENCES sprints(id),
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  // Future migration to add columns or indexes:
  // {
  //   version: 2,
  //   description: 'Add tags column to tasks',
  //   up: `ALTER TABLE tasks ADD COLUMN tags TEXT DEFAULT '[]';`,
  // },
];
```

And in the Store constructor:

```typescript
export class ScrumStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    this.db = createDatabase({
      serverName: 'scrum-board',     // => scrum-board.db
      inMemory: options?.inMemory,
      dataDir: options?.dataDir,
    });
    runMigrations(this.db, migrations);  // Apply migrations
  }
}
```

---

## JSON Array Pattern

SQLite does not have a native type for arrays. MCP Suite uses the convention of serializing arrays as JSON strings:

```typescript
// Saving: JSON.stringify
const stmt = db.prepare('INSERT INTO sprints (goals) VALUES (?)');
stmt.run(JSON.stringify(['Goal 1', 'Goal 2']));

// Reading: JSON.parse
function toSprint(row: SprintRow): Sprint {
  return {
    ...row,
    goals: JSON.parse(row.goals) as string[],
  };
}
```

This pattern is used across all servers for fields such as:
- `goals` (sprint) - string array
- `acceptanceCriteria` (story) - string array
- `tags` (snippet, task) - string array

---

## In-Memory Database for Tests

For tests, every store supports in-memory mode which does not create files on disk:

```typescript
import { ScrumStore } from './services/scrum-store.js';

// In a test
const store = new ScrumStore({ inMemory: true });

// The database lives only in RAM
// Migrations are applied normally
// At the end of the test, the database is automatically destroyed
```

This approach guarantees:
- **Isolation**: each test has its own database
- **Speed**: no disk I/O operations
- **Automatic cleanup**: the database disappears when the object is garbage collected
