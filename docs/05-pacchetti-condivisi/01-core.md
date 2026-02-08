# @mcp-suite/core

## Introduzione

Il pacchetto `@mcp-suite/core` e il cuore della suite. Fornisce le utility fondamentali utilizzate da tutti i 22 server: la factory per la creazione di server, il sistema di configurazione, il logger strutturato, la gerarchia di errori e i tipi di dominio condivisi.

```
packages/core/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts          # Re-export di tutti i moduli
    ├── server-factory.ts # createMcpServer, startServer, McpSuiteServer
    ├── config.ts         # loadConfig, ServerConfigSchema
    ├── logger.ts         # Logger strutturato su stderr
    ├── errors.ts         # Gerarchia errori tipizzati
    └── types.ts          # Tipi di dominio condivisi
```

**Dipendenze:**
- `@modelcontextprotocol/sdk` - SDK ufficiale del protocollo MCP
- `@mcp-suite/event-bus` - EventBus per collaborazione inter-server
- `zod` - Validazione e parsing dello schema di configurazione

---

## server-factory.ts

Questo modulo contiene la factory principale per la creazione di server MCP e le funzioni di avvio.

### CreateServerOptions

L'interfaccia per le opzioni di creazione del server:

```typescript
export interface CreateServerOptions {
  name: string;             // Nome univoco del server (es. 'scrum-board')
  version: string;          // Versione semantica (es. '0.1.0')
  description?: string;     // Descrizione leggibile
  config?: Partial<ServerConfig>;  // Override della configurazione
  eventBus?: EventBus;      // EventBus opzionale per collaborazione
}
```

### McpSuiteServer

L'interfaccia che rappresenta un server istanziato e pronto per l'uso:

```typescript
export interface McpSuiteServer {
  name: string;           // Nome univoco del server (es. 'scrum-board')
  server: McpServer;      // Istanza del server MCP dall'SDK ufficiale
  config: ServerConfig;   // Configurazione caricata e validata con Zod
  logger: Logger;         // Logger strutturato (scrive su stderr)
  eventBus?: EventBus;    // EventBus opzionale (undefined se non fornito)
  httpServer?: Server;    // Riferimento al server HTTP (se trasporto HTTP attivo)
}
```

Questa interfaccia e il **contratto centrale** dell'architettura: ogni server la implementa, ogni funzione di registrazione tool la riceve (o riceve i suoi campi).

### createMcpServer()

La factory che crea l'istanza `McpSuiteServer`:

```typescript
export function createMcpServer(options: CreateServerOptions): McpSuiteServer {
  // 1. Carica configurazione da env + override
  const config = loadConfig(options.name, options.config);

  // 2. Crea logger con il livello configurato
  const logger = new Logger(options.name, config.logLevel);
  logger.info(`Initializing ${options.name} v${options.version}`);

  // 3. Istanzia il McpServer dall'SDK ufficiale
  const server = new McpServer({
    name: options.name,
    version: options.version,
  });

  // 4. Restituisce il bundle completo
  return { server, config, logger, eventBus: options.eventBus };
}
```

**Flusso:**

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

### startServer(), startStdioServer() e startHttpServer()

Funzioni per avviare il server con il trasporto appropriato:

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
    sessionIdGenerator: () => randomUUID(),  // Modalita stateful
  });

  await suite.server.connect(transport);

  // Route MCP standard (Streamable HTTP spec)
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

La funzione `startServer()` seleziona automaticamente il trasporto in base alla configurazione (`MCP_SUITE_TRANSPORT=http` o `MCP_SUITE_TRANSPORT=stdio`).

Il trasporto HTTP usa il protocollo **Streamable HTTP** dell'SDK MCP con modalita **stateful** (ogni sessione ha un UUID). L'app Express e creata tramite `createMcpExpressApp()` dell'SDK, che gestisce il parsing del body e le route standard. L'endpoint `/health` permette il monitoraggio.

---

## config.ts

Il modulo di configurazione gestisce il caricamento dei parametri da variabili d'ambiente con validazione Zod.

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

Il caricamento segue una cascata di priorita:

```
Variabile Specifica ──► Variabile Globale ──► Override Programmatico ──► Default Zod
(MCP_SUITE_XXX_YYY)    (MCP_SUITE_YYY)       (parametro overrides)     (schema .default())
```

```typescript
export function loadConfig(
  serverName: string,
  overrides?: Partial<ServerConfig>
): ServerConfig {
  const raw: Record<string, unknown> = {};

  // Cerca variabile specifica, poi globale
  const transport = process.env[envKey(serverName, 'TRANSPORT')]
                 || process.env.MCP_SUITE_TRANSPORT;
  if (transport) raw.transport = transport;

  // ... altri campi ...

  const merged = { ...raw, ...overrides };
  return ServerConfigSchema.parse(merged);  // Validazione + default
}
```

