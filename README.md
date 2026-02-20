[Italiano](#mcp-suite) | [English](#mcp-suite-en)

---

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
│   ├── it/                    # Documentazione in italiano
│   └── en/                    # Documentation in English
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

Vedi [docs/it/14-collaborazione-inter-server/](docs/it/14-collaborazione-inter-server/) per la matrice completa.

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

La documentazione completa e disponibile in due lingue:

### Italiano ([docs/it/](docs/it/))

| Sezione | Contenuto |
|---------|-----------|
| [01 - Introduzione a MCP](docs/it/01-introduzione-mcp/) | Teoria del protocollo, concetti fondamentali |
| [02 - Architettura](docs/it/02-architettura/) | Design del monorepo, pattern, decisioni |
| [03 - Installazione](docs/it/03-installazione/) | Guida passo-passo per Windows, macOS, Linux |
| [04 - Configurazione](docs/it/04-configurazione/) | Claude Desktop, variabili ambiente, trasporti |
| [05 - Pacchetti Condivisi](docs/it/05-pacchetti-condivisi/) | Core, EventBus, Database, Testing, CLI |
| [06 - Server Produttivita](docs/it/06-server-produttivita/) | code-review, dependency-manager, project-scaffolding |
| [07 - Server DevOps](docs/it/07-server-devops/) | docker-compose, log-analyzer, cicd-monitor |
| [08 - Server Database](docs/it/08-server-database/) | db-schema-explorer, data-mock-generator |
| [09 - Server Documentazione](docs/it/09-server-documentazione/) | api-documentation, codebase-knowledge |
| [10 - Server Testing](docs/it/10-server-testing/) | test-generator, performance-profiler |
| [11 - Server Utility](docs/it/11-server-utility/) | regex-builder, http-client, snippet-manager |
| [12 - Server Project Management](docs/it/12-server-project-management/) | scrum-board, agile-metrics, time-tracking, economics, retro |
| [13 - Server Comunicazione](docs/it/13-server-comunicazione/) | standup-notes, environment-manager |
| [14 - Collaborazione Inter-Server](docs/it/14-collaborazione-inter-server/) | EventBus, matrice eventi, pattern |
| [15 - Sviluppi Futuri](docs/it/15-sviluppi-futuri/) | Roadmap, contributi, idee |
| [16 - Guida Creazione Server/Client](docs/it/16-guida-creazione-server-client/) | Tutorial completo dalla teoria alla produzione |

### English ([docs/en/](docs/en/))

| Section | Content |
|---------|---------|
| [01 - Introduction to MCP](docs/en/01-introduction-to-mcp/) | Protocol theory, core concepts |
| [02 - Architecture](docs/en/02-architecture/) | Monorepo design, patterns, decisions |
| [03 - Installation](docs/en/03-installation/) | Step-by-step guide for Windows, macOS, Linux |
| [04 - Configuration](docs/en/04-configuration/) | Claude Desktop, environment variables, transports |
| [05 - Shared Packages](docs/en/05-shared-packages/) | Core, EventBus, Database, Testing, CLI |
| [06 - Productivity Servers](docs/en/06-productivity-servers/) | code-review, dependency-manager, project-scaffolding |
| [07 - DevOps Servers](docs/en/07-devops-servers/) | docker-compose, log-analyzer, cicd-monitor |
| [08 - Database Servers](docs/en/08-database-servers/) | db-schema-explorer, data-mock-generator |
| [09 - Documentation Servers](docs/en/09-documentation-servers/) | api-documentation, codebase-knowledge |
| [10 - Testing Servers](docs/en/10-testing-servers/) | test-generator, performance-profiler |
| [11 - Utility Servers](docs/en/11-utility-servers/) | regex-builder, http-client, snippet-manager |
| [12 - Project Management Servers](docs/en/12-project-management-servers/) | scrum-board, agile-metrics, time-tracking, economics, retro |
| [13 - Communication Servers](docs/en/13-communication-servers/) | standup-notes, environment-manager |
| [14 - Inter-Server Collaboration](docs/en/14-inter-server-collaboration/) | EventBus, event matrix, patterns |
| [15 - Future Developments](docs/en/15-future-developments/) | Roadmap, contributions, ideas |
| [16 - Server/Client Creation Guide](docs/en/16-server-client-creation-guide/) | Complete tutorial from theory to production |

---

## Licenza

Questo progetto e distribuito sotto la **GNU Affero General Public License v3.0 (AGPL-3.0)**.

Questo significa che:
- Puoi usare, modificare e distribuire liberamente questo software
- Qualsiasi modifica o lavoro derivato **deve** essere rilasciato sotto la stessa licenza AGPL-3.0
- Se esegui una versione modificata come **servizio di rete** (SaaS), devi rendere disponibile il codice sorgente agli utenti di quel servizio
- Devi mantenere le note di copyright e licenza in tutte le copie

Vedi il file [LICENSE](LICENSE) per il testo completo della licenza.

---

## Contribuire

I contributi sono benvenuti! Questo progetto cresce grazie alla community.

### Setup ambiente di sviluppo

```bash
# Fai fork e clona il repository
git clone https://github.com/<tuo-utente>/mcp-suite.git
cd mcp-suite

# Installa le dipendenze
pnpm install

# Esegui la build completa
pnpm build

# Esegui i test
pnpm test
```

### Come contribuire

- **Segnalare bug**: apri una [issue](https://github.com/user/mcp-suite/issues) con una descrizione chiara, i passi per riprodurre il problema e il comportamento atteso
- **Proporre feature**: apri una issue descrivendo la funzionalita, il caso d'uso e l'approccio proposto
- **Inviare codice**: segui il processo PR descritto sotto

### Processo Pull Request

1. Fai fork del repository
2. Crea un branch dal `master`:
   - `feature/nome-feature` per nuove funzionalita
   - `fix/nome-bug` per bug fix
3. Scrivi codice seguendo le convenzioni del progetto
4. Aggiungi o aggiorna i test per le tue modifiche
5. Assicurati che `pnpm build` e `pnpm test` passino
6. Committa con messaggi chiari e descrittivi
7. Pusha il branch e apri una Pull Request

### Convenzioni codice

- **TypeScript** strict mode ovunque
- Ogni server segue la struttura uniforme: `index.ts`, `server.ts`, `tools/`, `services/`, `collaboration.ts`
- Pattern **EventBus**: parametro opzionale `eventBus?: EventBus`, pubblicazione fire-and-forget con `eventBus?.publish()`
- Pattern **ClientManager**: parametro opzionale `clientManager?: McpClientManager` per chiamate cross-server
- Validazione input con **Zod**
- Storage con **SQLite** via `better-sqlite3`

### Aggiungere un nuovo server

Consulta la [Guida alla Creazione di Server/Client](docs/it/16-guida-creazione-server-client/) per un tutorial completo dalla teoria alla produzione.

### Codice di condotta

- Tratta tutti i partecipanti con rispetto e professionalita 
- Collaborazione costruttiva: feedback orientato al miglioramento
- Nessuna discriminazione di alcun tipo
- Mantieni le discussioni focalizzate sul progetto

### Nota sulla licenza

Inviando una Pull Request, accetti che i tuoi contributi saranno distribuiti sotto la licenza **AGPL-3.0**, alle stesse condizioni del progetto principale.

---
---

<a id="mcp-suite-en"></a>

# MCP Suite (EN)

**A complete suite of 22 MCP (Model Context Protocol) servers for developer productivity.**

MCP Suite is a TypeScript monorepo that provides intelligent tools for every aspect of the software development lifecycle: from code management to Scrum/Agile project management, from project economics to everyday utilities. All servers communicate with each other through a typed event system.

---

## Overview

| Info | Value |
|------|-------|
| **MCP Servers** | 22 |
| **Total Tools** | 85+ |
| **Shared Packages** | 6 |
| **Typed Events** | 29 |
| **Language** | TypeScript |
| **SDK** | `@modelcontextprotocol/sdk` v1.x |
| **Storage** | SQLite (via `better-sqlite3`) |
| **Transport** | STDIO (compatible with Claude Desktop, Cursor, VS Code) |
| **Build** | pnpm workspaces + Turborepo |

---

## Architecture

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

Each server is independent and can be started individually. When they share the same EventBus, they automatically collaborate by exchanging typed events.

---

## The 22 Servers

### Productivity & Code

| Server | Tools | Description |
|--------|-------|-------------|
| **code-review** | 3 | Diff analysis, cyclomatic complexity, improvement suggestions |
| **dependency-manager** | 3 | Vulnerabilities, unused dependencies, license audit |
| **project-scaffolding** | 3 | Project generation from templates (Node.js, Express, React, MCP) |

### DevOps & Infrastructure

| Server | Tools | Description |
|--------|-------|-------------|
| **docker-compose** | 4 | YAML parsing, Dockerfile analysis, compose generation |
| **log-analyzer** | 4 | Log analysis, error patterns, tail, summary |
| **cicd-monitor** | 4 | GitHub Actions monitoring, logs, flaky tests |

### Database & Data

| Server | Tools | Description |
|--------|-------|-------------|
| **db-schema-explorer** | 4 | SQLite schema exploration, index suggestions, Mermaid ERD |
| **data-mock-generator** | 4 | Mock data generation in JSON, CSV with 16 generators |

### Documentation

| Server | Tools | Description |
|--------|-------|-------------|
| **api-documentation** | 3 | Express/NestJS endpoint extraction, OpenAPI 3.0 generation |
| **codebase-knowledge** | 4 | Code search, module analysis, architecture map, dependency graph |

### Testing & Quality

| Server | Tools | Description |
|--------|-------|-------------|
| **test-generator** | 3 | Unit test generation, edge cases, coverage analysis |
| **performance-profiler** | 3 | Bundle analysis, bottlenecks, comparative benchmarks |

### Utility

| Server | Tools | Description |
|--------|-------|-------------|
| **regex-builder** | 5 | Build, test, explain, optimize regex |
| **http-client** | 3 | HTTP requests, response comparison, curl generation |
| **snippet-manager** | 5 | Snippet management with tags, search, SQLite storage |

### Project Management (Scrum/Agile)

| Server | Tools | Description |
|--------|-------|-------------|
| **scrum-board** | 7 | Sprints, user stories, tasks, Kanban board |
| **agile-metrics** | 4 | Velocity, burndown, cycle time, Monte Carlo forecast |
| **time-tracking** | 4 | Timer, manual logging, timesheet |
| **project-economics** | 4 | Budget, costs, burn rate forecast |
| **retrospective-manager** | 5 | Retros (mad-sad-glad, 4Ls, start-stop-continue), votes, action items |

### Communication

| Server | Tools | Description |
|--------|-------|-------------|
| **standup-notes** | 3 | Daily standups, history, status reports |
| **environment-manager** | 5 | .env file management, comparison, validation, templates |

---

## Quick Start

### Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0

### Installation

```bash
# Clone the repository
git clone https://github.com/user/mcp-suite.git
cd mcp-suite

# Install dependencies
pnpm install

# Build all packages and servers
pnpm build
```

### Claude Desktop Configuration

Add one or more servers to the Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "scrum-board": {
      "command": "node",
      "args": ["/path/to/mcp-suite/servers/scrum-board/dist/index.js"]
    },
    "time-tracking": {
      "command": "node",
      "args": ["/path/to/mcp-suite/servers/time-tracking/dist/index.js"]
    },
    "code-review": {
      "command": "node",
      "args": ["/path/to/mcp-suite/servers/code-review/dist/index.js"]
    }
  }
}
```

### Manually Starting a Single Server

```bash
# Start a specific server
node servers/scrum-board/dist/index.js

