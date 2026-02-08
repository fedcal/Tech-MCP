# Client Manager Wiring: Chiamate Sincrone tra Server

## Panoramica

Il **Client Manager Wiring** e il meccanismo che permette a un server MCP di **chiamare tool su un altro server** in modo sincrono (request/response). A differenza dell'EventBus, che gestisce notifiche asincrone fire-and-forget, il Client Manager Wiring e progettato per scenari in cui un server ha bisogno di **dati provenienti da un altro server** per completare la propria operazione.

```
Server Chiamante                  Client Manager                  Server Target
      |                                |                               |
      |-- callTool('target', 'tool') ->|                               |
      |                                |-- MCP JSON-RPC request ------>|
      |                                |                               |
      |                                |<--- MCP JSON-RPC response ----|
      |<-- risultato ------------------|                               |
      |                                                                |
      |   (sincrono: il chiamante                                      |
      |    attende il risultato)                                       |
```

---

## EventBus vs Client Manager: Quando Usare Cosa

| Caratteristica | EventBus (Pub/Sub) | Client Manager (RPC) |
|---------------|-------------------|---------------------|
| **Comunicazione** | Asincrona, fire-and-forget | Sincrona, request/response |
| **Direzione** | Uno-a-molti (broadcast) | Uno-a-uno (chiamata diretta) |
| **Accoppiamento** | Nessuno (publisher ignora i subscriber) | Basso (il chiamante conosce il target) |
| **Uso tipico** | Notifiche, aggiornamenti automatici | Query dati, arricchimento risultati |
| **Errori** | Ignorati (non impattano il publisher) | Gestiti con graceful degradation |
| **Esempio** | "Sprint creato" -> aggiorna metriche | "Dammi i dati sprint" -> calcola velocity |

**Regola pratica**: usa l'EventBus quando vuoi **notificare** altri server, usa il Client Manager quando hai **bisogno di dati** da un altro server.

---

## I 6 Scenari di Wiring

MCP Suite implementa 6 scenari di comunicazione cross-server che coinvolgono 5 server chiamanti e 3 server target:

```
                    ┌──────────────────┐
                    │   scrum-board    │
                    │  (target)        │
                    └───▲──────────▲───┘
                        |          |
         get-sprint     |          |  sprint-board
         (sprintIds)    |          |  (includeSprintData)
                        |          |
┌───────────────────┐   |    ┌─────┴────────────────┐
│  agile-metrics    │───┘    │    standup-notes     │
│  (chiamante x2)   │        │     (chiamante)      │
└───────┬───────────┘        └──────────────────────┘
        |
        | get-timesheet
        | (fetchTimeData)
        |
        ▼
┌──────────────────┐
│  time-tracking   │◄──────── project-economics
│  (target x2)     │          (includeTimeData)
└──────────────────┘

┌──────────────────┐          ┌──────────────────────┐
│  db-schema-      │◄──────── │ data-mock-generator  │
│  explorer        │          │ (dbPath)             │
│  (target)        │          └──────────────────────┘
└──────────────────┘

┌──────────────────┐          ┌──────────────────────┐
│  codebase-       │◄──────── │    test-generator    │
│  knowledge       │          │     (filePath)       │
│  (target)        │          └──────────────────────┘
└──────────────────┘
```

### Tabella Riassuntiva

| # | Chiamante | Target | Tool Target | Parametro Trigger | Scopo |
|---|-----------|--------|-------------|-------------------|-------|
| 1 | agile-metrics | scrum-board | `get-sprint` | `sprintIds` | Calcolo velocity con dati sprint reali |
| 2 | agile-metrics | time-tracking | `get-timesheet` | `fetchTimeData` | Arricchimento cycle-time con ore tracciate |
| 3 | project-economics | time-tracking | `get-timesheet` | `includeTimeData` | Calcolo costo lavoro da timesheet |
| 4 | data-mock-generator | db-schema-explorer | `explore-schema` | `dbPath` | Generazione mock da schema DB reale |
| 5 | test-generator | codebase-knowledge | `explain-module` | `filePath` | Generazione test da analisi modulo |
| 6 | standup-notes | scrum-board | `sprint-board` | `includeSprintData` | Report di stato con dati sprint |

---

## Dettaglio dei 6 Scenari

### 1. agile-metrics -> scrum-board (`calculate-velocity`)

Il tool `calculate-velocity` puo ricevere un array `sprintIds`. Se fornito e il Client Manager e disponibile, chiama `get-sprint` su scrum-board per ciascun ID e calcola la velocity basandosi sui task completati.

```typescript
// Chiamata del tool con wiring
await callTool('calculate-velocity', {
  sprintIds: [1, 2, 3],
  // sprints non serve piu: i dati vengono dal server target
});
```

**Risultato arricchito**: il campo `sprints` contiene `completedPoints` e `totalPoints` calcolati dai task reali presenti nello sprint di scrum-board.

### 2. agile-metrics -> time-tracking (`calculate-cycle-time`)

Quando `fetchTimeData: true` e fornito insieme a un `dateRange`, il tool chiama `get-timesheet` su time-tracking e aggiunge al risultato un campo `timeTracking`:

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

Il tool `forecast-budget` puo includere un'analisi del costo lavoro basata sulle ore reali. Con `includeTimeData: true` e un `hourlyRate`, chiama `get-timesheet` e calcola:

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

Invece di definire lo schema manualmente, si puo passare un `dbPath` a un database SQLite. Il tool chiama `explore-schema` su db-schema-explorer, mappa le colonne SQL ai generatori di dati mock e produce righe coerenti con lo schema reale:

