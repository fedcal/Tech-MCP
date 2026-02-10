# Panoramica dell'Architettura

## Introduzione

MCP Suite e un monorepo TypeScript che raccoglie **22 server MCP** e **6 pacchetti condivisi** in un'unica codebase gestita con **pnpm workspaces** e **Turborepo**. L'architettura e stata progettata con due obiettivi principali: **indipendenza dei server** (ogni server e autonomo e deployabile singolarmente) e **collaborazione opzionale** (i server possono scambiarsi eventi tramite un EventBus tipizzato).

---

## Struttura del Monorepo

```
mcp-suite/
├── package.json              # Root: script globali, engine constraints
├── pnpm-workspace.yaml       # Definisce packages/* e servers/* come workspace
├── turbo.json                # Pipeline di build con Turborepo
├── tsconfig.base.json        # Configurazione TypeScript condivisa
│
├── packages/                 # Librerie condivise (6 pacchetti)
│   ├── core/                 #   Factory server, config, logger, errori, tipi
│   ├── event-bus/            #   EventBus tipizzato con 29 eventi
│   ├── database/             #   Connessione SQLite + migrazioni
│   ├── testing/              #   Harness di test + MockEventBus
│   ├── cli/                  #   CLI per gestire i server
│   └── client-manager/       #   Pool di client MCP per comunicazione server-to-server
│
├── servers/                  # 22 MCP server indipendenti
│   ├── scrum-board/          #   Gestione sprint, storie, task
│   ├── standup-notes/        #   Note per gli standup giornalieri
│   ├── time-tracking/        #   Tracciamento tempo
│   ├── agile-metrics/        #   Metriche agili (velocity, burndown)
│   ├── code-review/          #   Analisi e review del codice
│   ├── test-generator/       #   Generazione test automatici
│   ├── cicd-monitor/         #   Monitoraggio pipeline CI/CD
│   ├── docker-compose/       #   Gestione Docker Compose
│   ├── db-schema-explorer/   #   Esplorazione schemi database
│   ├── dependency-manager/   #   Gestione dipendenze progetto
│   ├── api-documentation/    #   Documentazione API
│   ├── codebase-knowledge/   #   Knowledge base del codice
│   ├── data-mock-generator/  #   Generazione dati mock
│   ├── environment-manager/  #   Gestione variabili d'ambiente
│   ├── http-client/          #   Client HTTP per test API
│   ├── log-analyzer/         #   Analisi log applicativi
│   ├── performance-profiler/ #   Profilazione performance
│   ├── project-economics/    #   Economia di progetto (budget, costi)
│   ├── project-scaffolding/  #   Scaffolding nuovi progetti
│   ├── regex-builder/        #   Costruzione espressioni regolari
│   ├── retrospective-manager/#   Gestione retrospettive agili
│   └── snippet-manager/      #   Libreria di snippet di codice
│
└── docs/                     # Documentazione del progetto
```

---

## Diagramma a Livelli dell'Architettura

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Claude Desktop, Cursor, VS Code)     │
│                Comunica via STDIO o HTTP (JSON-RPC / Streamable)    │
└─────────────┬──────────────────────────────────────┬────────────────┘
              │                                      │
              ▼                                      ▼
┌──────────────────────┐                ┌──────────────────────┐
│   scrum-board        │                │   time-tracking      │
│   ┌──────────────┐   │   EventBus     │   ┌──────────────┐   │
│   │  tools/      │   │◄──────────────►│   │  tools/      │   │
│   │  services/   │   │  (opzionale)   │   │  services/   │   │
│   │  server.ts   │   │                │   │  server.ts   │   │
│   │  index.ts    │   │                │   │  index.ts    │   │
│   └──────────────┘   │                │   └──────────────┘   │
└──────────┬───────────┘                └──────────┬───────────┘
           │                                       │
           ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         PACKAGES (librerie condivise)               │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  ┌─────────────┐   │