# Or use the CLI
npx @mcp-suite/cli start scrum-board
```

---

## Project Structure

```
mcp-suite/
├── packages/                  # Shared libraries
│   ├── core/                  # Server factory, types, config, logger
│   ├── event-bus/             # Typed pub/sub with 29 events
│   ├── client-manager/        # Server-to-server calls
│   ├── database/              # SQLite wrapper + migrations
│   ├── testing/               # Mock transport and event bus for tests
│   └── cli/                   # CLI: start, list, status
│
├── servers/                   # 22 MCP Servers
│   ├── scrum-board/           # Central project management hub
│   ├── time-tracking/         # Time tracking
│   ├── ...                    # (20 more servers)
│   └── environment-manager/   # .env management
│
├── docs/                      # Full documentation
│   ├── it/                    # Documentazione in italiano
│   └── en/                    # Documentation in English
├── pnpm-workspace.yaml        # Workspace configuration
├── turbo.json                 # Build orchestration
└── tsconfig.base.json         # Shared TypeScript config
```

Each server follows a uniform structure:

```
servers/<name>/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts               # Entry point
    ├── server.ts              # Factory and tool registration
    ├── tools/                 # One file per tool
    ├── services/              # Business logic and store (optional)
    └── collaboration.ts       # Cross-server event handlers (optional)
