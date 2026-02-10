# Event-Driven Architecture

## Introduzione

Quando hai piu' server MCP che operano nello stesso dominio, nasce l'esigenza di coordinamento. L'architettura event-driven permette ai server di comunicare in modo disaccoppiato: un server pubblica un evento, altri server reagiscono senza conoscersi direttamente.

---

## Il Problema del Coordinamento

Immagina due server: `time-tracking` (traccia ore lavorate) e `project-economics` (gestisce budget). Quando si logga del tempo, il budget dovrebbe aggiornarsi. Senza eventi:

```
  ACCOPPIAMENTO DIRETTO (da evitare)

  time-tracking                    project-economics
       |                                  |
       |  ── import e chiamata diretta -> |
       |     store.updateBudget(...)      |
       |                                  |

  I server si conoscono e dipendono l'uno dall'altro.
  Aggiungere un terzo server richiede modificare time-tracking.
```

Con un event bus:

```
  DISACCOPPIAMENTO VIA EVENTI

  time-tracking          EventBus                    project-economics
       |                    |                               |
       |  ── publish ──>    |                               |
       |   "time:logged"    |  ── deliver ────────────────> |
       |                    |   "time:logged"               |
       |                    |                               |
       |                    |      retrospective-manager    |
       |                    |           |                   |
       |                    |  ── deliver ────────────────> |
       |                    |   "time:logged"               |
```

I server non si conoscono. Il time-tracking pubblica un evento e non sa chi lo riceve. Aggiungere un nuovo subscriber non richiede modifiche al publisher.

---

## Interfaccia EventBus

Definisci un'interfaccia astratta per il bus:

```typescript
// bus.ts

export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;
export type PatternHandler = (event: string, payload: unknown) => void | Promise<void>;

export interface EventBus {
  /** Pubblica un evento con il suo payload */
  publish(event: string, payload: unknown): Promise<void>;

  /** Sottoscriviti a un evento specifico */
  subscribe(event: string, handler: EventHandler): () => void;

  /** Sottoscriviti con pattern wildcard (es. "time:*") */
  subscribePattern(pattern: string, handler: PatternHandler): () => void;

  /** Rimuovi tutte le sottoscrizioni */
  clear(): void;
}
```

Il metodo `subscribe` ritorna una funzione di unsubscribe, utile per il cleanup.

---

## Implementazione Locale (In-Process)

Per server che girano nello stesso processo, un EventEmitter di Node.js basta:

```typescript
// local-bus.ts

import { EventEmitter } from "node:events";
import micromatch from "micromatch";
import type { EventBus, EventHandler, PatternHandler } from "./bus.js";

interface PatternSubscription {
  pattern: string;
  handler: PatternHandler;
}

export class LocalEventBus implements EventBus {
  private emitter = new EventEmitter();
  private patternSubs: PatternSubscription[] = [];

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  async publish(event: string, payload: unknown): Promise<void> {
    // Notifica subscriber esatti
    this.emitter.emit(event, payload);

    // Notifica subscriber pattern
    for (const sub of this.patternSubs) {
      if (micromatch.isMatch(event, sub.pattern)) {
        try {
          await sub.handler(event, payload);
        } catch {
          // Errori nei subscriber non bloccano la pubblicazione
        }
      }
    }
  }

  subscribe(event: string, handler: EventHandler): () => void {
    this.emitter.on(event, handler);
    return () => this.emitter.off(event, handler);
  }

  subscribePattern(pattern: string, handler: PatternHandler): () => void {
    const sub: PatternSubscription = { pattern, handler };
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

`micromatch` supporta glob pattern: `"time:*"` matcha `"time:logged"`, `"time:anomaly"`, etc. Il pattern `"*"` matcha qualsiasi evento.

---

## Type-Safety sugli Eventi

Definisci una mappa di eventi tipizzati:

```typescript
// events.ts

export interface EventMap {
  // Time tracking
  "time:entry-logged": {
    taskId: string;
    durationMinutes: number;
    userId?: string;
  };
  "time:anomaly-detected": {
    type: string;
    description: string;
    userId?: string;
  };

  // Project economics
  "economics:budget-alert": {
    projectName: string;
    percentageUsed: number;
    severity: "warning" | "critical";
  };
  "economics:cost-updated": {
    projectName: string;
    totalSpent: number;
  };

  // Sprint
  "scrum:sprint-completed": {
    sprintName: string;
    completedPoints: number;
    totalPoints: number;
  };
}

export type EventName = keyof EventMap;
export type EventPayload<E extends EventName> = EventMap[E];
```

Rendi l'interfaccia EventBus type-safe:

```typescript
export interface TypedEventBus {
  publish<E extends EventName>(event: E, payload: EventPayload<E>): Promise<void>;
  subscribe<E extends EventName>(event: E, handler: (payload: EventPayload<E>) => void): () => void;
  subscribePattern(pattern: string, handler: PatternHandler): () => void;
  clear(): void;
}
```

Ora il compilatore verifica che ogni `publish()` invii il payload corretto:

```typescript
// Corretto: payload matcha EventMap["time:entry-logged"]
eventBus.publish("time:entry-logged", {
  taskId: "TASK-1",
  durationMinutes: 60,
});

// Errore TypeScript: 'durationMinutes' mancante
eventBus.publish("time:entry-logged", {
  taskId: "TASK-1",
});
```

---

## Wiring: Pubblicazione negli Handler dei Tool

Il pattern standard e' passare `eventBus` opzionale ai tool:

```typescript
// tools/log-time.ts

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EventBus } from "../bus.js";
import type { TimeStore } from "../services/time-store.js";
import { z } from "zod";

