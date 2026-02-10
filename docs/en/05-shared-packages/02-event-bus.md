# @mcp-suite/event-bus

## Introduction

The `@mcp-suite/event-bus` package implements a typed event system for inter-server collaboration. It defines 29 events organized by domain, a generic `EventBus` interface, and a local implementation based on Node.js `EventEmitter` with pattern matching support via `micromatch`.

```
packages/event-bus/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts      # Re-export of public modules
    ├── bus.ts         # EventBus interface, handler types
    ├── events.ts      # EventMap with all 29 typed events
    └── local-bus.ts   # LocalEventBus (in-process implementation)
```

**Dependencies:**
- `micromatch` - Pattern matching for wildcards (e.g. `scrum:*`)

---

## EventBus Interface

The `EventBus` interface defines the contract for any event bus implementation:

```typescript
export interface EventBus {
  /**
   * Publishes a typed event.
   * The payload is strongly typed based on the event name.
   */
  publish<E extends EventName>(event: E, payload: EventPayload<E>): Promise<void>;

  /**
   * Subscribe a handler to a specific event.
   * Returns a function to cancel the subscription.
   */
  subscribe<E extends EventName>(event: E, handler: EventHandler<E>): () => void;

  /**
   * Subscribe a handler to events matching a pattern.
   * E.g.: "scrum:*" matches all events in the scrum domain.
   * Returns a function to cancel the subscription.
   */
  subscribePattern(pattern: string, handler: PatternHandler): () => void;

  /**
   * Remove all subscriptions.
   */
  clear(): void;
}
```

### Handler Types

```typescript
// Handler for a specific event (receives the typed payload)
export type EventHandler<E extends EventName> = (
  payload: EventPayload<E>
) => void | Promise<void>;

// Handler for patterns (receives event name and generic payload)
export type PatternHandler = (
  event: string,
  payload: unknown
) => void | Promise<void>;
```

---

## EventMap: All 29 Typed Events

The `EventMap` is a TypeScript interface that maps each event name to its typed payload. Events are organized by domain using the `domain:action` prefix.

### Domain Diagram

```
EventMap (29 events)
│
├── code:*              (3 events)  ── Code & Git
├── cicd:*              (2 events)  ── CI/CD
├── scrum:*             (4 events)  ── Scrum / Project Management
├── time:*              (2 events)  ── Time Tracking
├── db:*                (2 events)  ── Database
├── test:*              (2 events)  ── Testing
├── docs:*              (2 events)  ── Documentation
├── perf:*              (2 events)  ── Performance
├── retro:*             (2 events)  ── Retrospectives
├── economics:*         (2 events)  ── Project Economics
└── standup:*           (1 event)   ── Standup
```

### Complete Event Table