```

---

## Inter-Server Collaboration

Servers communicate through a **typed EventBus** with 29 defined events. When a server performs a significant action (e.g., sprint creation, time logging), it publishes an event that other servers can subscribe to.

```
scrum-board                          agile-metrics
     |                                     |
     |-- scrum:sprint-completed ---------> |  (updates velocity)
     |-- scrum:task-updated -------------> |  (calculates cycle time)
     |                                     |
time-tracking                      project-economics
     |                                     |
     |-- time:entry-logged --------------> |  (converts to cost)
```

See [docs/en/14-inter-server-collaboration/](docs/en/14-inter-server-collaboration/) for the complete matrix.

---

## Useful Commands

```bash
# Full build
pnpm build

# Build shared packages only
pnpm build:packages

# Build servers only
pnpm build:servers

# Build a single server
pnpm --filter @mcp-suite/server-scrum-board build

# Type check
pnpm typecheck

# Code formatting
pnpm format

# Clean
pnpm clean
```

---

## Technologies

- **TypeScript** - End-to-end static typing
- **Model Context Protocol (MCP)** - Anthropic's open standard for tool-AI communication
- **pnpm** - Fast package manager with workspace support
- **Turborepo** - Build orchestration with caching
- **SQLite** (better-sqlite3) - Zero-configuration local storage
- **Zod** - Runtime schema validation
- **Node.js EventEmitter** - In-process event bus

---

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

This means:
- You can freely use, modify, and distribute this software
- Any modifications or derivative works **must** be released under the same AGPL-3.0 license
- If you run a modified version as a **network service** (SaaS), you must make the source code available to users of that service
- You must retain copyright and license notices in all copies

See the [LICENSE](LICENSE) file for the full license text.

---

## Contributing

Contributions are welcome! This project grows thanks to its community.

### Development setup

```bash
# Fork and clone the repository
git clone https://github.com/<your-username>/mcp-suite.git
cd mcp-suite