La funzione helper `envKey` converte il nome del server nel formato variabile d'ambiente:

```typescript
function envKey(serverName: string, field: string): string {
  const prefix = serverName.replace(/-/g, '_').toUpperCase();
  return `MCP_SUITE_${prefix}_${field.toUpperCase()}`;
}
// envKey('scrum-board', 'LOG_LEVEL') => 'MCP_SUITE_SCRUM_BOARD_LOG_LEVEL'
```

---

## logger.ts

Il Logger scrive log strutturati in formato JSON su `stderr`. L'uso di stderr e fondamentale: il protocollo MCP usa `stdout` per la comunicazione JSON-RPC, quindi i log devono andare su un canale separato.

### Classe Logger

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
    private readonly name: string,    // Nome del server
    level: LogLevel = 'info',         // Livello minimo di log
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
    if (LOG_LEVELS[level] < this.level) return;  // Filtraggio per livello

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      server: this.name,
      message,
      ...data,  // Dati aggiuntivi strutturati
    };

    process.stderr.write(JSON.stringify(entry) + '\n');
  }
}
```

**Esempio di output:**
```json
{"timestamp":"2025-01-15T10:30:00.000Z","level":"info","server":"scrum-board","message":"All scrum-board tools registered"}
```

### Perche stderr?

```
┌───────────────────────────────────┐
│          Processo Node.js         │
│                                   │
│  stdout ──► JSON-RPC (MCP)        │  ← comunicazione con il client
│  stderr ──► Log strutturati       │  ← messaggi diagnostici
└───────────────────────────────────┘
```

Se i log andassero su stdout, corromperebbero il flusso JSON-RPC e il client MCP non potrebbe comunicare con il server.

---

## errors.ts

Una gerarchia di errori tipizzati per gestire i diversi tipi di fallimento in modo uniforme.

```
McpSuiteError (base)
├── ConfigError          (errori di configurazione)
├── ConnectionError      (errori di connessione)
├── ToolExecutionError   (errori durante l'esecuzione di un tool)
├── NotFoundError        (risorsa non trovata)
└── ValidationError      (errori di validazione input)
```

### McpSuiteError (classe base)

```typescript
export class McpSuiteError extends Error {
  constructor(
    message: string,
    public readonly code: string,      // Codice errore machine-readable
    public readonly details?: unknown,  // Dettagli aggiuntivi
  ) {
    super(message);
    this.name = 'McpSuiteError';
  }
}
```

### Classi derivate

| Classe | Codice | Uso |
|--------|--------|-----|
| `ConfigError` | `CONFIG_ERROR` | Configurazione non valida o mancante |
| `ConnectionError` | `CONNECTION_ERROR` | Problemi di connessione al database o servizi esterni |
| `ToolExecutionError` | `TOOL_EXECUTION_ERROR` | Errore durante l'esecuzione di un tool MCP |
| `NotFoundError` | `NOT_FOUND` | Risorsa richiesta non trovata (es. sprint, task) |
| `ValidationError` | `VALIDATION_ERROR` | Input dell'utente non valido |

### Esempio di utilizzo

```typescript
import { NotFoundError, ToolExecutionError } from '@mcp-suite/core';

// In uno store
const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(id);
if (!sprint) {
  throw new NotFoundError('Sprint', String(id));
  // Messaggio: "Sprint with id '42' not found"
  // Codice:    "NOT_FOUND"
}

// In un tool handler
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

Questo modulo definisce tutti i tipi di dominio condivisi tra i server. I tipi sono organizzati per area funzionale.

### Tipi di Risultato dei Tool

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

### Organizzazione dei Tipi per Dominio

| Dominio | Tipi | Utilizzati da |
|---------|------|---------------|
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

## Export del Pacchetto

Il file `index.ts` ri-esporta tutto in modo organizzato:

```typescript
// Factory e server
export { createMcpServer, startStdioServer, startHttpServer, startServer,
         type CreateServerOptions, type McpSuiteServer } from './server-factory.js';

// EventBus (ri-esportato per comodita)
export type { EventBus } from '@mcp-suite/event-bus';

// Configurazione
export { loadConfig, ServerConfigSchema, type ServerConfig } from './config.js';

// Logger
export { Logger, type LogLevel } from './logger.js';

// Errori
export { McpSuiteError, ConfigError, ConnectionError,
         ToolExecutionError, NotFoundError, ValidationError } from './errors.js';

// Tipi di dominio (30+ tipi esportati)
export type { ToolSuccess, ToolError, ToolResult, FileReference,
             GitCommitInfo, CodeIssue, TaskStatus, /* ... */ } from './types.js';
```

Questo permette ai server di importare tutto da un unico punto:

```typescript
import {
  createMcpServer,
  type McpSuiteServer,
  type EventBus,
  Logger,
  NotFoundError
} from '@mcp-suite/core';
```
