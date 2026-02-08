# Best Practice e Produzione

## Introduzione

Hai costruito un server MCP completo: tool, risorse, persistenza, eventi, comunicazione cross-server e test. In questo capitolo finale trovi le best practice per portarlo in produzione e i pattern architetturali per scalare.

---

## Struttura Progetto Definitiva

Un server MCP professionale segue questa organizzazione:

```
my-server/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts                  # Entry point (transport setup)
    server.ts                 # Factory function
    collaboration.ts          # Event handlers (opzionale)
    tools/
      add-item.ts             # Un file per tool
      get-stats.ts
      search.ts
    services/
      my-store.ts             # Store SQLite
  tests/
    services/
      my-store.test.ts        # Unit test store
    tools/
      add-item.test.ts        # Integration test tool
      get-stats-wiring.test.ts  # Wiring test cross-server
```

### Principi

- **Un file per tool**: ogni tool in un file separato, registrato come funzione pura
- **Store isolato**: tutta la logica di persistenza in `services/`, testabile senza MCP
- **Factory function**: `createMyServer(options?)` come unico punto di creazione
- **Collaboration separata**: event handler in `collaboration.ts`, attivati solo se `eventBus` presente
- **Entry point minimale**: `index.ts` crea transport e avvia, niente logica business

---

## Pattern della Server Factory

La factory e' il cuore del server. Accetta parametri opzionali per massima flessibilita':

```typescript
// server.ts

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EventBus } from "@mcp-suite/event-bus";
import type { McpClientManager } from "@mcp-suite/client-manager";
import { MyStore } from "./services/my-store.js";
import { registerAddItem } from "./tools/add-item.js";
import { registerGetStats } from "./tools/get-stats.js";
import { setupCollaborationHandlers } from "./collaboration.js";

export function createMyServer(options?: {
  eventBus?: EventBus;
  clientManager?: McpClientManager;
  storeOptions?: { inMemory?: boolean; dbPath?: string };
}) {
  const server = new McpServer({
    name: "my-server",
    version: "1.0.0",
  });

  const store = new MyStore(options?.storeOptions);

  // Registra i tool, passando dipendenze opzionali
  registerAddItem(server, store, options?.eventBus);
  registerGetStats(server, store, options?.clientManager);

  // Collaboration: attiva solo se c'e' un event bus
  if (options?.eventBus) {
    setupCollaborationHandlers(options.eventBus, store);
  }

  return { server, store };
}
```

### Vantaggi

- **Test facili**: `createMyServer({ storeOptions: { inMemory: true } })` per test isolati
- **Composizione flessibile**: eventBus e clientManager opzionali
- **Nessun singleton**: ogni chiamata crea un'istanza indipendente
- **Store accessibile**: ritornato per test diretti o seed di dati

---

## Logging

MCP su STDIO usa stdout per i messaggi JSON-RPC. Il logging DEVE usare stderr:

```typescript
// CORRETTO: log su stderr
console.error("[INFO] Server avviato sulla porta 3000");
console.error("[ERROR] Connessione database fallita:", error.message);

// SBAGLIATO: stdout corrompe il protocollo
console.log("Server avviato");  // ROMPE MCP!
```

### Logger Strutturato

Per produzione, usa un logger che scrive su stderr:

```typescript
type LogLevel = "debug" | "info" | "warn" | "error";

function createLogger(name: string, level: LogLevel = "info") {
  const levels: Record<LogLevel, number> = {
    debug: 0, info: 1, warn: 2, error: 3,
  };
  const minLevel = levels[level];

  return {
    debug: (msg: string, data?: unknown) => {
      if (minLevel <= 0) console.error(JSON.stringify({ level: "debug", server: name, msg, data, ts: new Date().toISOString() }));
    },
    info: (msg: string, data?: unknown) => {
      if (minLevel <= 1) console.error(JSON.stringify({ level: "info", server: name, msg, data, ts: new Date().toISOString() }));
    },
    warn: (msg: string, data?: unknown) => {
      if (minLevel <= 2) console.error(JSON.stringify({ level: "warn", server: name, msg, data, ts: new Date().toISOString() }));
    },
    error: (msg: string, data?: unknown) => {
      if (minLevel <= 3) console.error(JSON.stringify({ level: "error", server: name, msg, data, ts: new Date().toISOString() }));
    },
  };
}

const logger = createLogger("my-server");
logger.info("Tool invocato", { tool: "add-item", args: { title: "Test" } });
```

