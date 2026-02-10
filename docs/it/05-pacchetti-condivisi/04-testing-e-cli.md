# @mcp-suite/testing e @mcp-suite/cli

## Parte 1: @mcp-suite/testing

### Introduzione

Il pacchetto `@mcp-suite/testing` fornisce utility per testare i server MCP Suite in modo isolato, senza richiedere un client reale o una connessione STDIO. Offre due componenti principali: un **test harness** basato su `InMemoryTransport` e un **MockEventBus** per verificare l'emissione di eventi.

```
packages/testing/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts              # Re-export dei moduli pubblici
    ├── test-server.ts        # createTestHarness() e TestHarness
    └── mock-event-bus.ts     # MockEventBus per test sugli eventi
```

**Dipendenze:**
- `@mcp-suite/core` - Tipi e utility condivise
- `@mcp-suite/event-bus` - Interfacce EventBus per il mock
- `@modelcontextprotocol/sdk` - Client e InMemoryTransport

---

### TestHarness: Test In-Process

Il `TestHarness` crea una coppia client-server connessa in memoria, permettendo di testare i tool senza processi esterni.

#### Interfaccia TestHarness

```typescript
export interface TestHarness {
  client: Client;            // Client MCP collegato al server
  close: () => Promise<void>;  // Funzione per chiudere la connessione
}
```

#### createTestHarness()

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export async function createTestHarness(server: McpServer): Promise<TestHarness> {
  // 1. Crea una coppia di trasporti collegati in memoria
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  // 2. Crea un client di test
  const client = new Client({
    name: 'test-client',
    version: '1.0.0',
  });

  // 3. Collega server e client ai rispettivi trasporti
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  // 4. Restituisce il client e una funzione di cleanup
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}
```

#### Diagramma del TestHarness

```
┌───────────────────────────────────────────────────────┐
│                    Processo di Test                   │
│                                                       │
│  ┌────────────┐    InMemoryTransport   ┌────────────┐ │
│  │  Client    │◄──────────────────────►│  Server    │ │
│  │  (test)    │    (collegamento       │  (MCP)     │ │
│  │            │     bidirezionale      │            │ │
│  │  callTool  │     in memoria)        │  tools     │ │
│  │  listTools │                        │  resources │ │
│  └────────────┘                        └────────────┘ │
│                                                       │
│  Nessun processo esterno                              │
│  Nessuna porta di rete                                │
│  Nessun file STDIO                                    │
└───────────────────────────────────────────────────────┘
```

#### Esempio di Test con Vitest

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { MockEventBus } from '@mcp-suite/testing';
import { createScrumBoardServer } from '../src/server.js';

describe('Scrum Board Server', () => {
  let harness: TestHarness;
  let eventBus: MockEventBus;

  beforeAll(async () => {
    eventBus = new MockEventBus();
    const suite = createScrumBoardServer(eventBus);
    harness = await createTestHarness(suite.server);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('should create a sprint', async () => {
    const result = await harness.client.callTool({
      name: 'create-sprint',
      arguments: {
        name: 'Sprint 1',
        startDate: '2025-01-13',
        endDate: '2025-01-24',
        goals: ['Completare autenticazione'],
      },
    });

    expect(result.content).toBeDefined();
    expect(result.isError).toBeUndefined();
  });

  it('should emit sprint-started event', async () => {
    expect(eventBus.wasPublished('scrum:sprint-started')).toBe(true);

    const events = eventBus.getPublishedEvents('scrum:sprint-started');
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({
      name: 'Sprint 1',
      startDate: '2025-01-13',
    });
  });

  it('should list tools', async () => {
    const tools = await harness.client.listTools();
    expect(tools.tools.length).toBeGreaterThan(0);

    const toolNames = tools.tools.map(t => t.name);
    expect(toolNames).toContain('create-sprint');
    expect(toolNames).toContain('sprint-board');
    expect(toolNames).toContain('get-backlog');
  });
});
```

---

### MockEventBus: Verifica degli Eventi

Il `MockEventBus` implementa l'interfaccia `EventBus` registrando tutti gli eventi pubblicati per permettere asserzioni nei test.

#### Implementazione