export function registerLogTime(
  server: McpServer,
  store: TimeStore,
  eventBus?: EventBus,   // Opzionale: funziona anche senza
): void {
  server.tool(
    "log-time",
    "Registra tempo lavorato su un task",
    {
      taskId: z.string(),
      durationMinutes: z.number().int().positive(),
    },
    async ({ taskId, durationMinutes }) => {
      try {
        const entry = store.logTime({ taskId, durationMinutes });

        // Fire-and-forget: pubblica l'evento senza attendere i subscriber
        eventBus?.publish("time:entry-logged", {
          taskId,
          durationMinutes,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(entry, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Errore: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        };
      }
    },
  );
}
```

### Pattern Fire-and-Forget

```typescript
eventBus?.publish("time:entry-logged", payload);
```

- `?.` (optional chaining): se `eventBus` e' `undefined`, non fa nulla
- Non si usa `await`: la pubblicazione non deve rallentare il tool
- Errori nei subscriber sono catturati dal bus, mai propagati al tool

---

## Collaboration Handlers

I server che reagiscono agli eventi definiscono i loro handler in un file `collaboration.ts`:

```typescript
// collaboration.ts

import type { EventBus } from "../bus.js";
import type { EconomicsStore } from "../services/economics-store.js";

export function setupCollaborationHandlers(
  eventBus: EventBus,
  store: EconomicsStore,
): void {
  // Quando il time-tracking logga tempo, aggiorna i costi
  eventBus.subscribe("time:entry-logged", (payload) => {
    const data = payload as {
      taskId: string;
      durationMinutes: number;
    };
    const hourlyRate = 50; // Default rate
    const cost = (data.durationMinutes / 60) * hourlyRate;
    store.addLaborCost(data.taskId, cost);
  });

  // Quando uno sprint finisce, salva una snapshot per analisi
  eventBus.subscribe("scrum:sprint-completed", (payload) => {
    const data = payload as {
      sprintName: string;
      completedPoints: number;
    };
    store.saveSprintSnapshot(data.sprintName, data.completedPoints);
  });
}
```

### Wiring nella Server Factory

```typescript
// server.ts

export function createProjectEconomicsServer(options?: {
  eventBus?: EventBus;
  storeOptions?: { inMemory?: boolean };
}) {
  const server = new McpServer({
    name: "project-economics",
    version: "1.0.0",
  });

  const store = new EconomicsStore(options?.storeOptions);

  registerSetBudget(server, store);
  registerLogCost(server, store, options?.eventBus);

  // Attiva la collaborazione solo se c'e' un event bus
  if (options?.eventBus) {
    setupCollaborationHandlers(options.eventBus, store);
  }

  return { server, store };
}
```

---

## Pattern Wildcard: Workflow Orchestrator

Il pattern `subscribePattern("*", handler)` permette di intercettare tutti gli eventi. E' il cuore di un workflow orchestrator:

```typescript
// Il workflow orchestrator ascolta TUTTI gli eventi
eventBus.subscribePattern("*", async (event, payload) => {
  // Cerca workflow il cui trigger matcha questo evento
  const workflows = store.getActiveWorkflowsByTrigger(event);

  for (const workflow of workflows) {
    // Verifica le condizioni del trigger
    if (matchesConditions(workflow.triggerConditions, payload)) {
      await executeWorkflow(workflow, payload);
    }
  }
});
```

---

## MockEventBus per i Test

Per i test, usa un bus che registra gli eventi pubblicati:

```typescript
export class MockEventBus implements EventBus {
  public published: Array<{ event: string; payload: unknown }> = [];

  async publish(event: string, payload: unknown): Promise<void> {
    this.published.push({ event, payload });
  }

  subscribe(): () => void {
    return () => {};
  }

  subscribePattern(): () => void {
    return () => {};
  }

  clear(): void {
    this.published = [];
  }

  // Utility per asserzioni
  wasPublished(eventName: string): boolean {
    return this.published.some((e) => e.event === eventName);
  }

  getPublishedEvents(eventName: string) {
    return this.published.filter((e) => e.event === eventName);
  }
}
```

Test:

```typescript
it("should publish time:entry-logged event", async () => {
  const eventBus = new MockEventBus();
  const { server } = createTimeTrackingServer({ eventBus, storeOptions: { inMemory: true } });
  const harness = await createTestHarness(server);

  await harness.client.callTool({
    name: "log-time",
    arguments: { taskId: "TASK-1", durationMinutes: 60 },
  });

  expect(eventBus.wasPublished("time:entry-logged")).toBe(true);
  const events = eventBus.getPublishedEvents("time:entry-logged");
  expect(events[0].payload).toEqual({
    taskId: "TASK-1",
    durationMinutes: 60,
  });
});
```

---

## Riepilogo

In questo capitolo hai imparato:

1. Perche' l'architettura event-driven e' essenziale per server multipli
2. Come implementare un EventBus locale con EventEmitter + micromatch
3. Type-safety sugli eventi con EventMap tipizzata
4. Il pattern fire-and-forget per pubblicare eventi dai tool
5. Collaboration handlers per reagire agli eventi di altri server
6. Pattern wildcard per orchestratori
7. MockEventBus per testing

**Prossimo**: [Comunicazione Cross-Server](./08-cross-server.md)