│  │  @mcp-suite │  │  @mcp-suite │  │ @mcp-suite│  │  @mcp-suite │   │
│  │  /core      │  │  /event-bus │  │ /database │  │  /testing   │   │
│  │             │  │             │  │           │  │             │   │
│  │ - factory   │  │ - EventBus  │  │ - SQLite  │  │ - harness   │   │
│  │ - config    │  │ - EventMap  │  │ - WAL     │  │ - mock bus  │   │
│  │ - logger    │  │ - LocalBus  │  │ - migrate │  │             │   │
│  │ - errors    │  │ - patterns  │  │           │  │             │   │
│  │ - types     │  │             │  │           │  │             │   │
│  └─────────────┘  └─────────────┘  └───────────┘  └─────────────┘   │
│                                                                     │
│  ┌─────────────┐  ┌───────────────┐                                 │
│  │  @mcp-suite │  │  @mcp-suite   │                                 │
│  │  /cli       │  │  /client-mgr  │                                 │
│  │             │  │               │                                 │
│  │ - list      │  │ - pool client │                                 │
│  │ - start     │  │ - callTool    │                                 │
│  │ - status    │  │ - readResource│                                 │
│  └─────────────┘  └───────────────┘                                 │
└─────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  @modelcontextprotocol/sdk        better-sqlite3          zod       │
│  (protocollo MCP ufficiale)      (database nativo)     (validaz.)   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Decisioni Progettuali

### Perche TypeScript?

- **Type-safety end-to-end**: i tipi definiti in `@mcp-suite/core` sono condivisi tra tutti i server, garantendo coerenza a compile-time
- **ESM nativo**: target ES2022 con `"module": "Node16"` per compatibilita nativa con Node.js moderno
- **Declaration maps**: ogni pacchetto genera `.d.ts` e `.d.ts.map`, permettendo il "Go to Definition" attraverso tutto il monorepo
- **Strict mode**: `"strict": true` in `tsconfig.base.json` per massima sicurezza

### Perche SQLite (better-sqlite3)?

- **Zero configurazione**: nessun server database da installare o gestire
- **File-based**: ogni server ha il proprio file `.db` in `~/.mcp-suite/data/`
- **Sincrono**: `better-sqlite3` usa binding C++ sincroni, ideale per operazioni locali veloci
- **WAL mode**: Write-Ahead Logging abilitato per performance ottimali in lettura concorrente
- **Portabile**: il database si sposta semplicemente copiando il file

### Trasporti: STDIO e HTTP

MCP Suite supporta due trasporti, selezionabili via configurazione (`MCP_SUITE_TRANSPORT`):

**STDIO** (default) - Ideale per uso locale:
- Nessuna porta da aprire, nessun conflitto di rete
- Comunicazione locale, nessuna esposizione di rete
- Compatibile con Claude Desktop, Cursor e VS Code
- Ogni istanza del server e un processo separato

**HTTP (Streamable HTTP)** - Per deployment remoti e comunicazione inter-server:
- Ogni server espone un endpoint HTTP su una porta dedicata
- Protocollo MCP Streamable HTTP (modalita stateful con session UUID)
- Route standard: `POST/GET/DELETE /mcp` + `GET /health`
- Necessario per il Client Manager Wiring (chiamate tool cross-server)
- Adatto a deployment su server remoti, container e scaling orizzontale

### Perche un Monorepo?

- **Condivisione codice**: i pacchetti in `packages/` sono condivisi senza pubblicare su npm
- **Build atomiche**: Turborepo garantisce l'ordine corretto di build con `dependsOn: ["^build"]`
- **Versioning unificato**: tutti i pacchetti e server si evolvono insieme
- **DX superiore**: un solo `pnpm install`, un solo `pnpm build` per tutto

---

## Il Pattern Server

Ogni server segue una struttura a 4 strati rigorosa:

```
servers/nome-server/
├── package.json        # Dipendenze e script
├── tsconfig.json       # Estende tsconfig.base.json
└── src/
    ├── index.ts        # Entry point: crea EventBus, avvia il server
    ├── server.ts       # Factory: createXxxServer() -> McpSuiteServer
    ├── tools/          # Un file per tool, funzione registerXxx()
    │   ├── create-sprint.ts
    │   ├── get-sprint.ts
    │   └── ...
    ├── services/       # Store SQLite e logica di business
    │   └── scrum-store.ts
    └── collaboration.ts  # Handler per eventi da altri server (opzionale)
```