| Event | Payload | Emitted by |
|-------|---------|------------|
| **Code & Git** | | |
| `code:commit-analyzed` | `commitHash`, `files`, `stats` | codebase-knowledge |
| `code:review-completed` | `files`, `issues`, `suggestions` | code-review |
| `code:dependency-alert` | `package`, `severity`, `advisory` | dependency-manager |
| **CI/CD** | | |
| `cicd:pipeline-completed` | `pipelineId`, `status`, `branch`, `duration` | cicd-monitor |
| `cicd:build-failed` | `pipelineId`, `error`, `stage`, `branch` | cicd-monitor |
| **Scrum** | | |
| `scrum:sprint-started` | `sprintId`, `name`, `startDate`, `endDate` | scrum-board |
| `scrum:sprint-completed` | `sprintId`, `name`, `velocity`, `completedStories`, `incompleteStories` | scrum-board |
| `scrum:task-updated` | `taskId`, `previousStatus`, `newStatus`, `assignee?`, `sprintId?` | scrum-board |
| `scrum:story-completed` | `storyId`, `title`, `storyPoints`, `sprintId` | scrum-board |
| **Time Tracking** | | |
| `time:entry-logged` | `taskId`, `userId`, `minutes`, `date` | time-tracking |
| `time:timesheet-generated` | `userId`, `period`, `totalHours` | time-tracking |
| **Database** | | |
| `db:schema-changed` | `database`, `table`, `changeType` | db-schema-explorer |
| `db:index-suggestion` | `database`, `table`, `columns`, `reason` | db-schema-explorer |
| **Testing** | | |
| `test:generated` | `filePath`, `testCount`, `framework` | test-generator |
| `test:coverage-report` | `filePath`, `coverage`, `uncoveredLines` | test-generator |
| **Documentation** | | |
| `docs:api-updated` | `endpoint`, `method`, `changes` | api-documentation |
| `docs:stale-detected` | `filePath`, `lastUpdated`, `reason` | api-documentation |
| **Performance** | | |
| `perf:bottleneck-found` | `location`, `metric`, `value`, `threshold` | performance-profiler |
| `perf:profile-completed` | `target`, `durationMs`, `results` | performance-profiler |
| **Retrospectives** | | |
| `retro:action-item-created` | `retroId`, `item`, `assignee`, `dueDate?` | retrospective-manager |
| `retro:completed` | `sprintId`, `retroId`, `actionItems`, `participants` | retrospective-manager |
| **Economics** | | |
| `economics:budget-alert` | `project`, `percentUsed`, `threshold`, `remaining` | project-economics |
| `economics:cost-updated` | `category`, `amount`, `totalSpent` | project-economics |
| **Standup** | | |
| `standup:report-generated` | `userId`, `date`, `tasksDone`, `tasksInProgress`, `blockers` | standup-notes |

### Derived Types

```typescript
// Name of any valid event
export type EventName = keyof EventMap;
// => 'code:commit-analyzed' | 'code:review-completed' | ... (29 values)

// Typed payload for a specific event
export type EventPayload<E extends EventName> = EventMap[E];
// EventPayload<'scrum:sprint-started'> => { sprintId: string; name: string; ... }
```

---

## LocalEventBus: In-Process Implementation

The `LocalEventBus` is the default implementation, ideal for local use where each server runs as a separate process (with its own EventBus) or when multiple servers share the same process.

```typescript
import { EventEmitter } from 'node:events';
import micromatch from 'micromatch';

export class LocalEventBus implements EventBus {
  private emitter = new EventEmitter();
  private patternSubs: PatternSubscription[] = [];

  constructor() {
    this.emitter.setMaxListeners(100);  // Avoid warning for too many listeners
  }

  async publish<E extends EventName>(event: E, payload: EventPayload<E>): Promise<void> {
    // 1. Emit for direct subscribers
    this.emitter.emit(event, payload);

    // 2. Check pattern subscribers
    for (const sub of this.patternSubs) {
      if (micromatch.isMatch(event, sub.pattern)) {
        try {
          await sub.handler(event, payload);
        } catch {
          // Handler errors are silently caught
          // to avoid interrupting publication
        }
      }
    }
  }

  subscribe<E extends EventName>(event: E, handler: EventHandler<E>): () => void {
    this.emitter.on(event, handler);
    return () => { this.emitter.off(event, handler); };
  }

  subscribePattern(pattern: string, handler: PatternHandler): () => void {
    const sub = { pattern, handler };
    this.patternSubs.push(sub);
    return () => {
      const index = this.patternSubs.indexOf(sub);
      if (index >= 0) this.patternSubs.splice(index, 1);
    };
  }

  clear(): void {
    this.emitter.removeAllListeners();
    this.patternSubs = [];
  }
}
```

---

## How to Publish Events (Fire-and-Forget Pattern)

Tools publish events using the optional chaining operator (`?.`) to handle the case where the EventBus is not present:

```typescript
export function registerCreateSprint(
  server: McpServer,
  store: ScrumStore,
  eventBus?: EventBus,     // <-- optional parameter
): void {
  server.tool('create-sprint', '...', { /* schema */ },
    async ({ name, startDate, endDate, goals }) => {
      const sprint = store.createSprint({ name, startDate, endDate, goals });

      // Fire-and-forget: publish and don't wait for a response
      eventBus?.publish('scrum:sprint-started', {
        sprintId: String(sprint.id),
        name: sprint.name,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
      });

      return { content: [{ type: 'text', text: JSON.stringify(sprint, null, 2) }] };
    },
  );
}
```

