# Architecture Overview

## Introduction

MCP Suite is a TypeScript monorepo that brings together **22 MCP servers** and **6 shared packages** in a single codebase managed with **pnpm workspaces** and **Turborepo**. The architecture was designed with two main goals: **server independence** (each server is autonomous and independently deployable) and **optional collaboration** (servers can exchange events through a typed EventBus).

---

## Monorepo Structure

```
mcp-suite/
├── package.json              # Root: global scripts, engine constraints
├── pnpm-workspace.yaml       # Defines packages/* and servers/* as workspaces
├── turbo.json                # Build pipeline with Turborepo
├── tsconfig.base.json        # Shared TypeScript configuration
│
├── packages/                 # Shared libraries (6 packages)
│   ├── core/                 #   Server factory, config, logger, errors, types
│   ├── event-bus/            #   Typed EventBus with 29 events
│   ├── database/             #   SQLite connection + migrations
│   ├── testing/              #   Test harness + MockEventBus
│   ├── cli/                  #   CLI for managing servers
│   └── client-manager/       #   MCP client pool for server-to-server communication
│
├── servers/                  # 22 independent MCP servers
│   ├── scrum-board/          #   Sprint, story, task management
│   ├── standup-notes/        #   Daily standup notes
│   ├── time-tracking/        #   Time tracking
│   ├── agile-metrics/        #   Agile metrics (velocity, burndown)
│   ├── code-review/          #   Code analysis and review
│   ├── test-generator/       #   Automatic test generation
│   ├── cicd-monitor/         #   CI/CD pipeline monitoring
│   ├── docker-compose/       #   Docker Compose management
│   ├── db-schema-explorer/   #   Database schema exploration
│   ├── dependency-manager/   #   Project dependency management
│   ├── api-documentation/    #   API documentation
│   ├── codebase-knowledge/   #   Code knowledge base
│   ├── data-mock-generator/  #   Mock data generation
│   ├── environment-manager/  #   Environment variable management
│   ├── http-client/          #   HTTP client for API testing
│   ├── log-analyzer/         #   Application log analysis
│   ├── performance-profiler/ #   Performance profiling
│   ├── project-economics/    #   Project economics (budget, costs)
│   ├── project-scaffolding/  #   New project scaffolding
│   ├── regex-builder/        #   Regular expression building
│   ├── retrospective-manager/#   Agile retrospective management
│   └── snippet-manager/      #   Code snippet library
│
└── docs/                     # Project documentation
```

---

## Layered Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Claude Desktop, Cursor, VS Code)     │
│              Communicates via STDIO or HTTP (JSON-RPC / Streamable) │
└─────────────┬──────────────────────────────────────┬────────────────┘
              │                                      │
              ▼                                      ▼
┌──────────────────────┐                ┌──────────────────────┐
│   scrum-board        │                │   time-tracking      │
│   ┌──────────────┐   │   EventBus     │   ┌──────────────┐   │
│   │  tools/      │   │◄──────────────►│   │  tools/      │   │
│   │  services/   │   │  (optional)    │   │  services/   │   │
│   │  server.ts   │   │                │   │  server.ts   │   │
│   │  index.ts    │   │                │   │  index.ts    │   │
│   └──────────────┘   │                │   └──────────────┘   │
└──────────┬───────────┘                └──────────┬───────────┘
           │                                       │
           ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         PACKAGES (shared libraries)                 │
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
│  │ - list      │  │ - client pool │                                 │
│  │ - start     │  │ - callTool    │                                 │
│  │ - status    │  │ - readResource│                                 │
│  └─────────────┘  └───────────────┘                                 │
└─────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  @modelcontextprotocol/sdk        better-sqlite3          zod       │
│  (official MCP protocol)         (native database)     (validation) │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Design Decisions

### Why TypeScript?

- **End-to-end type-safety**: types defined in `@mcp-suite/core` are shared across all servers, ensuring compile-time consistency
- **Native ESM**: target ES2022 with `"module": "Node16"` for native compatibility with modern Node.js
- **Declaration maps**: each package generates `.d.ts` and `.d.ts.map`, enabling "Go to Definition" across the entire monorepo
- **Strict mode**: `"strict": true` in `tsconfig.base.json` for maximum safety

### Why SQLite (better-sqlite3)?

- **Zero configuration**: no database server to install or manage
- **File-based**: each server has its own `.db` file in `~/.mcp-suite/data/`
- **Synchronous**: `better-sqlite3` uses synchronous C++ bindings, ideal for fast local operations
- **WAL mode**: Write-Ahead Logging enabled for optimal concurrent read performance
- **Portable**: the database is moved simply by copying the file

### Transports: STDIO and HTTP

MCP Suite supports two transports, selectable via configuration (`MCP_SUITE_TRANSPORT`):