```typescript
const result = await callTool('generate-mock-data', {
  dbPath: '/path/to/database.db',
  tableName: 'users',
  count: 100,
});
// Genera 100 righe con le colonne della tabella 'users'
// Le colonne primary key auto-increment vengono escluse
```

**Mapping SQL -> Generator**: il tool usa euristiche basate sui nomi delle colonne (`email` -> generatore email, `phone` -> generatore phone) e sul tipo SQL come fallback (`INTEGER` -> integer, `BOOLEAN` -> boolean).

### 5. test-generator -> codebase-knowledge (`generate-unit-tests`)

Il tool `generate-unit-tests` accetta un `filePath` come alternativa al parametro `code`. Se fornito, chiama `explain-module` su codebase-knowledge per analizzare il file, estrarre le funzioni esportate e generare test scheletro per ciascuna:

```typescript
const result = await callTool('generate-unit-tests', {
  filePath: '/path/to/module.ts',
  framework: 'vitest',
});
// Genera test scheletro basati sulle funzioni trovate nel file
```

### 6. standup-notes -> scrum-board (`generate-status-report`)

Con `includeSprintData: true`, il report di stato viene arricchito con dati in tempo reale dallo sprint board:

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

## Pattern di Implementazione

### Struttura nel Server Chiamante

```typescript
// 1. server.ts - Accetta e propaga il clientManager
export function createMyServer(options?: {
  eventBus?: EventBus;
  clientManager?: McpClientManager;  // <-- opzionale
  storeOptions?: { inMemory?: boolean };
}): McpSuiteServer {
  const suite = createMcpServer({ ... });
  const store = new MyStore(...);

  // Passa clientManager ai tool che ne hanno bisogno
  registerMyTool(suite.server, store, options?.clientManager);

  return suite;
}

// 2. tools/my-tool.ts - Usa clientManager se disponibile
export function registerMyTool(
  server: McpServer,
  store: MyStore,
  clientManager?: McpClientManager,  // <-- opzionale
): void {
  server.tool('my-tool', 'description', {
    // Parametri normali...
    enrichFromExternal: z.boolean().optional(),  // <-- trigger
  }, async ({ enrichFromExternal }) => {
    let enrichment = undefined;

    // Wiring: solo se richiesto E clientManager disponibile
    if (enrichFromExternal && clientManager) {
      const result = await clientManager.callTool(
        'target-server',
        'target-tool',
        { /* args */ },
      );
      const content = (result as { content: Array<{ type: string; text: string }> }).content;
      enrichment = JSON.parse(content[0].text);
    }

    // Risultato base + eventuale arricchimento
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ ...baseResult, enrichment }),
      }],
    };
  });
}

// 3. index.ts - Crea e configura il clientManager
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

Il principio fondamentale del wiring e la **graceful degradation**: ogni tool funziona perfettamente anche senza Client Manager. Il wiring arricchisce il risultato, ma non e mai obbligatorio.

```typescript
// Il pattern if (param && clientManager) garantisce:
// 1. Senza clientManager: il tool funziona normalmente
// 2. Senza il parametro trigger: il wiring non viene attivato
// 3. Con entrambi: il risultato viene arricchito con dati esterni
if (enrichFromExternal && clientManager) {
  // cross-server call
}
```

---

## Testing del Wiring

I test di integrazione per il wiring usano `InMemoryTransport` per connettere i server in-process senza rete:

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
    // 1. Creare il server target in-memory
    const targetSuite = createTargetServer({ storeOptions: { inMemory: true } });

    // 2. Creare una coppia di transport collegati
    clientManager = new McpClientManager();
    const [clientTransport, serverTransport] = McpClientManager.createInMemoryPair();

    // 3. Connettere: PRIMA il server, POI il client
    await targetSuite.server.connect(serverTransport);
    await clientManager.connectInMemoryWithTransport('target', clientTransport);

    // 4. Popolare dati nel server target (se necessario)
    await clientManager.callTool('target', 'create-item', { name: 'Test' });

    // 5. Creare il server chiamante con il clientManager
    const callerSuite = createCallerServer({
      clientManager,
      storeOptions: { inMemory: true },
    });
    callerHarness = await createTestHarness(callerSuite.server);

    // 6. Chiamare il tool con il parametro di wiring
    const result = await callerHarness.client.callTool({
      name: 'enriched-tool',
      arguments: { enrichFromExternal: true },
    });

    // 7. Verificare il risultato arricchito
    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0].text);
    expect(data.enrichment).toBeDefined();
  });
});
```

**Nota importante**: con `InMemoryTransport`, il server DEVE connettersi al suo transport PRIMA che il client si connetta al proprio. Il client invia immediatamente il messaggio `initialize` al momento della connessione.

---

## Porte HTTP dei Server Target

Quando i server comunicano via HTTP (deployment di produzione), ogni server ascolta su una porta dedicata. I server target usati nel wiring:

| Server Target | Porta Default | Variabile d'Ambiente |
|--------------|---------------|---------------------|
| scrum-board | 3018 | `MCP_SUITE_SCRUM_BOARD_URL` |
| time-tracking | 3022 | `MCP_SUITE_TIME_TRACKING_URL` |
| db-schema-explorer | 3007 | `MCP_SUITE_DB_SCHEMA_EXPLORER_URL` |
| codebase-knowledge | 3005 | `MCP_SUITE_CODEBASE_KNOWLEDGE_URL` |

Le URL sono configurabili tramite variabili d'ambiente; il default e `http://localhost:<porta>/mcp`.
