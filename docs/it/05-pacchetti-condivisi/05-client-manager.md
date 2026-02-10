# @mcp-suite/client-manager

## Introduzione

Il pacchetto `@mcp-suite/client-manager` gestisce un **pool di client MCP** per la comunicazione sincrona server-to-server. Permette a un server di chiamare tool esposti da altri server come se fossero funzioni locali, astraendo completamente i dettagli di trasporto (STDIO, HTTP, InMemory).

```
packages/client-manager/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts       # Re-export di McpClientManager e ServerRegistryEntry
    └── manager.ts     # Implementazione del client pool
```

**Dipendenze:**
- `@modelcontextprotocol/sdk` - Client MCP ufficiale e trasporti
- `@mcp-suite/core` - Logger per messaggi diagnostici

---

## Concetti Chiave

### Il Problema

In un ambiente con 22 server MCP indipendenti, alcuni tool hanno bisogno di dati che risiedono in altri server. Senza il Client Manager, l'unica opzione sarebbe duplicare la logica o usare chiamate HTTP manuali.

### La Soluzione

Il Client Manager offre:

1. **Registry**: registra i server target con le informazioni di connessione
2. **Connessione lazy**: i client vengono creati solo al primo utilizzo
3. **Pool**: le connessioni vengono riutilizzate tra chiamate successive
4. **Multi-trasporto**: supporta STDIO, HTTP (Streamable HTTP) e InMemory

```
┌─────────────────────────────────────────────────┐
│                McpClientManager                 │
│                                                 │
│    Registry       Client Pool      Transports   │
│  ┌───────────┐   ┌───────────┐    ┌───────────┐ │
│  │ scrum-    │   │ Client A  │    │ HTTP      │ │
│  │ board     │──►│           │───►│ Transport │ │
│  ├───────────┤   ├───────────┤    ├───────────┤ │
│  │ time-     │   │ Client B  │    │ STDIO     │ │
│  │ tracking  │──►│           │───►│ Transport │ │
│  ├───────────┤   ├───────────┤    ├───────────┤ │
│  │ db-schema │   │ Client C  │    │ InMemory  │ │
│  │ explorer  │──►│           │───►│ Transport │ │
│  └───────────┘   └───────────┘    └───────────┘ │
└─────────────────────────────────────────────────┘
```

---

## API

### ServerRegistryEntry

L'interfaccia per registrare un server target nel pool:

```typescript
export interface ServerRegistryEntry {
  name: string;                              // Nome univoco del server target
  transport: 'stdio' | 'http' | 'in-memory'; // Tipo di trasporto
  command?: string;    // Comando per STDIO (es. 'node')
  args?: string[];     // Argomenti per STDIO (es. ['dist/index.js'])
  url?: string;        // URL per HTTP (es. 'http://localhost:3018/mcp')
  env?: Record<string, string>;  // Variabili d'ambiente per STDIO
}
```

| Campo | Obbligatorio per | Descrizione |
|-------|-----------------|-------------|
| `name` | Tutti | Identificatore unico usato in `callTool()` |
| `transport` | Tutti | Tipo di connessione |
| `command` | STDIO | Eseguibile da lanciare |
| `args` | STDIO | Argomenti del comando |
| `url` | HTTP | Endpoint del server (path `/mcp` incluso) |
| `env` | STDIO | Variabili d'ambiente del sottoprocesso |

### McpClientManager

La classe principale del pacchetto:

```typescript
class McpClientManager {
  // --- Registrazione ---
  register(entry: ServerRegistryEntry): void;
  registerMany(entries: ServerRegistryEntry[]): void;

  // --- Connessione ---
  getClient(serverName: string): Promise<Client>;
  static createInMemoryPair(): [Transport, Transport];
  connectInMemoryWithTransport(serverName: string, clientTransport: Transport): Promise<void>;

  // --- Chiamate RPC ---
  callTool(serverName: string, toolName: string, args?: Record<string, unknown>): Promise<unknown>;
  readResource(serverName: string, uri: string): Promise<unknown>;

  // --- Gestione ciclo vita ---
  disconnect(serverName: string): Promise<void>;
  disconnectAll(): Promise<void>;

  // --- Query ---
  getRegisteredServers(): string[];
  isConnected(serverName: string): boolean;
}
```

---

## Trasporti Supportati