**STDIO** (default) - Ideal for local use:
- No ports to open, no network conflicts
- Local communication, no network exposure
- Compatible with Claude Desktop, Cursor, and VS Code
- Each server instance is a separate process

**HTTP (Streamable HTTP)** - For remote deployments and inter-server communication:
- Each server exposes an HTTP endpoint on a dedicated port
- MCP Streamable HTTP protocol (stateful mode with session UUID)
- Standard routes: `POST/GET/DELETE /mcp` + `GET /health`
- Required for Client Manager Wiring (cross-server tool calls)
- Suitable for deployment on remote servers, containers, and horizontal scaling

### Why a Monorepo?

- **Code sharing**: packages in `packages/` are shared without publishing to npm
- **Atomic builds**: Turborepo ensures the correct build order with `dependsOn: ["^build"]`
- **Unified versioning**: all packages and servers evolve together
- **Superior DX**: a single `pnpm install`, a single `pnpm build` for everything

---

## The Server Pattern

Each server follows a strict 4-layer structure:

```
servers/server-name/
├── package.json        # Dependencies and scripts
├── tsconfig.json       # Extends tsconfig.base.json
└── src/
    ├── index.ts        # Entry point: creates EventBus, starts the server
    ├── server.ts       # Factory: createXxxServer() -> McpSuiteServer
    ├── tools/          # One file per tool, registerXxx() function
    │   ├── create-sprint.ts
    │   ├── get-sprint.ts
    │   └── ...
    ├── services/       # SQLite store and business logic
    │   └── scrum-store.ts
    └── collaboration.ts  # Handler for events from other servers (optional)
```

| Layer | Responsibility | Dependencies |
|-------|---------------|------------|
| `index.ts` | Bootstrap: creates EventBus, calls factory, starts transport | `@mcp-suite/core`, `@mcp-suite/event-bus` |
| `server.ts` | Creates `McpSuiteServer`, instantiates store, registers tools | `@mcp-suite/core`, services, tools |
| `tools/` | Single tool definition with Zod schema and handler | `@modelcontextprotocol/sdk`, services |
| `services/` | SQLite persistence, domain logic | `@mcp-suite/database` |
| `collaboration.ts` | Cross-server event subscriptions | `@mcp-suite/event-bus` |

---

## The McpSuiteServer Interface

Each server is represented by the `McpSuiteServer` interface, the central contract of the architecture:

```typescript
export interface McpSuiteServer {
  server: McpServer;      // MCP server instance (official SDK)
  config: ServerConfig;   // Loaded configuration (transport, port, logLevel, ...)
  logger: Logger;         // Structured logger on stderr
  eventBus?: EventBus;    // Optional EventBus for collaboration
}
```

This interface is created by the `createMcpServer()` factory and passed to all tool registration functions. The `eventBus` field is **optional**: if present, tools can publish events; if absent, tools operate in standalone mode.

---

## Inter-Server Collaboration

Servers are **independent by default** but can **collaborate via EventBus**:

```
┌────────────────┐    publish('scrum:task-updated')   ┌────────────────┐
│  scrum-board   │ ─────────────────────────────────► │  agile-metrics │
│                │                                    │                │
│  Updates a     │    publish('time:entry-logged')    │  Recalculates  │
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

Collaboration happens through two complementary channels:

**EventBus (Pub/Sub)** - Asynchronous notifications:
- Optional, fire-and-forget: `eventBus?.publish(...)`
- Typed: the `EventMap` defines 29 events with strongly typed payloads
- 13 servers publish events, 6 have collaboration handlers

**Client Manager (RPC)** - Synchronous queries:
- Direct tool-to-tool calls: `clientManager.callTool('target', 'tool', args)`
- 6 scenarios implemented (5 calling servers, 3 target servers)
- Graceful degradation: works even without the target available
- Documentation: [Client Manager Wiring](../14-inter-server-collaboration/04-client-manager-wiring.md)

---

## Build Flow

Turborepo manages the dependency graph and parallelizes builds:

```
pnpm build
    │
    ├── @mcp-suite/event-bus      (no internal dependencies)
    ├── @mcp-suite/core           (depends on event-bus)
    ├── @mcp-suite/database       (depends on core)
    ├── @mcp-suite/testing        (depends on core, event-bus)
    ├── @mcp-suite/client-manager (depends on core)
    ├── @mcp-suite/cli            (depends on core, event-bus, client-manager)
    │
    └── servers/* (all depend on core, event-bus, database)
        ├── scrum-board
        ├── standup-notes
        ├── time-tracking
        └── ... (other 19 servers in parallel)
```

The `"dependsOn": ["^build"]` directive in `turbo.json` ensures that packages are compiled before the servers that use them.
