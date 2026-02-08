# Persistenza con SQLite

## Introduzione

Il server minimo usa una `Map` in memoria: i dati si perdono al riavvio. Per un server professionale serve persistenza. SQLite e' la scelta ideale: zero configurazione, embedded nel processo, performante per workload single-writer.

---

## Perche' SQLite

| Aspetto | SQLite | PostgreSQL/MySQL | File JSON |
|---------|--------|------------------|-----------|
| **Setup** | Zero (embedded) | Server separato | Zero |
| **Deployment** | Singolo file | Infrastruttura | Singolo file |
| **Concorrenza** | Un writer, N reader | Multi-writer | No concorrenza |
| **Query** | SQL completo | SQL completo | Nessuna |
| **Performance** | Eccellente per MCP | Overkill per MCP | Lenta su grandi dati |
| **Transazioni** | ACID completo | ACID completo | Nessuna |

Per un server MCP, SQLite e' il punto ideale: abbastanza potente per query complesse, abbastanza semplice da non richiedere infrastruttura aggiuntiva.

---

## Setup

```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

`better-sqlite3` e' un binding nativo sincrono. A differenza di `sqlite3` (asincrono basato su callback), `better-sqlite3` e' piu' veloce e ha un'API piu' semplice.

---

## Pattern Store

Separa la logica di persistenza dal server MCP in una classe **Store**:

```
src/
  index.ts            # Entry point e transport
  server.ts           # Factory del server MCP
  services/
    notes-store.ts    # Persistenza SQLite
  tools/
    add-note.ts       # Registrazione tool
    list-notes.ts
    search-notes.ts
```

### Store: `src/services/notes-store.ts`

```typescript
import Database from "better-sqlite3";

// Interfaccia pubblica del dato
export interface Note {
  id: number;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// Interfaccia riga SQLite (JSON serializzato)
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
    // :memory: per i test, file per produzione
    this.db = new Database(dbPath ?? ":memory:");

    // Abilita WAL mode per migliori performance di lettura
    this.db.pragma("journal_mode = WAL");

    // Esegui le migrazioni
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

  // --- Metodi CRUD ---

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

  // Converte una riga SQLite nell'interfaccia pubblica
  private rowToNote(row: NoteRow): Note {
    return {
      ...row,
      tags: JSON.parse(row.tags) as string[],
    };
  }
}
```

### Punti Chiave del Pattern Store

**1. Separazione riga/interfaccia**: SQLite non supporta array nativi, quindi `tags` e' serializzato come JSON. La classe espone l'interfaccia `Note` con `tags: string[]` e gestisce la conversione internamente.

**2. Constructor con path opzionale**: `":memory:"` per i test, percorso file per produzione.

**3. WAL mode**: `PRAGMA journal_mode = WAL` permette letture concorrenti durante la scrittura, migliorando le performance.

**4. Migrazioni nel constructor**: per un server semplice, `CREATE TABLE IF NOT EXISTS` basta. Per server in evoluzione, serve un sistema di migrazioni versionato (vedi sotto).

---

## Sistema di Migrazioni Versionato

Quando il server evolve, le tabelle cambiano. Un sistema di migrazioni gestisce queste evoluzioni:

```typescript
interface Migration {
  version: number;
  description: string;
  up: string;  // SQL da eseguire
}

const migrations: Migration[] = [
  {
    version: 1,
    description: "Crea tabella notes",
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
    description: "Aggiunge colonna categoria e tabella categorie",
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
  // Crea tabella di tracking migrazioni
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      appliedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Trova l'ultima versione applicata
  const lastVersion = (
    db.prepare("SELECT MAX(version) as v FROM _migrations").get() as { v: number | null }
  ).v ?? 0;

  // Applica migrazioni pendenti in una transazione
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

### Uso nel Constructor

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

Ogni volta che aggiungi una feature che richiede nuove tabelle o colonne, aggiungi una nuova migrazione con `version` incrementale. Le migrazioni gia' applicate vengono saltate.

---

## Tool che Usano lo Store

Separa i tool in file dedicati:

### `src/tools/add-note.ts`

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { NotesStore } from "../services/notes-store.js";

export function registerAddNote(server: McpServer, store: NotesStore): void {
  server.tool(
    "add-note",
    "Aggiunge una nuova nota con titolo, contenuto e tag opzionali",
    {
      title: z.string().min(1).describe("Titolo della nota"),
      content: z.string().min(1).describe("Contenuto della nota"),
      tags: z.array(z.string()).optional().describe("Tag per categorizzare la nota"),
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
        // UNIQUE constraint -> nota gia' esistente
        if (msg.includes("UNIQUE constraint")) {
          return {
            content: [{ type: "text", text: `Una nota con titolo "${title}" esiste gia'.` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: `Errore: ${msg}` }],
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
    "Cerca note per parola chiave nel titolo o contenuto",
    {
      query: z.string().min(2).describe("Testo da cercare"),
    },
    async ({ query }) => {
      const results = store.searchNotes(query);
      if (results.length === 0) {
        return {
          content: [{ type: "text", text: `Nessun risultato per "${query}".` }],
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

Il server factory assembla tutto:

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
  // ... altri tool ...

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
console.error("Notes server avviato con persistenza SQLite");
```

---

## Test dello Store

Lo store e' facilmente testabile perche' accetta `inMemory: true`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { NotesStore } from "../src/services/notes-store.js";

describe("NotesStore", () => {
  let store: NotesStore;

  beforeEach(() => {
    store = new NotesStore({ inMemory: true });
  });

  it("should add and retrieve a note", () => {
    const note = store.addNote({ title: "Test", content: "Contenuto" });
    expect(note.id).toBe(1);
    expect(note.title).toBe("Test");

    const retrieved = store.getNote(1);
    expect(retrieved).toEqual(note);
  });

  it("should search notes by content", () => {
    store.addNote({ title: "JavaScript", content: "Arrow functions e promises" });
    store.addNote({ title: "TypeScript", content: "Tipi e interfacce" });

    const results = store.searchNotes("functions");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("JavaScript");
  });

  it("should handle tags as arrays", () => {
    const note = store.addNote({
      title: "Tagged",
      content: "Contenuto",
      tags: ["js", "web"],
    });
    expect(note.tags).toEqual(["js", "web"]);
  });
});
```

---

## Riepilogo

In questo capitolo hai imparato:

1. Perche' SQLite e' la scelta ideale per server MCP
2. Il pattern Store per separare persistenza dalla logica server
3. Come gestire serializzazione JSON per tipi complessi (array, oggetti)
4. Il sistema di migrazioni versionato per evoluzioni dello schema
5. La struttura a cartelle professionale: server.ts, services/, tools/
6. Come testare lo store con database in-memory

**Prossimo**: [Event-Driven Architecture](./07-event-driven.md)
