# Il Pattern Server

## Introduzione

Ogni server MCP nella suite segue un **pattern architetturale rigoroso** a 4 strati. Questo pattern garantisce uniformita, manutenibilita e testabilita in tutti i 22 server. In questa sezione analizziamo ogni strato in dettaglio con esempi di codice reali tratti dal codebase.

---

## Anatomia Completa di un Server

```
servers/scrum-board/
├── package.json              # Dipendenze: core, database, event-bus, sdk, zod
├── tsconfig.json             # Estende ../../tsconfig.base.json
└── src/
    ├── index.ts              # 1. ENTRY POINT: bootstrap e avvio
    ├── server.ts             # 2. FACTORY: creazione server e registrazione tool
    ├── collaboration.ts      # 3. COLLABORAZIONE: handler eventi cross-server
    ├── tools/                # 4. TOOLS: un file per ogni tool MCP
    │   ├── create-sprint.ts
    │   ├── get-sprint.ts
    │   ├── create-story.ts
    │   ├── create-task.ts
    │   ├── update-task-status.ts
    │   ├── sprint-board.ts
    │   └── get-backlog.ts
    └── services/             # 5. SERVICES: persistenza e logica di dominio
        └── scrum-store.ts
```

---

## Strato 1: Entry Point (index.ts)

L'entry point e il file piu semplice. Ha tre responsabilita:
1. Creare un'istanza di `LocalEventBus`
2. Chiamare la factory del server
3. Avviare il trasporto

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

**Punti chiave:**
- Lo shebang `#!/usr/bin/env node` permette l'esecuzione diretta come binario
- L'EventBus e creato qui e iniettato nel server (Dependency Injection)
- `startServer()` sceglie automaticamente il trasporto (STDIO o HTTP) in base alla configurazione
- Gli errori fatali terminano il processo con `process.exit(1)`

---

## Strato 2: Factory (server.ts)

La factory e il cuore del server. Crea l'`McpSuiteServer`, istanzia i servizi, registra i tool e configura la collaborazione.

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

  // Registra tutti i tool
  registerCreateSprint(suite.server, store, suite.eventBus);
  registerGetSprint(suite.server, store);
  registerCreateStory(suite.server, store);
  registerCreateTask(suite.server, store);
  registerUpdateTaskStatus(suite.server, store, suite.eventBus);
  registerSprintBoard(suite.server, store);
  registerGetBacklog(suite.server, store);

  // Configura la collaborazione cross-server (solo se EventBus presente)
  if (suite.eventBus) {
    setupCollaborationHandlers(suite.eventBus, store);
  }

  suite.logger.info('All scrum-board tools registered');

  return suite;
}
```

**Punti chiave:**
- `createMcpServer()` e la factory di `@mcp-suite/core` che restituisce `McpSuiteServer`
- Lo store viene creato una sola volta e condiviso tra tutti i tool
- L'`eventBus` e opzionale (parametro `?`): il server funziona anche senza
- La collaborazione viene attivata solo se `suite.eventBus` esiste

---

## La Factory createMcpServer

Definita in `@mcp-suite/core`, questa funzione standardizza la creazione di tutti i server:

```typescript
export interface CreateServerOptions {
  name: string;
  version: string;
  description?: string;
  config?: Partial<ServerConfig>;
  eventBus?: EventBus;
}