### 1. HTTP (Streamable HTTP)

Per comunicazione tra server in processi o macchine separate. Usa il protocollo MCP Streamable HTTP dell'SDK ufficiale.

```typescript
const clientManager = new McpClientManager();

clientManager.register({
  name: 'scrum-board',
  transport: 'http',
  url: 'http://localhost:3018/mcp',
});

// Il client viene creato automaticamente alla prima chiamata
const result = await clientManager.callTool('scrum-board', 'get-sprint', { sprintId: 1 });
```

### 2. STDIO

Per server avviati come sottoprocessi. Il Client Manager lancia il processo e comunica via stdin/stdout.

```typescript
clientManager.register({
  name: 'scrum-board',
  transport: 'stdio',
  command: 'node',
  args: ['servers/scrum-board/dist/index.js'],
  env: { MCP_SUITE_TRANSPORT: 'stdio' },
});
```

### 3. InMemory

Per test e scenari in-process dove caller e target vivono nello stesso processo Node.js. Usa `InMemoryTransport.createLinkedPair()` dell'SDK.

```typescript
// 1. Creare la coppia collegata
const [clientTransport, serverTransport] = McpClientManager.createInMemoryPair();

// 2. Connettere il server target al suo lato (PRIMA)
await targetServer.connect(serverTransport);

// 3. Connettere il client manager al lato client (DOPO)
await clientManager.connectInMemoryWithTransport('target-server', clientTransport);

// 4. Chiamare tool come al solito
const result = await clientManager.callTool('target-server', 'my-tool', { arg: 'value' });
```

**Ordine di connessione**: il server DEVE connettersi al `serverTransport` PRIMA che il client si connetta al `clientTransport`. Il client invia immediatamente il messaggio `initialize` al momento della connessione, e il server deve essere in ascolto.

---

## Connessione Lazy e Pool

Il Client Manager crea i client in modo **lazy**: la connessione viene stabilita solo alla prima chiamata `getClient()` o `callTool()`:

```
Prima chiamata a callTool('scrum-board', ...)
  │
  ├── getClient('scrum-board')
  │     │
  │     ├── clients.has('scrum-board')? → No
  │     │
  │     ├── registry.get('scrum-board') → { transport: 'http', url: '...' }
  │     │
  │     ├── connectHttp(entry)
  │     │     ├── new StreamableHTTPClientTransport(url)
  │     │     ├── new Client(...)
  │     │     ├── await client.connect(transport)
  │     │     └── clients.set('scrum-board', client)  ← cached
  │     │
  │     └── return client
  │
  └── client.callTool({ name: toolName, arguments: args })

Seconda chiamata a callTool('scrum-board', ...)
  │
  ├── getClient('scrum-board')
  │     │
  │     └── clients.has('scrum-board')? → Si → return cached client  ← riuso
  │
  └── client.callTool(...)
```

---

## Esempio Completo: Uso in un Server

```typescript
// servers/agile-metrics/src/index.ts
import { LocalEventBus } from '@mcp-suite/event-bus';
import { McpClientManager } from '@mcp-suite/client-manager';
import { startServer } from '@mcp-suite/core';
import { createAgileMetricsServer } from './server.js';

const eventBus = new LocalEventBus();

const clientManager = new McpClientManager();
clientManager.registerMany([
  {
    name: 'scrum-board',
    transport: 'http',
    url: process.env.MCP_SUITE_SCRUM_BOARD_URL || 'http://localhost:3018/mcp',
  },
  {
    name: 'time-tracking',
    transport: 'http',
    url: process.env.MCP_SUITE_TIME_TRACKING_URL || 'http://localhost:3022/mcp',
  },
]);

const suite = createAgileMetricsServer({ eventBus, clientManager });
await startServer(suite);
```

---

## Gestione Errori

Se un server target non e raggiungibile, `callTool()` solleva un errore. I tool chiamanti gestiscono questo con il pattern di graceful degradation:

```typescript
if (enrichFromExternal && clientManager) {
  try {
    const result = await clientManager.callTool('target', 'tool', args);
    // usa il risultato
  } catch (error) {
    // Il tool funziona comunque, senza arricchimento
    logger.warn('Cross-server call failed, continuing without enrichment');
  }
}
```

Questo garantisce che un server target non disponibile non impedisca al server chiamante di funzionare.
