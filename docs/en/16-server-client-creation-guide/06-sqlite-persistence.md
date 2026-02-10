# Persistence with SQLite

## Introduction

The minimal server uses an in-memory `Map`: data is lost on restart. For a professional server you need persistence. SQLite is the ideal choice: zero configuration, embedded in the process, performant for single-writer workloads.

---

## Why SQLite

| Aspect | SQLite | PostgreSQL/MySQL | JSON File |
|--------|--------|------------------|-----------|
| **Setup** | Zero (embedded) | Separate server | Zero |
| **Deployment** | Single file | Infrastructure | Single file |
| **Concurrency** | One writer, N readers | Multi-writer | No concurrency |
| **Queries** | Full SQL | Full SQL | None |
| **Performance** | Excellent for MCP | Overkill for MCP | Slow on large data |
| **Transactions** | Full ACID | Full ACID | None |

For an MCP server, SQLite is the sweet spot: powerful enough for complex queries, simple enough to not require additional infrastructure.

---

## Setup

```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

`better-sqlite3` is a synchronous native binding. Unlike `sqlite3` (asynchronous, callback-based), `better-sqlite3` is faster and has a simpler API.

---

## Store Pattern

Separate the persistence logic from the MCP server in a **Store** class:

```
src/
  index.ts            # Entry point and transport
  server.ts           # MCP server factory
  services/
    notes-store.ts    # SQLite persistence
  tools/
    add-note.ts       # Tool registration
    list-notes.ts
    search-notes.ts
```

### Store: `src/services/notes-store.ts`

```typescript
import Database from "better-sqlite3";

// Public data interface
export interface Note {
  id: number;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// SQLite row interface (serialized JSON)
interface NoteRow {
  id: number;
  title: string;
  content: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
}

export class NotesStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    // :memory: for tests, file for production
    this.db = new Database(dbPath ?? ":memory:");

    // Enable WAL mode for better read performance
    this.db.pragma("journal_mode = WAL");

    // Run migrations
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title);
    `);
  }

  // --- CRUD Methods ---

  addNote(input: { title: string; content: string; tags?: string[] }): Note {
    const stmt = this.db.prepare(`
      INSERT INTO notes (title, content, tags)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(
      input.title,
      input.content,
      JSON.stringify(input.tags ?? []),
    );
    return this.getNote(result.lastInsertRowid as number)!;
  }

  getNote(id: number): Note | undefined {
    const row = this.db.prepare("SELECT * FROM notes WHERE id = ?").get(id) as NoteRow | undefined;
    return row ? this.rowToNote(row) : undefined;
  }

  getNoteByTitle(title: string): Note | undefined {
    const row = this.db.prepare("SELECT * FROM notes WHERE title = ?").get(title) as NoteRow | undefined;
    return row ? this.rowToNote(row) : undefined;
  }

  listNotes(limit = 50): Note[] {
    const rows = this.db.prepare(
      "SELECT * FROM notes ORDER BY updatedAt DESC LIMIT ?",
    ).all(limit) as NoteRow[];
    return rows.map((row) => this.rowToNote(row));
  }

  updateNote(id: number, updates: { content?: string; tags?: string[] }): Note | undefined {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (updates.content !== undefined) {
      sets.push("content = ?");
      values.push(updates.content);
    }
    if (updates.tags !== undefined) {
      sets.push("tags = ?");
      values.push(JSON.stringify(updates.tags));
    }

    if (sets.length === 0) return this.getNote(id);

    sets.push("updatedAt = datetime('now')");
    values.push(id);

    this.db.prepare(
      `UPDATE notes SET ${sets.join(", ")} WHERE id = ?`,
    ).run(...values);

    return this.getNote(id);
  }

  deleteNote(id: number): boolean {
    const result = this.db.prepare("DELETE FROM notes WHERE id = ?").run(id);
    return result.changes > 0;
  }

  searchNotes(query: string): Note[] {
    const rows = this.db.prepare(
      "SELECT * FROM notes WHERE title LIKE ? OR content LIKE ? ORDER BY updatedAt DESC",
    ).all(`%${query}%`, `%${query}%`) as NoteRow[];
    return rows.map((row) => this.rowToNote(row));
  }

  // Converts a SQLite row to the public interface
  private rowToNote(row: NoteRow): Note {
    return {
      ...row,
      tags: JSON.parse(row.tags) as string[],
    };
  }
}
```

### Key Points of the Store Pattern

**1. Row/interface separation**: SQLite does not support native arrays, so `tags` is serialized as JSON. The class exposes the `Note` interface with `tags: string[]` and handles the conversion internally.

**2. Constructor with optional path**: `":memory:"` for tests, file path for production.

**3. WAL mode**: `PRAGMA journal_mode = WAL` allows concurrent reads during writes, improving performance.

**4. Migrations in the constructor**: for a simple server, `CREATE TABLE IF NOT EXISTS` is sufficient. For evolving servers, a versioned migration system is needed (see below).

---

## Versioned Migration System

As the server evolves, tables change. A migration system manages these evolutions:

```typescript
interface Migration {
  version: number;
  description: string;
  up: string;  // SQL to execute
}