```typescript
interface PublishedEvent {
  event: string;
  payload: unknown;
  timestamp: Date;
}

export class MockEventBus implements EventBus {
  public published: PublishedEvent[] = [];   // Tutti gli eventi pubblicati
  private handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  private patternHandlers: Array<{ pattern: string; handler: PatternHandler }> = [];

  async publish<E extends EventName>(event: E, payload: EventPayload<E>): Promise<void> {
    // Registra l'evento per le asserzioni
    this.published.push({ event, payload, timestamp: new Date() });

    // Esegue comunque gli handler registrati (per testare i subscriber)
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        await handler(payload);
      }
    }
  }

  subscribe<E extends EventName>(event: E, handler: EventHandler<E>): () => void {
    const handlers = this.handlers.get(event) || [];
    handlers.push(handler as (...args: unknown[]) => void);
    this.handlers.set(event, handlers);
    return () => { /* unsubscribe logic */ };
  }

  subscribePattern(pattern: string, handler: PatternHandler): () => void {
    this.patternHandlers.push({ pattern, handler });
    return () => { /* unsubscribe logic */ };
  }

  clear(): void {
    this.published = [];
    this.handlers.clear();
    this.patternHandlers = [];
  }

  // ── Metodi di utilita per i test ──

  getPublishedEvents(eventName?: string): PublishedEvent[] {
    if (eventName) {
      return this.published.filter((e) => e.event === eventName);
    }
    return this.published;
  }

  wasPublished(eventName: string): boolean {
    return this.published.some((e) => e.event === eventName);
  }
}
```

#### Metodi di Utilita per le Asserzioni

| Metodo | Descrizione | Esempio |
|--------|-------------|---------|
| `wasPublished(name)` | Verifica se un evento e stato pubblicato | `expect(bus.wasPublished('scrum:sprint-started')).toBe(true)` |
| `getPublishedEvents(name?)` | Ottiene gli eventi pubblicati (opzionalmente filtrati) | `bus.getPublishedEvents('time:entry-logged')` |
| `published` | Array diretto di tutti gli eventi | `expect(bus.published).toHaveLength(3)` |
| `clear()` | Resetta tutto per un nuovo test | `bus.clear()` |

#### Esempio: Verificare il Payload degli Eventi

```typescript
it('should emit correct payload on task update', async () => {
  await harness.client.callTool({
    name: 'update-task-status',
    arguments: { taskId: 1, status: 'in_progress' },
  });

  const events = eventBus.getPublishedEvents('scrum:task-updated');
  expect(events).toHaveLength(1);

  const payload = events[0].payload as {
    taskId: string;
    previousStatus: string;
    newStatus: string;
  };

  expect(payload.taskId).toBe('1');
  expect(payload.newStatus).toBe('in_progress');
});
```

---

## Parte 2: @mcp-suite/cli

### Introduzione

Il pacchetto `@mcp-suite/cli` fornisce un'interfaccia a riga di comando per gestire i server MCP Suite: elencarli, avviarli e verificarne lo stato.

```
packages/cli/
├── package.json
├── tsconfig.json
└── src/
    └── index.ts         # Entry point con Commander.js
```

**Dipendenze:**
- `@mcp-suite/core` - Tipi e configurazione
- `@mcp-suite/event-bus` - EventBus per i server
- `@mcp-suite/client-manager` - Pool client per comunicazione server-to-server
- `commander` - Framework per CLI

### Eseguire il CLI

```bash
# Via npx (senza installazione globale)
npx @mcp-suite/cli <comando>

# Dopo build, direttamente
node packages/cli/dist/index.js <comando>
```

---

### Comandi Disponibili

#### `list` - Elencare i Server

```bash
npx @mcp-suite/cli list
```

Scansiona la directory `servers/` e mostra tutti i server disponibili:

```
Available MCP Suite servers:

  - agile-metrics
  - api-documentation
  - cicd-monitor
  - code-review
  - codebase-knowledge
  - data-mock-generator
  - db-schema-explorer
  - dependency-manager
  - docker-compose
  - environment-manager
  - http-client
  - log-analyzer
  - performance-profiler
  - project-economics
  - project-scaffolding
  - regex-builder
  - retrospective-manager
  - scrum-board
  - snippet-manager
  - standup-notes
  - test-generator
  - time-tracking

Total: 22 servers
```

#### `start <server>` - Avviare un Server

```bash
npx @mcp-suite/cli start scrum-board
npx @mcp-suite/cli start scrum-board --transport http
```

**Opzioni:**

| Flag | Descrizione | Default |
|------|-------------|---------|
| `-t, --transport <type>` | Tipo di trasporto (`stdio` o `http`) | `stdio` |

Il comando:
1. Verifica che il server sia compilato (esiste `dist/index.js`)
2. Avvia il processo Node.js con il trasporto specificato
3. Inoltra stdin/stdout/stderr al processo figlio

```typescript
const child = spawn('node', [entryPoint], {
  stdio: 'inherit',
  env: {
    ...process.env,
    MCP_SUITE_TRANSPORT: opts.transport,
  },
});
```

