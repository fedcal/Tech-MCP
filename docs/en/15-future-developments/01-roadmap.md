# Roadmap and Future Developments

## Overview

MCP Suite is an evolving project. The current structure (22 servers, 6 shared packages, EventBus wired) represents the functional core. This section describes the planned development areas, ordered by priority.

---

## Current Status

| Area | Status | Detail |
|------|--------|--------|
| 22 MCP Servers | Complete | All servers build and register their tools |
| 6 Shared Packages | Complete | core, event-bus, client-manager, database, testing, cli |
| EventBus Wiring | Complete | 13 servers publish, 6 have collaboration handlers |
| STDIO Transport | Complete | Compatible with Claude Desktop, Cursor, VS Code |
| Documentation | Complete | 15 sections in the docs/ folder |
| Testing | Complete | 300 Vitest tests, all 22 servers covered |
| SQLite Storage Layer | Complete | All 22 servers with SQLite persistence |
| HTTP Transport | Complete | STDIO + Streamable HTTP stateful, all 22 ports assigned |
| Client Manager Wiring | Complete | 6 cross-server scenarios, 5 wired servers, integration tests |
| Redis EventBus | To do | Only LocalEventBus (in-process) available |

---

## Priority 1: Testing

### Unit Tests with Vitest

The testing infrastructure is set up in the `@mcp-suite/testing` package with:
- `MockEventBus` for testing event publication/subscription
- `TestServer` for instantiating servers in-memory without STDIO

**What to test for each server:**

```
tests/
├── tools/
│   ├── create-sprint.test.ts      # Single tool test
│   ├── update-task-status.test.ts
│   └── ...
├── services/
│   └── scrum-store.test.ts        # Business logic test
├── collaboration.test.ts          # Event handler test
└── server.test.ts                 # Factory and registration test
```

**Example test with MockEventBus:**

```typescript
import { describe, it, expect } from 'vitest';
import { MockEventBus } from '@mcp-suite/testing';

describe('create-sprint', () => {
  it('should publish scrum:sprint-started event', async () => {
    const eventBus = new MockEventBus();
    const store = new ScrumStore();
    registerCreateSprint(server, store, eventBus);

    // Invoke the tool
    await callTool('create-sprint', { name: 'Sprint 1', ... });

    // Verify published event
    expect(eventBus.published).toContainEqual({
      event: 'scrum:sprint-started',
      payload: expect.objectContaining({ name: 'Sprint 1' }),
    });
  });
});
```

**Coverage goal:** at least one test for every tool and collaboration handler.

### Integration Tests

End-to-end tests that verify the complete flow:

1. Create a server with `InMemoryTransport`
2. Call a tool
3. Verify the result and published events
4. Verify that collaboration handlers react correctly

---

## Priority 2: Redis EventBus

### Motivation

`LocalEventBus` only works when all servers are in the same Node.js process. For real deployments where each server is a separate process, an external message broker is needed.

### Planned Architecture

```
Server A (Process 1)          Redis          Server B (Process 2)
       |                        |                    |
       |-- PUBLISH channel ---->|                    |
       |                        |-- message -------->|
       |                        |                    |
       |     Serialization      |   Deserialization  |
       |     JSON.stringify()   |   JSON.parse()     |
```

### Implementation

```typescript
// packages/event-bus/src/redis-bus.ts
import Redis from 'ioredis';

export class RedisEventBus implements EventBus {
  private pub: Redis;
  private sub: Redis;

  constructor(redisUrl: string) {
    this.pub = new Redis(redisUrl);
    this.sub = new Redis(redisUrl);
  }

  async publish<E extends EventName>(event: E, payload: EventPayload<E>): Promise<void> {
    await this.pub.publish(`mcp-suite:${event}`, JSON.stringify(payload));
  }

  subscribe<E extends EventName>(event: E, handler: EventHandler<E>): () => void {
    this.sub.subscribe(`mcp-suite:${event}`);
    const listener = (channel: string, message: string) => {
      if (channel === `mcp-suite:${event}`) {
        handler(JSON.parse(message));
      }
    };
    this.sub.on('message', listener);
    return () => this.sub.off('message', listener);
  }
  // ...
}
```

### Configuration

```bash
# Environment variable to enable Redis
MCP_SUITE_EVENT_BUS=redis
MCP_SUITE_REDIS_URL=redis://localhost:6379
```

---

## Priority 3: Client Manager Wiring (Completed)

Client Manager Wiring has been implemented with 6 cross-server scenarios involving 5 calling servers and 3 target servers. Each calling server uses `McpClientManager` to call tools on other servers synchronously, with graceful degradation (works even without clientManager).

Full documentation: [Client Manager Wiring](../14-inter-server-collaboration/04-client-manager-wiring.md) and [client-manager package](../05-shared-packages/05-client-manager.md).

---

## Priority 4: HTTP Transport (Completed)

The Streamable HTTP transport has been implemented in `@mcp-suite/core` through the `startHttpServer()` function. It uses the official SDK's MCP Streamable HTTP protocol with stateful mode (session UUID). Each server has a dedicated port configurable via environment variables.

Full documentation: [Core - startHttpServer](../05-shared-packages/01-core.md).

---

## Priority 5: Advanced Features

### MCP Resources and Prompts

Currently MCP Suite uses only the **Tools** primitive. The MCP specifications also define:

- **Resources**: Data exposed with URIs (`sprint://42`, `db://schema/users`). They would allow the AI to read data without calling tools.
- **Prompts**: Predefined templates that guide the AI in complex tasks. Example: a "sprint-review" prompt that suggests the sequence of tools to call.

### Web Dashboard

A web dashboard to visualize:
- Status of all servers
- Events published in real time
- Tool usage metrics
- Health checks

### Plugin System

Architecture for third-party plugins:
- Plugin registry
- Hot-reload of tools
- Shared marketplace

---

## How to Contribute

See the [Contributing](02-contributing.md) section for detailed guidelines.
