# EventBus: The Inter-Server Collaboration System

## Overview

The **EventBus** is the mechanism that allows the 22 MCP Suite servers to collaborate with each other in an asynchronous and decoupled manner. When a server performs a significant action (sprint creation, time logging, build completion), it publishes a typed event that other servers can subscribe to in order to react automatically.

```
Server A                    EventBus                    Server B
   |                           |                           |
   |-- publish(event) -------->|                           |
   |                           |-- handler(payload) ------>|
   |                           |                           |
   |   (fire-and-forget)       |   (guaranteed delivery    |
   |                           |    in-process)            |
```

This pattern is known as **Publish/Subscribe (Pub/Sub)** and offers fundamental advantages:

- **Decoupling**: the publisher does not know about the subscribers
- **Extensibility**: adding a new subscriber does not require changes to the publisher
- **Optionality**: the EventBus is always optional; each server works perfectly even without it

---

## Architecture

### EventBus Interface

The `EventBus` interface defines the contract for any implementation:

```typescript
interface EventBus {
  publish<E extends EventName>(event: E, payload: EventPayload<E>): Promise<void>;
  subscribe<E extends EventName>(event: E, handler: EventHandler<E>): () => void;
  subscribePattern(pattern: string, handler: PatternHandler): () => void;
  clear(): void;
}
```

| Method | Description |
|--------|-------------|
| `publish` | Publishes a typed event with its payload |
| `subscribe` | Subscribes to a specific event. Returns an unsubscribe function |
| `subscribePattern` | Subscribes to events matching a glob pattern (e.g., `scrum:*`) |
| `clear` | Removes all subscriptions |

### LocalEventBus (In-Process Implementation)

The `LocalEventBus` class is the default implementation, based on Node.js `EventEmitter` with pattern support via `micromatch`:

```
LocalEventBus
  |
  +-- EventEmitter (for subscribing to specific events)
  |
  +-- patternSubs[] (for subscribePattern with glob matching)
```

**Features**:
- Max 100 listeners per event (configured via `setMaxListeners`)
- Pattern matching via `micromatch` for wildcards (`scrum:*`, `*:completed`, etc.)
- Errors in pattern handlers caught silently to avoid interrupting publication
- Zero external dependencies beyond `micromatch`

### Full Type Safety

Every event is typed in both name and payload thanks to `EventMap`:

```typescript
// The TypeScript compiler verifies the payload is correct
eventBus.publish('scrum:sprint-started', {
  sprintId: '42',
  name: 'Sprint 15',
  startDate: '2025-01-01',
  endDate: '2025-01-14',
});

// Compilation error: missing field 'name'
eventBus.publish('scrum:sprint-started', {
  sprintId: '42',
});
```

---

## Integration Patterns in Servers

### 1. Creating the EventBus (index.ts)

Each server creates a `LocalEventBus` instance in its entry point:

```typescript
// servers/<name>/src/index.ts
import { LocalEventBus } from '@mcp-suite/event-bus';

const eventBus = new LocalEventBus();
const suite = createMyServer(eventBus);
```

### 2. Injection into the Server (server.ts)

The server factory accepts the optional EventBus and passes it to the tools that need it:

```typescript
// servers/<name>/src/server.ts
export function createMyServer(eventBus?: EventBus): McpSuiteServer {
  const suite = createMcpServer({
    name: 'my-server',
    version: '0.1.0',
    eventBus,
  });

  const store = new MyStore();

  // Tool that publishes events
  registerCreateItem(suite.server, store, suite.eventBus);

  // Read-only tool: does not need the eventBus
  registerListItems(suite.server, store);

  // Collaboration handlers
  if (suite.eventBus) {
    setupCollaborationHandlers(suite.eventBus, store);
  }

  return suite;
}
```

### 3. Publishing in Tool Handlers (tools/*.ts)

Tools that perform mutating actions publish events after success:

```typescript
// servers/<name>/src/tools/create-item.ts
export function registerCreateItem(
  server: McpServer,
  store: MyStore,
  eventBus?: EventBus,
): void {
  server.tool('create-item', 'Create a new item', schema, async (args) => {
    const item = store.create(args);

    // Fire-and-forget: eventBus may be undefined
    eventBus?.publish('domain:item-created', {
      itemId: item.id,
      // ...typed payload
    });

    return { content: [{ type: 'text', text: JSON.stringify(item) }] };
  });
}
```

### 4. Subscription (collaboration.ts)

Servers that react to external events have a dedicated `collaboration.ts` file:

```typescript
// servers/<name>/src/collaboration.ts
export function setupCollaborationHandlers(
  eventBus: EventBus,
  store: MyStore,
): void {
  eventBus.subscribe('other-domain:event', (payload) => {
    // React to the event
    store.updateSomething(payload);
  });
}
```

---

## Design Principles

### Fire-and-Forget

Event publishing uses the fire-and-forget pattern with optional chaining:

```typescript
eventBus?.publish('scrum:task-updated', payload);
```

- `?.` handles the case where the EventBus was not provided
- `await` is not used: the tool does not wait for delivery to complete
- A subscriber failure does not impact the publisher

### Only Mutating Tools Publish

| Tool Type | Publishes Events? | Example |
|-----------|------------------|---------|
| Creation | Yes | `create-sprint`, `log-time` |
| Update | Yes | `update-task-status` |
| Deletion | Yes | (when implemented) |
| Read | No | `get-sprint`, `search-snippets` |
| Analysis | Depends | `find-bottlenecks` yes, `explain-regex` no |

### Isolated Collaboration

The event reaction logic is always in a separate file (`collaboration.ts`) and never mixed with tool handlers. This ensures:

- Clarity on which events a server subscribes to
- Easy testing of collaboration logic
- Separation between tool business logic and inter-server logic

---

## Comparison with Alternatives

| Feature | EventBus (Pub/Sub) | Client Manager (RPC) | REST API |
|---------|-------------------|---------------------|----------|
| Coupling | None | Low | Medium |
| Synchronous | No | Yes | Yes |
| Type Safety | Strong (EventMap) | Strong | Weak (HTTP) |
| Latency | Microsec (in-process) | Milliseconds | Milliseconds |
| Persistence | No (in-memory) | No | Depends |
| Scalability | Redis for distributed | N/A | Native |

The EventBus is the preferred channel for **notifications and automatic reactions**. The [Client Manager](04-client-manager-wiring.md) is used for **synchronous queries** between servers (e.g., agile-metrics requesting data from scrum-board). See the [client-manager package](../05-shared-packages/05-client-manager.md) documentation for the API and implementation details.
