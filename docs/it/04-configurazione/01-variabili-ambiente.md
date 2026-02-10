# Variabili d'Ambiente e Configurazione

## Introduzione

Ogni server MCP Suite carica la propria configurazione da **variabili d'ambiente** secondo un pattern prevedibile. La configurazione viene validata a runtime tramite Zod, garantendo che valori errati vengano segnalati immediatamente all'avvio.

---

## Pattern delle Variabili d'Ambiente

Le variabili seguono il formato:

```
MCP_SUITE_<NOME_SERVER>_<CAMPO>
```

Il nome del server viene convertito: i trattini (`-`) diventano underscore (`_`) e il tutto e in MAIUSCOLO.

**Esempi:**
| Server | Variabile |
|--------|-----------|
| `scrum-board` | `MCP_SUITE_SCRUM_BOARD_LOG_LEVEL` |
| `time-tracking` | `MCP_SUITE_TIME_TRACKING_DATA_DIR` |
| `db-schema-explorer` | `MCP_SUITE_DB_SCHEMA_EXPLORER_TRANSPORT` |
| `cicd-monitor` | `MCP_SUITE_CICD_MONITOR_PORT` |

### Variabili Globali (fallback)

Se una variabile specifica per server non e definita, il sistema cerca la variabile globale senza prefisso del server:

```
MCP_SUITE_<CAMPO>
```

**Ordine di risoluzione:**
1. `MCP_SUITE_SCRUM_BOARD_LOG_LEVEL` (specifica per server)
2. `MCP_SUITE_LOG_LEVEL` (globale, usata come fallback)
3. Valore di default dallo schema Zod

---

## Campi Disponibili

| Campo | Variabile Specifica | Variabile Globale | Tipo | Default |
|-------|--------------------|--------------------|------|---------|
| **transport** | `MCP_SUITE_<SERVER>_TRANSPORT` | `MCP_SUITE_TRANSPORT` | `'stdio' \| 'http'` | `'stdio'` |
| **port** | `MCP_SUITE_<SERVER>_PORT` | `MCP_SUITE_PORT` | `number` | (nessuno) |
| **logLevel** | `MCP_SUITE_<SERVER>_LOG_LEVEL` | `MCP_SUITE_LOG_LEVEL` | `'debug' \| 'info' \| 'warn' \| 'error'` | `'info'` |
| **dataDir** | `MCP_SUITE_<SERVER>_DATA_DIR` | `MCP_SUITE_DATA_DIR` | `string` (percorso) | `~/.mcp-suite/data/` |
| **eventBus.type** | `MCP_SUITE_<SERVER>_EVENT_BUS_TYPE` | `MCP_SUITE_EVENT_BUS_TYPE` | `'local' \| 'redis'` | `'local'` |
| **eventBus.redisUrl** | `MCP_SUITE_<SERVER>_REDIS_URL` | `MCP_SUITE_REDIS_URL` | `string` (URL) | (nessuno) |

---

## Schema Zod della Configurazione

La configurazione e definita e validata tramite il seguente schema in `@mcp-suite/core`:

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

**Tipo risultante `ServerConfig`:**
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

## Funzione loadConfig

La funzione `loadConfig` in `@mcp-suite/core` gestisce il caricamento:

```typescript
export function loadConfig(serverName: string, overrides?: Partial<ServerConfig>): ServerConfig {
  const raw: Record<string, unknown> = {};

  // 1. Cerca la variabile specifica per server, poi quella globale
  const transport = process.env[envKey(serverName, 'TRANSPORT')]
                 || process.env.MCP_SUITE_TRANSPORT;
  if (transport) raw.transport = transport;

  const port = process.env[envKey(serverName, 'PORT')]
            || process.env.MCP_SUITE_PORT;
  if (port) raw.port = parseInt(port, 10);

  const logLevel = process.env[envKey(serverName, 'LOG_LEVEL')]
                || process.env.MCP_SUITE_LOG_LEVEL;
  if (logLevel) raw.logLevel = logLevel;

  // ... altri campi ...

  // 2. Merge con eventuali override programmatici
  const merged = { ...raw, ...overrides };

  // 3. Validazione con Zod (applica i default)
  return ServerConfigSchema.parse(merged);
}
```