---

## Gestione degli Errori nei Tool

Ogni tool deve catturare le eccezioni e restituire errori nel formato MCP:

```typescript
server.tool(
  "my-tool",
  "Descrizione",
  { param: z.string() },
  async ({ param }) => {
    try {
      const result = store.doSomething(param);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Errore: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  },
);
```

### Regole

- **Mai lanciare eccezioni non gestite**: il tool DEVE sempre ritornare un risultato
- **`isError: true`**: segnala al modello AI che l'operazione e' fallita
- **Messaggio leggibile**: l'AI legge il messaggio di errore per decidere cosa fare
- **No stack trace**: in produzione, non esporre dettagli interni

---

## Validazione con Zod

Zod valida gli argomenti prima che il tool handler venga eseguito. L'SDK MCP gestisce automaticamente gli errori di validazione.

```typescript
import { z } from "zod";

server.tool(
  "create-project",
  "Crea un nuovo progetto",
  {
    name: z.string().min(1).max(100),
    budget: z.number().positive().optional(),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
    tags: z.array(z.string()).max(10).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato: YYYY-MM-DD").optional(),
  },
  async (args) => {
    // args e' gia' validato e tipizzato
    // ...
  },
);
```

### Best Practice Zod

- Usa `.optional()` per parametri non obbligatori, con `.default()` dove ha senso
- Usa `.enum()` per valori fissi, `.regex()` per formati specifici
- Usa `.min()` e `.max()` per limiti sensati
- Documenta i formati nel messaggio di errore regex

---

## Sicurezza

### Input Sanitization

Lo store non deve mai eseguire SQL costruito da stringhe:

```typescript
// CORRETTO: prepared statement
const stmt = this.db.prepare("SELECT * FROM items WHERE title = ?");
const item = stmt.get(title);

// SBAGLIATO: SQL injection
const item = this.db.exec(`SELECT * FROM items WHERE title = '${title}'`);
```

`better-sqlite3` usa prepared statement per default, eliminando il rischio SQL injection.

### Principio del Minimo Privilegio

- Il server espone solo le operazioni necessarie
- I tool di lettura non devono poter scrivere
- Separa tool pericolosi (delete, purge) da tool sicuri (list, get)
- In produzione, considera tool separati per operazioni distruttive

### Autenticazione HTTP

Per server esposti in rete, proteggi l'endpoint:

```typescript
import express from "express";

const app = express();
const API_KEY = process.env.MCP_API_KEY;

app.use("/mcp", (req, res, next) => {
  if (!API_KEY) return next(); // Dev mode
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${API_KEY}`) {
    return res.status(401).json({ error: "Non autorizzato" });
  }
  next();
});
```

### Validazione Origin

Per prevenire attacchi da browser:

```typescript
app.use("/mcp", (req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    // Rifiuta richieste cross-origin non autorizzate
    return res.status(403).json({ error: "Cross-origin non permesso" });
  }
  next();
});
```

---

## Performance SQLite

### WAL Mode

Abilita Write-Ahead Logging per migliori performance in lettura concorrente:

```typescript
constructor(options?: { inMemory?: boolean }) {
  this.db = new Database(options?.inMemory ? ":memory:" : "data/my-server.db");
  this.db.pragma("journal_mode = WAL");
  this.db.pragma("foreign_keys = ON");
  this.migrate();
}
```

### Transazioni per Operazioni Batch

```typescript
addBulkItems(items: NewItem[]): Item[] {
  const insert = this.db.prepare(
    "INSERT INTO items (title, content) VALUES (?, ?)"
  );

  const addMany = this.db.transaction((items: NewItem[]) => {
    return items.map(item => {
      const result = insert.run(item.title, item.content);
      return { id: Number(result.lastInsertRowid), ...item };
    });
  });

  return addMany(items);
}
```

Le transazioni migliorano le performance di ordini di grandezza per inserimenti multipli e garantiscono atomicita'.

### Indici

Aggiungi indici sulle colonne usate nei WHERE e ORDER BY:

```sql
CREATE INDEX IF NOT EXISTS idx_items_created ON items(createdAt);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
```

---

## Configurazione Claude Desktop

Per usare il tuo server con Claude Desktop, aggiungi la configurazione in `claude_desktop_config.json`:

### Server STDIO

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/percorso/al/server/dist/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Server HTTP

```json
{
  "mcpServers": {
    "my-server": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer il-tuo-token"
      }
    }
  }
}
```

### Server con npx

Per server pubblicati su npm:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "@mio-scope/mcp-server-xyz"]
    }
  }
}
```

