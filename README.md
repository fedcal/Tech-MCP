# MCP Suite

**Una suite completa di 22 server MCP (Model Context Protocol) per la produttivita dello sviluppatore.**

MCP Suite e un monorepo TypeScript che fornisce strumenti intelligenti per ogni aspetto del ciclo di vita dello sviluppo software: dalla gestione del codice al project management Scrum/Agile, dall'economia dei progetti alle utility quotidiane. Tutti i server comunicano tra loro tramite un sistema di eventi tipizzato.

---

## Panoramica

| Dato | Valore |
|------|--------|
| **Server MCP** | 22 |
| **Tool totali** | 85+ |
| **Pacchetti condivisi** | 6 |
| **Eventi tipizzati** | 29 |
| **Linguaggio** | TypeScript |
| **SDK** | `@modelcontextprotocol/sdk` v1.x |
| **Storage** | SQLite (via `better-sqlite3`) |
| **Trasporto** | STDIO (compatibile Claude Desktop, Cursor, VS Code) |
| **Build** | pnpm workspaces + Turborepo |

---

## Architettura

```
                    +------------------+
                    |   Claude Desktop |
                    |   Cursor / IDE   |
                    +--------+---------+
                             |
                        STDIO Transport
                             |
              +--------------+--------------+
              |                             |
    +---------v---------+       +-----------v-----------+
    |   MCP Server #1   |       |    MCP Server #2      |
    |   (scrum-board)   |       |    (time-tracking)    |
    +---------+---------+       +-----------+-----------+
              |                             |
              +---------- EventBus ---------+
              |         (pub/sub)           |
              v                             v
    +--------------------+       +--------------------+
    |    SQLite DB       |       |    SQLite DB       |
    |  scrum-board.db    |       |  time-tracking.db  |
    +--------------------+       +--------------------+
```

Ogni server e indipendente e puo essere avviato singolarmente. Quando condividono lo stesso EventBus, collaborano automaticamente scambiandosi eventi tipizzati.

---

## I 22 Server

### Produttivita e Codice

| Server | Tool | Descrizione |
|--------|------|-------------|
| **code-review** | 3 | Analisi diff, complessita ciclomatica, suggerimenti di miglioramento |
| **dependency-manager** | 3 | Vulnerabilita, dipendenze inutilizzate, audit licenze |
| **project-scaffolding** | 3 | Generazione progetti da template (Node.js, Express, React, MCP) |

### DevOps e Infrastruttura

| Server | Tool | Descrizione |
|--------|------|-------------|
| **docker-compose** | 4 | Parsing YAML, analisi Dockerfile, generazione compose |
| **log-analyzer** | 4 | Analisi log, pattern di errore, tail, summary |
| **cicd-monitor** | 4 | Monitoraggio GitHub Actions, log, test flaky |

### Database e Dati

| Server | Tool | Descrizione |
|--------|------|-------------|
| **db-schema-explorer** | 4 | Esplorazione schema SQLite, suggerimento indici, ERD Mermaid |
| **data-mock-generator** | 4 | Generazione dati mock in JSON, CSV con 16 generatori |

### Documentazione

| Server | Tool | Descrizione |
|--------|------|-------------|
| **api-documentation** | 3 | Estrazione endpoint Express/NestJS, generazione OpenAPI 3.0 |
| **codebase-knowledge** | 4 | Ricerca codice, analisi moduli, mappa architettura, grafo dipendenze |

### Testing e Qualita

| Server | Tool | Descrizione |
|--------|------|-------------|
| **test-generator** | 3 | Generazione test unitari, edge case, analisi coverage |
| **performance-profiler** | 3 | Analisi bundle, bottleneck, benchmark comparativi |

### Utility

| Server | Tool | Descrizione |
|--------|------|-------------|
| **regex-builder** | 5 | Costruzione, test, spiegazione, ottimizzazione regex |
| **http-client** | 3 | Richieste HTTP, confronto risposte, generazione curl |
| **snippet-manager** | 5 | Gestione snippet con tag, ricerca, storage SQLite |

### Project Management (Scrum/Agile)

| Server | Tool | Descrizione |
|--------|------|-------------|
| **scrum-board** | 7 | Sprint, user story, task, board Kanban |
| **agile-metrics** | 4 | Velocity, burndown, cycle time, forecast Monte Carlo |
| **time-tracking** | 4 | Timer, log manuale, timesheet |
| **project-economics** | 4 | Budget, costi, forecast burn rate |
| **retrospective-manager** | 5 | Retro (mad-sad-glad, 4Ls, start-stop-continue), voti, action item |

### Comunicazione

| Server | Tool | Descrizione |
|--------|------|-------------|
| **standup-notes** | 3 | Standup giornalieri, storico, report di stato |
| **environment-manager** | 5 | Gestione file .env, confronto, validazione, template |

---

## Quick Start

### Prerequisiti

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0

### Installazione

```bash
# Clona il repository
git clone https://github.com/user/mcp-suite.git
cd mcp-suite

# Installa le dipendenze
pnpm install

# Build di tutti i pacchetti e server
pnpm build
```

### Configurazione Claude Desktop

Aggiungi uno o piu server al file di configurazione di Claude Desktop:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "scrum-board": {
      "command": "node",
      "args": ["/percorso/a/mcp-suite/servers/scrum-board/dist/index.js"]
    },
    "time-tracking": {
      "command": "node",
      "args": ["/percorso/a/mcp-suite/servers/time-tracking/dist/index.js"]
    },
    "code-review": {
      "command": "node",
      "args": ["/percorso/a/mcp-suite/servers/code-review/dist/index.js"]
    }
  }
}
```

### Avvio manuale di un singolo server

```bash
# Avvia un server specifico
node servers/scrum-board/dist/index.js