# Install dependencies
pnpm install

# Run full build
pnpm build

# Run tests
pnpm test
```

### How to contribute

- **Report bugs**: open an [issue](https://github.com/user/mcp-suite/issues) with a clear description, steps to reproduce, and expected behavior
- **Propose features**: open an issue describing the feature, use case, and proposed approach
- **Submit code**: follow the PR process below

### Pull Request process

1. Fork the repository
2. Create a branch from `master`:
   - `feature/feature-name` for new features
   - `fix/bug-name` for bug fixes
3. Write code following the project conventions
4. Add or update tests for your changes
5. Make sure `pnpm build` and `pnpm test` pass
6. Commit with clear, descriptive messages
7. Push the branch and open a Pull Request

### Code conventions

- **TypeScript** strict mode everywhere
- Each server follows the uniform structure: `index.ts`, `server.ts`, `tools/`, `services/`, `collaboration.ts`
- **EventBus** pattern: optional `eventBus?: EventBus` parameter, fire-and-forget publishing with `eventBus?.publish()`
- **ClientManager** pattern: optional `clientManager?: McpClientManager` parameter for cross-server calls
- Input validation with **Zod**
- Storage with **SQLite** via `better-sqlite3`

### Adding a new server

See the [Server/Client Creation Guide](docs/en/16-server-client-creation-guide/) for a complete tutorial from theory to production.

### Code of conduct

- Treat all participants with respect and professionalism
- Constructive collaboration: feedback oriented toward improvement
- No discrimination of any kind
- Keep discussions focused on the project

### License note

By submitting a Pull Request, you agree that your contributions will be distributed under the **AGPL-3.0** license, under the same terms as the main project.