---

## Esempio di File .env

Creare un file `.env` nella root del progetto (o nella directory di esecuzione) e caricarlo con uno strumento come `dotenv`:

```bash
# ── Configurazione Globale ──────────────────────────────────

# Livello di log per tutti i server (default: info)
MCP_SUITE_LOG_LEVEL=info

# Directory per i database SQLite (default: ~/.mcp-suite/data/)
MCP_SUITE_DATA_DIR=/home/utente/.mcp-suite/data

# Tipo di trasporto (default: stdio)
MCP_SUITE_TRANSPORT=stdio

# Tipo di EventBus (default: local)
MCP_SUITE_EVENT_BUS_TYPE=local

# ── Override per Server Specifici ───────────────────────────

# Debug attivo solo per il server scrum-board
MCP_SUITE_SCRUM_BOARD_LOG_LEVEL=debug

# Database del time-tracking in una directory diversa
MCP_SUITE_TIME_TRACKING_DATA_DIR=/var/data/mcp/time-tracking

# Il server http-client su porta 3100 (quando si usa HTTP transport)
MCP_SUITE_HTTP_CLIENT_TRANSPORT=http
MCP_SUITE_HTTP_CLIENT_PORT=3100
```

**Nota:** I server MCP Suite non caricano automaticamente i file `.env`. Per utilizzarli, avviare il server con uno strumento come `dotenv-cli`:

```bash
npx dotenv-cli -- node servers/scrum-board/dist/index.js
```

Oppure passare le variabili tramite la configurazione di Claude Desktop:

```json
{
  "scrum-board": {
    "command": "node",
    "args": ["/percorso/servers/scrum-board/dist/index.js"],
    "env": {
      "MCP_SUITE_SCRUM_BOARD_LOG_LEVEL": "debug"
    }
  }
}
```

---

## Directory dei Dati

### Percorso di default

```
~/.mcp-suite/data/
```

Questa directory contiene i file di database SQLite, uno per ogni server che utilizza la persistenza:

```
~/.mcp-suite/data/
├── scrum-board.db          # Database dello scrum board
├── standup-notes.db        # Database delle note standup
├── time-tracking.db        # Database del time tracking
├── snippet-manager.db      # Database degli snippet
├── project-economics.db    # Database economia progetto
├── retrospective-manager.db # Database retrospettive
└── ...
```

### Come viene creata

La directory viene creata automaticamente al primo avvio di un server che utilizza il database. Il codice in `@mcp-suite/database`:

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

### Personalizzare il percorso

```bash
# Globale per tutti i server
export MCP_SUITE_DATA_DIR=/percorso/personalizzato/data

# Solo per un server specifico
export MCP_SUITE_SCRUM_BOARD_DATA_DIR=/percorso/scrum-data
```

---

## Livelli di Log

I log vengono scritti su `stderr` in formato JSON strutturato.

| Livello | Valore Numerico | Descrizione |
|---------|----------------|-------------|
| `debug` | 0 | Informazioni dettagliate per il debugging |
| `info` | 1 | Informazioni generali sull'esecuzione (default) |
| `warn` | 2 | Avvertimenti su situazioni anomale |
| `error` | 3 | Errori che richiedono attenzione |

### Formato dei log

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "level": "info",
  "server": "scrum-board",
  "message": "Initializing scrum-board v0.1.0"
}
```

### Filtrare i log

Quando si reindirizzano i log su file, e possibile filtrarli per livello con `jq`:

```bash
# Mostra solo gli errori
node servers/scrum-board/dist/index.js 2>&1 >/dev/null | jq 'select(.level == "error")'

# Mostra errori e warning
node servers/scrum-board/dist/index.js 2>&1 >/dev/null | jq 'select(.level == "error" or .level == "warn")'
```

---

## Riepilogo dei Default

| Parametro | Valore di Default |
|-----------|------------------|
| Transport | `stdio` |
| Port | Non definita (necessaria solo per HTTP) |
| Log Level | `info` |
| Data Directory | `~/.mcp-suite/data/` |
| EventBus Type | `local` |
| Redis URL | Non definita |