# Oppure usa la CLI
npx @mcp-suite/cli start scrum-board
```

---

## Struttura del Progetto

```
mcp-suite/
├── packages/                  # Librerie condivise
│   ├── core/                  # Factory server, tipi, config, logger
│   ├── event-bus/             # Pub/sub tipizzato con 29 eventi
│   ├── client-manager/        # Chiamate server-to-server
│   ├── database/              # Wrapper SQLite + migrazioni
│   ├── testing/               # Mock transport e event bus per test
│   └── cli/                   # CLI: start, list, status
│
├── servers/                   # 22 MCP Server
│   ├── scrum-board/           # Hub centrale project management
│   ├── time-tracking/         # Tracciamento tempo
│   ├── ...                    # (altri 20 server)
│   └── environment-manager/   # Gestione .env
│
├── docs/                      # Documentazione completa
├── pnpm-workspace.yaml        # Configurazione workspace
├── turbo.json                 # Build orchestration
└── tsconfig.base.json         # Config TypeScript condivisa
```

Ogni server segue una struttura uniforme:

```
servers/<nome>/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts               # Entry point
    ├── server.ts              # Factory e registrazione tool
    ├── tools/                 # Un file per tool
    ├── services/              # Business logic e store (opzionale)
    └── collaboration.ts       # Event handler cross-server (opzionale)
```

---

## Collaborazione Inter-Server

I server comunicano attraverso un **EventBus tipizzato** con 29 eventi definiti. Quando un server esegue un'azione significativa (es. creazione sprint, log tempo), pubblica un evento che altri server possono sottoscrivere.

```
scrum-board                          agile-metrics
     |                                     |
     |-- scrum:sprint-completed ---------> |  (aggiorna velocity)
     |-- scrum:task-updated -------------> |  (calcola cycle time)
     |                                     |
time-tracking                      project-economics
     |                                     |
     |-- time:entry-logged --------------> |  (converte in costo)
```

Vedi [docs/14-collaborazione-inter-server/](docs/14-collaborazione-inter-server/) per la matrice completa.

---

## Comandi Utili

```bash
# Build completo
pnpm build

# Build solo pacchetti condivisi
pnpm build:packages

# Build solo server
pnpm build:servers

# Build un singolo server
pnpm --filter @mcp-suite/server-scrum-board build

# Type check
pnpm typecheck

# Formattazione codice
pnpm format

# Pulizia
pnpm clean
```

---

## Tecnologie

- **TypeScript** - Tipizzazione statica end-to-end
- **Model Context Protocol (MCP)** - Standard aperto di Anthropic per la comunicazione tool-AI
- **pnpm** - Package manager veloce con supporto workspace
- **Turborepo** - Build orchestration con caching
- **SQLite** (better-sqlite3) - Storage locale senza configurazione
- **Zod** - Validazione schema a runtime
- **Node.js EventEmitter** - Event bus in-process

---

## Documentazione

La documentazione completa e nella cartella [`docs/`](docs/):

| Sezione | Contenuto |
|---------|-----------|
| [01 - Introduzione a MCP](docs/01-introduzione-mcp/) | Teoria del protocollo, concetti fondamentali |
| [02 - Architettura](docs/02-architettura/) | Design del monorepo, pattern, decisioni |
| [03 - Installazione](docs/03-installazione/) | Guida passo-passo per Windows, macOS, Linux |
| [04 - Configurazione](docs/04-configurazione/) | Claude Desktop, variabili ambiente, trasporti |
| [05 - Pacchetti Condivisi](docs/05-pacchetti-condivisi/) | Core, EventBus, Database, Testing, CLI |
| [06 - Server Produttivita](docs/06-server-produttivita/) | code-review, dependency-manager, project-scaffolding |
| [07 - Server DevOps](docs/07-server-devops/) | docker-compose, log-analyzer, cicd-monitor |
| [08 - Server Database](docs/08-server-database/) | db-schema-explorer, data-mock-generator |
| [09 - Server Documentazione](docs/09-server-documentazione/) | api-documentation, codebase-knowledge |
| [10 - Server Testing](docs/10-server-testing/) | test-generator, performance-profiler |
| [11 - Server Utility](docs/11-server-utility/) | regex-builder, http-client, snippet-manager |
| [12 - Server Project Management](docs/12-server-project-management/) | scrum-board, agile-metrics, time-tracking, economics, retro |
| [13 - Server Comunicazione](docs/13-server-comunicazione/) | standup-notes, environment-manager |
| [14 - Collaborazione Inter-Server](docs/14-collaborazione-inter-server/) | EventBus, matrice eventi, pattern |
| [15 - Sviluppi Futuri](docs/15-sviluppi-futuri/) | Roadmap, contributi, idee |

---

## Licenza

MIT

---

## Contribuire

I contributi sono benvenuti! Vedi [docs/15-sviluppi-futuri/](docs/15-sviluppi-futuri/) per la roadmap e le aree dove serve aiuto.

1. Fai fork del repository
2. Crea un branch (`git checkout -b feature/nuova-feature`)
3. Committa le modifiche (`git commit -m 'Aggiungi nuova feature'`)
4. Pusha il branch (`git push origin feature/nuova-feature`)
5. Apri una Pull Request