**The fire-and-forget pattern guarantees:**
- If `eventBus` is `undefined`, no operation is performed
- If `eventBus` exists but nobody is listening, the event is emitted with no effect
- The tool never waits for event handler completion
- Handler errors do not propagate to the tool

---

## How to Subscribe to Events

### Subscribing to a specific event

```typescript
// In a server's collaboration.ts file
export function setupCollaborationHandlers(eventBus: EventBus, store: ScrumStore): void {
  eventBus.subscribe('retro:action-item-created', (payload) => {
    // payload is typed: { retroId, item, assignee, dueDate? }
    console.log(`New action item: ${payload.item} assigned to ${payload.assignee}`);
  });
}
```

### Subscribing with wildcard patterns

```typescript
// Listen to all scrum domain events
eventBus.subscribePattern('scrum:*', (eventName, payload) => {
  console.log(`Scrum event received: ${eventName}`, payload);
});

// Listen to all completion events
eventBus.subscribePattern('*:*-completed', (eventName, payload) => {
  console.log(`Completion: ${eventName}`, payload);
});
```

### Cancelling a subscription

Both `subscribe` and `subscribePattern` return an unsubscribe function:

```typescript
const unsubscribe = eventBus.subscribe('scrum:task-updated', (payload) => {
  // ...
});

// Later, to cancel the subscription:
unsubscribe();
```

---

## Wildcard Pattern Matching

The `micromatch` library supports the following patterns:

| Pattern | Matches | Example |
|---------|---------|---------|
| `scrum:*` | All scrum events | `scrum:sprint-started`, `scrum:task-updated` |
| `code:*` | All code events | `code:commit-analyzed`, `code:review-completed` |
| `*:*-completed` | All completion events | `scrum:sprint-completed`, `retro:completed` |
| `*:*-alert` | All alerts | `code:dependency-alert`, `economics:budget-alert` |
| `{scrum,time}:*` | Scrum or time events | `scrum:task-updated`, `time:entry-logged` |

---

## Event Flow: Complete Example

```
┌──────────────────┐                              ┌──────────────────┐
│   scrum-board    │                              │  agile-metrics   │
│                  │                              │                  │
│  tool: update-   │  publish('scrum:task-        │  subscribe(      │
│  task-status     │  updated', {                 │  'scrum:*',      │
│                  │    taskId: '42',             │   handler        │
│                  │    previousStatus: 'todo',   │  )               │
│                  │    newStatus: 'done'         │                  │
│                  │  })                          │  => Recalculate  │
│                  │            │                 │     velocity     │
└──────────────────┘            │                 └──────────────────┘
                                │
                       ┌────────▼────────┐
                       │    EventBus     │
                       │  (LocalEventBus)│
                       │                 │
                       │  emitter.emit() │
                       │  + pattern check│
                       └────────┬────────┘
                                │
                       ┌────────▼────────┐
                       │  standup-notes  │
                       │                 │
                       │  subscribe(     │
                       │  'scrum:task-   │
                       │   updated',     │
                       │   handler       │
                       │  )              │
                       │                 │
                       │  => Update      │
                       │     report      │
                       └─────────────────┘
```

---

## Future: RedisEventBus

For distributed deployments where servers run on different processes or machines, a `RedisEventBus` implementation using Redis Pub/Sub is planned:

```typescript
// Future - not yet implemented
export class RedisEventBus implements EventBus {
  // Uses Redis Pub/Sub for cross-process communication
  // Same EventBus interface, different transport
}
```

The configuration for this is already prepared in the schema:

```typescript
eventBus: z.object({
  type: z.enum(['local', 'redis']).default('local'),
  redisUrl: z.string().optional(),
})
```

When available, it will be enough to change:
```bash
MCP_SUITE_EVENT_BUS_TYPE=redis
MCP_SUITE_REDIS_URL=redis://localhost:6379
```