#### `status` - Verificare lo Stato

```bash
npx @mcp-suite/cli status
```

Mostra quali server sono compilati e quali no:

```
MCP Suite Status:

  Total servers: 22
  Built: 20
  Not built: 2

  Built servers:
    + agile-metrics
    + api-documentation
    + cicd-monitor
    ...

  Not built:
    x docker-compose
    x performance-profiler
```

---

### Come Funziona Internamente

Il CLI usa `commander` per definire i comandi e si basa sulla scansione del filesystem:

```typescript
function getAvailableServers(): string[] {
  if (!existsSync(SERVERS_DIR)) return [];
  return readdirSync(SERVERS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())       // Solo directory
    .map((d) => d.name)                    // Estrae i nomi
    .sort();                               // Ordina alfabeticamente
}
```

La directory root del progetto viene calcolata relativamente alla posizione del CLI:

```typescript
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');   // Risale da packages/cli/dist/
const SERVERS_DIR = join(ROOT, 'servers');
```

---

### Uso del CLI per lo Sviluppo

#### Workflow tipico di sviluppo

```bash
# 1. Verificare lo stato dopo una modifica
npx @mcp-suite/cli status

# 2. Se necessario, ricompilare
pnpm build

# 3. Avviare il server in fase di sviluppo
npx @mcp-suite/cli start scrum-board

# 4. In un altro terminale, testare con MCP Inspector
npx @modelcontextprotocol/inspector node servers/scrum-board/dist/index.js
```

#### Sviluppo con watch mode

Per lo sviluppo continuo, usare il watch mode di TypeScript:

```bash
# In un terminale: compilazione automatica
pnpm dev

# In un altro terminale: avvio del server
npx @mcp-suite/cli start scrum-board
```

Il comando `pnpm dev` attiva `turbo run dev --parallel` che esegue `tsc -b --watch` su tutti i pacchetti simultaneamente.

---

## Parte 3: @mcp-suite/client-manager

### Introduzione

Il pacchetto `@mcp-suite/client-manager` gestisce un pool di client MCP per la comunicazione server-to-server. Permette a un server di chiamare tool su altri server in modo programmatico.

### McpClientManager

```typescript
export class McpClientManager {
  // Registra un server nel registro
  register(entry: ServerRegistryEntry): void;
  registerMany(entries: ServerRegistryEntry[]): void;

  // Ottiene o crea una connessione a un server
  async getClient(serverName: string): Promise<Client>;

  // Chiama un tool su un altro server
  async callTool(serverName: string, toolName: string, args?: Record<string, unknown>): Promise<unknown>;

  // Legge una risorsa da un altro server
  async readResource(serverName: string, uri: string): Promise<unknown>;

  // Gestione connessioni
  async disconnect(serverName: string): Promise<void>;
  async disconnectAll(): Promise<void>;
  getRegisteredServers(): string[];
  isConnected(serverName: string): boolean;
}
```

### ServerRegistryEntry

```typescript
export interface ServerRegistryEntry {
  name: string;                    // Nome del server
  transport: 'stdio' | 'http';    // Tipo di trasporto
  command?: string;                // Comando per STDIO (es. 'node')
  args?: string[];                 // Argomenti del comando
  url?: string;                    // URL per HTTP (futuro)
  env?: Record<string, string>;    // Variabili d'ambiente
}
```

### Esempio di Comunicazione Server-to-Server

```typescript
import { McpClientManager } from '@mcp-suite/client-manager';

const manager = new McpClientManager();

// Registra i server con cui comunicare
manager.register({
  name: 'scrum-board',
  transport: 'stdio',
  command: 'node',
  args: ['servers/scrum-board/dist/index.js'],
});

// Chiama un tool su un altro server
const result = await manager.callTool('scrum-board', 'get-backlog', {});

// Disconnetti alla fine
await manager.disconnectAll();
```

### Diagramma della Comunicazione

```
┌─────────────────────┐           ┌────────────────────┐
│  Server A           │           │  Server B          │
│  (agile-metrics)    │           │  (scrum-board)     │
│                     │           │                    │
│  McpClientManager   │  STDIO    │                    │
│  ─► callTool(       │ ────────► │  tool: get-sprint  │
│      'scrum-board', │           │                    │
│      'get-sprint',  │ ◄──────── │  { data: ... }     │
│      { id: 1 }      │ JSON-RPC  │                    │
│     )               │           │                    │
└─────────────────────┘           └────────────────────┘
```

A differenza dell'EventBus (fire-and-forget, asincrono), il ClientManager offre **comunicazione sincrona request/response** tra server.