| Strato | Responsabilita | Dipendenze |
|--------|---------------|------------|
| `index.ts` | Bootstrap: crea EventBus, chiama factory, avvia trasporto | `@mcp-suite/core`, `@mcp-suite/event-bus` |
| `server.ts` | Crea `McpSuiteServer`, istanzia store, registra tool | `@mcp-suite/core`, services, tools |
| `tools/` | Definizione singolo tool con schema Zod e handler | `@modelcontextprotocol/sdk`, services |
| `services/` | Persistenza SQLite, logica di dominio | `@mcp-suite/database` |
| `collaboration.ts` | Sottoscrizioni a eventi cross-server | `@mcp-suite/event-bus` |

---

## L'interfaccia McpSuiteServer

Ogni server e rappresentato dall'interfaccia `McpSuiteServer`, il contratto centrale dell'architettura:

```typescript
export interface McpSuiteServer {
  server: McpServer;      // Istanza del server MCP (SDK ufficiale)
  config: ServerConfig;   // Configurazione caricata (transport, port, logLevel, ...)
  logger: Logger;         // Logger strutturato su stderr
  eventBus?: EventBus;    // EventBus opzionale per collaborazione
}
```

Questa interfaccia viene creata dalla factory `createMcpServer()` e passata a tutte le funzioni di registrazione tool. Il campo `eventBus` e **opzionale**: se presente, i tool possono pubblicare eventi; se assente, i tool funzionano in modalita standalone.

---

## Collaborazione tra Server

I server sono **indipendenti per default** ma possono **collaborare tramite EventBus**:

```
┌────────────────┐    publish('scrum:task-updated')   ┌────────────────┐
│  scrum-board   │ ─────────────────────────────────► │  agile-metrics │
│                │                                    │                │
│  Aggiorna un   │    publish('time:entry-logged')    │  Ricalcola     │
│  task status   │ ◄───────────────────────────────── │  velocity      │
└────────────────┘                                    └────────────────┘
       │
       │  subscribe('retro:action-item-created')
       │
       ▼
┌────────────────┐
│  retrospective │
│  -manager      │
└────────────────┘
```

La collaborazione avviene su due canali complementari:

**EventBus (Pub/Sub)** - Notifiche asincrone:
- Opzionale, fire-and-forget: `eventBus?.publish(...)`
- Tipizzata: l'`EventMap` definisce 29 eventi con payload fortemente tipizzati
- 13 server pubblicano eventi, 6 hanno collaboration handler

**Client Manager (RPC)** - Query sincrone:
- Chiamate dirette tool-to-tool: `clientManager.callTool('target', 'tool', args)`
- 6 scenari implementati (5 server chiamanti, 3 server target)
- Graceful degradation: funziona anche senza il target disponibile
- Documentazione: [Client Manager Wiring](../14-collaborazione-inter-server/04-client-manager-wiring.md)

---

## Flusso di Build

Turborepo gestisce il grafo delle dipendenze e parallelizza le build:

```
pnpm build
    │
    ├── @mcp-suite/event-bus      (nessuna dipendenza interna)
    ├── @mcp-suite/core           (dipende da event-bus)
    ├── @mcp-suite/database       (dipende da core)
    ├── @mcp-suite/testing        (dipende da core, event-bus)
    ├── @mcp-suite/client-manager (dipende da core)
    ├── @mcp-suite/cli            (dipende da core, event-bus, client-manager)
    │
    └── servers/* (tutti dipendono da core, event-bus, database)
        ├── scrum-board
        ├── standup-notes
        ├── time-tracking
        └── ... (altri 19 server in parallelo)
```

La direttiva `"dependsOn": ["^build"]` in `turbo.json` assicura che i pacchetti vengano compilati prima dei server che li utilizzano.