---

## Monorepo con Workspaces

Per progetti con piu' server MCP, un monorepo semplifica la gestione:

```
mcp-suite/
  package.json              # Workspace root
  pnpm-workspace.yaml       # Definisce i workspace
  turbo.json                # Build orchestrator
  packages/
    core/                   # Tipi condivisi, factory, utility
    event-bus/              # EventBus interface + LocalEventBus
    client-manager/         # McpClientManager
    database/               # BaseStore, migration utils
    testing/                # createTestHarness, MockEventBus
  servers/
    time-tracking/          # Singolo server MCP
    project-economics/
    agile-metrics/
    ...
```

### pnpm-workspace.yaml

```yaml
packages:
  - "packages/*"
  - "servers/*"
```

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    }
  }
}
```

`"dependsOn": ["^build"]` significa: prima builda le dipendenze, poi il package corrente. Turborepo risolve l'ordine automaticamente e parallelizza dove possibile.

---

## Checklist Pre-Produzione

Prima di deployare un server MCP, verifica questi punti:

### Funzionalita'

- [ ] Tutti i tool hanno validazione Zod completa
- [ ] Ogni tool gestisce errori con try/catch e `isError: true`
- [ ] Lo store ha migrazioni versionabili
- [ ] I test coprono happy path e casi di errore

### Sicurezza

- [ ] Nessun `console.log` su stdout (solo `console.error`)
- [ ] Prepared statement per tutte le query SQL
- [ ] Autenticazione su endpoint HTTP esposti
- [ ] Variabili d'ambiente per segreti (no hardcoded)

### Performance

- [ ] WAL mode abilitato su SQLite
- [ ] Indici sulle colonne filtrate frequentemente
- [ ] Transazioni per operazioni batch

### Deployment

- [ ] `package.json` con `"type": "module"` e `"bin"` configurato
- [ ] Build TypeScript produce output in `dist/`
- [ ] Entry point (`index.ts`) gestisce graceful shutdown
- [ ] Configurazione Claude Desktop testata

### Architettura

- [ ] Server factory con parametri opzionali (eventBus, clientManager, storeOptions)
- [ ] Collaboration handler separato e attivato condizionalmente
- [ ] Fire-and-forget per pubblicazione eventi (`eventBus?.publish()`)
- [ ] Graceful degradation per chiamate cross-server

---

## Graceful Shutdown

In produzione, gestisci la chiusura pulita:

```typescript
// index.ts

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMyServer } from "./server.js";

const { server } = createMyServer();
const transport = new StdioServerTransport();

await server.connect(transport);
console.error("[INFO] Server avviato");

// Chiusura pulita
process.on("SIGINT", async () => {
  console.error("[INFO] Chiusura in corso...");
  await server.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.error("[INFO] Terminazione in corso...");
  await server.close();
  process.exit(0);
});
```

---

## Riepilogo della Guida

In questa guida hai imparato a creare un server MCP da zero fino a livello professionale:

| Capitolo | Argomento | Livello |
|----------|-----------|---------|
| 1 | Fondamenti del protocollo | Base |
| 2 | Primo server con tool | Base |
| 3 | Primo client e tool-use cycle | Base |
| 4 | Resources e Prompts | Intermedio |
| 5 | Transport HTTP e deployment | Intermedio |
| 6 | Persistenza SQLite | Intermedio |
| 7 | Architettura event-driven | Avanzato |
| 8 | Comunicazione cross-server | Avanzato |
| 9 | Testing professionale | Avanzato |
| 10 | Best practice e produzione | Produzione |

### Percorso Evolutivo

```
  Livello 1 (Base)
  ─────────────────────────────────
  Tool in-memory + STDIO
  Client singolo + Zod validation

         |
         v

  Livello 2 (Intermedio)
  ─────────────────────────────────
  Resources + Prompts
  HTTP transport + SQLite store
  Migrazioni versionabili

         |
         v

  Livello 3 (Avanzato)
  ─────────────────────────────────
  EventBus (fire-and-forget)
  ClientManager (cross-server)
  Collaboration handlers

         |
         v

  Livello 4 (Produzione)
  ─────────────────────────────────
  Test piramide completa
  Logging strutturato
  Sicurezza + Performance
  Monorepo + CI/CD
```

Ora hai tutti gli strumenti per costruire server MCP professionali. Buon coding!