const migrations: Migration[] = [
  {
    version: 1,
    description: "Create notes table",
    up: `
      CREATE TABLE notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_notes_title ON notes(title);
    `,
  },
  {
    version: 2,
    description: "Add category column and categories table",
    up: `
      ALTER TABLE notes ADD COLUMN category TEXT;
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT DEFAULT '#666666',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_notes_category ON notes(category);
    `,
  },
];

function runMigrations(db: Database.Database, migrations: Migration[]): void {
  // Create migration tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      appliedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Find the last applied version
  const lastVersion = (
    db.prepare("SELECT MAX(version) as v FROM _migrations").get() as { v: number | null }
  ).v ?? 0;

  // Apply pending migrations in a transaction
  const applyMigration = db.transaction((migration: Migration) => {
    db.exec(migration.up);
    db.prepare("INSERT INTO _migrations (version, description) VALUES (?, ?)").run(
      migration.version,
      migration.description,
    );
  });

  for (const migration of migrations) {
    if (migration.version > lastVersion) {
      applyMigration(migration);
    }
  }
}
```

### Usage in the Constructor

```typescript
export class NotesStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    const dbPath = options?.inMemory
      ? ":memory:"
      : `${options?.dataDir ?? "./data"}/notes.db`;

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    runMigrations(this.db, migrations);
  }
}
```

Every time you add a feature that requires new tables or columns, add a new migration with an incremental `version`. Already applied migrations are skipped.

---

## Tools That Use the Store

Separate tools into dedicated files:

### `src/tools/add-note.ts`

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { NotesStore } from "../services/notes-store.js";

export function registerAddNote(server: McpServer, store: NotesStore): void {
  server.tool(
    "add-note",
    "Adds a new note with title, content, and optional tags",
    {
      title: z.string().min(1).describe("Note title"),
      content: z.string().min(1).describe("Note content"),
      tags: z.array(z.string()).optional().describe("Tags to categorize the note"),
    },
    async ({ title, content, tags }) => {
      try {
        const note = store.addNote({ title, content, tags });
        return {
          content: [{
            type: "text",
            text: JSON.stringify(note, null, 2),
          }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        // UNIQUE constraint -> note already exists
        if (msg.includes("UNIQUE constraint")) {
          return {
            content: [{ type: "text", text: `A note with title "${title}" already exists.` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: `Error: ${msg}` }],
          isError: true,
        };
      }
    },
  );
}
```

### `src/tools/search-notes.ts`

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { NotesStore } from "../services/notes-store.js";

export function registerSearchNotes(server: McpServer, store: NotesStore): void {
  server.tool(
    "search-notes",
    "Search notes by keyword in title or content",
    {
      query: z.string().min(2).describe("Text to search for"),
    },
    async ({ query }) => {
      const results = store.searchNotes(query);
      if (results.length === 0) {
        return {
          content: [{ type: "text", text: `No results for "${query}".` }],
        };
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify(results, null, 2),
        }],
      };
    },
  );
}
```

---

## Server Factory

The server factory assembles everything:

### `src/server.ts`

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NotesStore } from "./services/notes-store.js";
import { registerAddNote } from "./tools/add-note.js";
import { registerSearchNotes } from "./tools/search-notes.js";

export interface ServerOptions {
  storeOptions?: { inMemory?: boolean; dataDir?: string };
}

export function createNotesServer(options?: ServerOptions) {
  const server = new McpServer({
    name: "notes-server",
    version: "1.0.0",
  });

  const store = new NotesStore(options?.storeOptions);

  registerAddNote(server, store);
  registerSearchNotes(server, store);
  // ... other tools ...

  return { server, store };
}
```

### `src/index.ts`

```typescript
#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createNotesServer } from "./server.js";

const { server } = createNotesServer({
  storeOptions: { dataDir: "./data" },
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Notes server started with SQLite persistence");
```

---

## Testing the Store

The store is easily testable because it accepts `inMemory: true`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { NotesStore } from "../src/services/notes-store.js";

describe("NotesStore", () => {
  let store: NotesStore;

  beforeEach(() => {
    store = new NotesStore({ inMemory: true });
  });

  it("should add and retrieve a note", () => {
    const note = store.addNote({ title: "Test", content: "Content" });
    expect(note.id).toBe(1);
    expect(note.title).toBe("Test");

    const retrieved = store.getNote(1);
    expect(retrieved).toEqual(note);
  });

  it("should search notes by content", () => {
    store.addNote({ title: "JavaScript", content: "Arrow functions and promises" });
    store.addNote({ title: "TypeScript", content: "Types and interfaces" });

    const results = store.searchNotes("functions");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("JavaScript");
  });

  it("should handle tags as arrays", () => {
    const note = store.addNote({
      title: "Tagged",
      content: "Content",
      tags: ["js", "web"],
    });
    expect(note.tags).toEqual(["js", "web"]);
  });
});
```

---

## Summary

In this chapter you learned:

1. Why SQLite is the ideal choice for MCP servers
2. The Store pattern for separating persistence from server logic
3. How to handle JSON serialization for complex types (arrays, objects)
4. The versioned migration system for schema evolution
5. The professional folder structure: server.ts, services/, tools/
6. How to test the store with an in-memory database

**Next**: [Event-Driven Architecture](./07-event-driven.md)