export interface McpSuiteServer {
  server: McpServer;      // Istanza MCP server dall'SDK ufficiale
  config: ServerConfig;   // Configurazione caricata e validata
  logger: Logger;         // Logger strutturato su stderr
  eventBus?: EventBus;    // EventBus opzionale
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

Il flusso interno:
1. Carica la configurazione da variabili d'ambiente (`loadConfig`)
2. Crea il logger con il livello configurato
3. Istanzia il `McpServer` dall'SDK ufficiale
4. Restituisce il bundle completo `McpSuiteServer`

---

## Strato 3: Tool Registration

Ogni tool e un file separato che esporta una funzione `registerXxx`. Questa funzione riceve il `McpServer`, lo store e opzionalmente l'`EventBus`.

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
    'create-sprint',                                       // Nome del tool
    'Create a new sprint with a name, date range, and goals',  // Descrizione
    {                                                       // Schema parametri (Zod)
      name: z.string().describe('Sprint name (e.g. "Sprint 12")'),
      startDate: z.string().describe('Start date in ISO format (YYYY-MM-DD)'),
      endDate: z.string().describe('End date in ISO format (YYYY-MM-DD)'),
      goals: z.array(z.string()).describe('Sprint goals'),
    },
    async ({ name, startDate, endDate, goals }) => {       // Handler
      try {
        const sprint = store.createSprint({ name, startDate, endDate, goals });

        // Pubblicazione evento fire-and-forget
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

**Pattern della registrazione tool:**

| Elemento | Descrizione |
|----------|-------------|
| Nome tool | Stringa univoca nel server (es. `'create-sprint'`) |
| Descrizione | Testo leggibile dall'LLM per capire cosa fa il tool |
| Schema Zod | Validazione e documentazione dei parametri di input |
| Handler async | Funzione che esegue la logica e restituisce il risultato |
| EventBus | Parametro opzionale, usato con `eventBus?.publish(...)` |

**Convenzione di ritorno:**
```typescript
// Successo
return {
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
};

// Errore
return {
  content: [{ type: 'text', text: `Errore: ${messaggio}` }],
  isError: true,
};
```

---

## Strato 4: Services e Store

I servizi contengono la logica di business e la persistenza. Lo Store e la classe principale che gestisce le operazioni sul database SQLite.

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
      -- ... altre tabelle ...
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

  // ... altri metodi CRUD ...
}
```

**Punti chiave dello Store:**
- Usa `createDatabase()` da `@mcp-suite/database` per creare il database
- Le migrazioni sono definite come array di oggetti `Migration`
- Il costruttore supporta `inMemory: true` per i test
- Gli array JSON vengono serializzati con `JSON.stringify` e deserializzati con `JSON.parse`

---

## Collaborazione Cross-Server

Il file `collaboration.ts` configura le sottoscrizioni agli eventi provenienti da altri server:

```typescript
import type { EventBus } from '@mcp-suite/core';
import type { ScrumStore } from './services/scrum-store.js';

export function setupCollaborationHandlers(eventBus: EventBus, _store: ScrumStore): void {
  // Quando una retrospettiva crea un action item, lo scrum-board ne prende nota
  eventBus.subscribe('retro:action-item-created', (payload) => {
    // Futuro: creare automaticamente un task dall'action item
    void payload;
  });
}
```

**Pattern della collaborazione:**
- La funzione `setupCollaborationHandlers` viene chiamata solo se l'EventBus esiste
- Riceve l'EventBus e lo store per poter reagire agli eventi
- Usa `eventBus.subscribe()` per ascoltare eventi specifici
- Usa `eventBus.subscribePattern()` per ascoltare gruppi di eventi (es. `'scrum:*'`)

---

## Come l'EventBus Viene Iniettato

Il flusso di iniezione dell'EventBus e il seguente:

```
index.ts                    server.ts                        tools/xxx.ts
────────                    ─────────                        ────────────

const eventBus =            function createXxxServer(         function registerXxx(
  new LocalEventBus();        eventBus?: EventBus             server, store,
                            ) {                                eventBus?: EventBus
const suite =                 const suite = createMcpServer({ ) {
  createXxxServer(              eventBus,                       // uso:
    eventBus                  });                                eventBus?.publish(...)
  );                                                           }
                              registerXxx(
                                suite.server,
                                store,
                                suite.eventBus    // <-- passato ai tool
                              );
                            }
```

Il pattern e:
1. `index.ts` crea il `LocalEventBus`
2. Lo passa alla factory del server come parametro opzionale
3. La factory lo include nell'oggetto `McpSuiteServer`
4. Lo passa alle funzioni di registrazione dei tool che ne hanno bisogno
5. I tool lo usano con l'operatore optional chaining: `eventBus?.publish(...)`

Questo design **fire-and-forget** significa che:
- Se l'EventBus non esiste, la chiamata `eventBus?.publish(...)` non fa nulla
- Se l'EventBus esiste ma nessuno e in ascolto, l'evento viene ignorato
- Il tool non attende mai la risposta dell'evento: pubblica e prosegue

---

## Riepilogo del Pattern

```
┌──────────────────────────────────────────────────────────┐
│                      index.ts                            │
│  Crea EventBus → Chiama factory → Avvia server           │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│                      server.ts                           │
│  createMcpServer() → Crea Store → Registra Tool          │
│  → Setup Collaborazione                                  │
└──────────┬──────────────────────────┬────────────────────┘
           │                          │
           ▼                          ▼
┌────────────────────┐   ┌─────────────────────────────────┐
│     tools/         │   │          services/               │
│  registerXxx()     │   │  Store con SQLite + Migrazioni   │
│  Schema Zod        │   │  Logica di dominio               │
│  Handler async     │   │  CRUD operations                 │
│  EventBus publish  │   │                                  │
└────────────────────┘   └─────────────────────────────────┘
```
