# @mcp-suite/event-bus

## Introduzione

Il pacchetto `@mcp-suite/event-bus` implementa un sistema di eventi tipizzato per la collaborazione inter-server. Definisce 29 eventi organizzati per dominio, un'interfaccia `EventBus` generica e un'implementazione locale basata su `EventEmitter` di Node.js con supporto per pattern matching tramite `micromatch`.

```
packages/event-bus/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts      # Re-export dei moduli pubblici
    ├── bus.ts         # Interfaccia EventBus, tipi handler
    ├── events.ts      # EventMap con tutti i 29 eventi tipizzati
    └── local-bus.ts   # LocalEventBus (implementazione in-process)
```

**Dipendenze:**
- `micromatch` - Pattern matching per wildcard (es. `scrum:*`)

---

## Interfaccia EventBus

L'interfaccia `EventBus` definisce il contratto per qualsiasi implementazione del bus di eventi:

```typescript
export interface EventBus {
  /**
   * Pubblica un evento tipizzato.
   * Il payload e fortemente tipizzato in base al nome dell'evento.
   */
  publish<E extends EventName>(event: E, payload: EventPayload<E>): Promise<void>;

  /**
   * Sottoscrivi un handler a un evento specifico.
   * Restituisce una funzione per cancellare la sottoscrizione.
   */
  subscribe<E extends EventName>(event: E, handler: EventHandler<E>): () => void;

  /**
   * Sottoscrivi un handler a eventi che corrispondono a un pattern.
   * Es: "scrum:*" corrisponde a tutti gli eventi del dominio scrum.
   * Restituisce una funzione per cancellare la sottoscrizione.
   */
  subscribePattern(pattern: string, handler: PatternHandler): () => void;

  /**
   * Rimuovi tutte le sottoscrizioni.
   */
  clear(): void;
}
```

### Tipi degli Handler

```typescript
// Handler per un evento specifico (riceve il payload tipizzato)
export type EventHandler<E extends EventName> = (
  payload: EventPayload<E>
) => void | Promise<void>;

// Handler per pattern (riceve nome evento e payload generico)
export type PatternHandler = (
  event: string,
  payload: unknown
) => void | Promise<void>;
```

---

## EventMap: Tutti i 29 Eventi Tipizzati

L'`EventMap` e un'interfaccia TypeScript che mappa ogni nome evento al suo payload tipizzato. Gli eventi sono organizzati per dominio usando il prefisso `dominio:azione`.

### Diagramma dei Domini

```
EventMap (29 eventi)
│
├── code:*              (3 eventi)  ── Code & Git
├── cicd:*              (2 eventi)  ── CI/CD
├── scrum:*             (4 eventi)  ── Scrum / Project Management
├── time:*              (2 eventi)  ── Time Tracking
├── db:*                (2 eventi)  ── Database
├── test:*              (2 eventi)  ── Testing
├── docs:*              (2 eventi)  ── Documentazione
├── perf:*              (2 eventi)  ── Performance
├── retro:*             (2 eventi)  ── Retrospettive
├── economics:*         (2 eventi)  ── Economia Progetto
└── standup:*           (1 evento)  ── Standup
```

### Tabella Completa degli Eventi

| Evento | Payload | Emesso da |
|--------|---------|-----------|
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
| **Documentazione** | | |
| `docs:api-updated` | `endpoint`, `method`, `changes` | api-documentation |
| `docs:stale-detected` | `filePath`, `lastUpdated`, `reason` | api-documentation |
| **Performance** | | |
| `perf:bottleneck-found` | `location`, `metric`, `value`, `threshold` | performance-profiler |
| `perf:profile-completed` | `target`, `durationMs`, `results` | performance-profiler |
| **Retrospettive** | | |
| `retro:action-item-created` | `retroId`, `item`, `assignee`, `dueDate?` | retrospective-manager |
| `retro:completed` | `sprintId`, `retroId`, `actionItems`, `participants` | retrospective-manager |
| **Economics** | | |
| `economics:budget-alert` | `project`, `percentUsed`, `threshold`, `remaining` | project-economics |
| `economics:cost-updated` | `category`, `amount`, `totalSpent` | project-economics |
| **Standup** | | |
| `standup:report-generated` | `userId`, `date`, `tasksDone`, `tasksInProgress`, `blockers` | standup-notes |

### Tipi derivati

```typescript
// Nome di qualsiasi evento valido
export type EventName = keyof EventMap;
// => 'code:commit-analyzed' | 'code:review-completed' | ... (29 valori)

// Payload tipizzato per un evento specifico
export type EventPayload<E extends EventName> = EventMap[E];
// EventPayload<'scrum:sprint-started'> => { sprintId: string; name: string; ... }
```

---

## LocalEventBus: Implementazione In-Process

La `LocalEventBus` e l'implementazione predefinita, ideale per l'uso locale dove ogni server gira come processo separato (con il proprio EventBus) o quando piu server condividono lo stesso processo.

```typescript
import { EventEmitter } from 'node:events';
import micromatch from 'micromatch';

export class LocalEventBus implements EventBus {
  private emitter = new EventEmitter();
  private patternSubs: PatternSubscription[] = [];

  constructor() {
    this.emitter.setMaxListeners(100);  // Evita warning per troppi listener
  }

  async publish<E extends EventName>(event: E, payload: EventPayload<E>): Promise<void> {
    // 1. Emetti per subscriber diretti
    this.emitter.emit(event, payload);

    // 2. Verifica pattern subscriber
    for (const sub of this.patternSubs) {
      if (micromatch.isMatch(event, sub.pattern)) {
        try {
          await sub.handler(event, payload);
        } catch {
          // Gli errori degli handler sono catturati silenziosamente
          // per non interrompere la pubblicazione
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

## Come Pubblicare Eventi (Pattern Fire-and-Forget)

I tool pubblicano eventi usando l'operatore optional chaining (`?.`) per gestire il caso in cui l'EventBus non sia presente:

```typescript
export function registerCreateSprint(
  server: McpServer,
  store: ScrumStore,
  eventBus?: EventBus,     // <-- parametro opzionale
): void {
  server.tool('create-sprint', '...', { /* schema */ },
    async ({ name, startDate, endDate, goals }) => {
      const sprint = store.createSprint({ name, startDate, endDate, goals });

      // Fire-and-forget: pubblica e non attende risposta
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

**Il pattern fire-and-forget garantisce:**
- Se `eventBus` e `undefined`, nessuna operazione viene eseguita
- Se `eventBus` esiste ma nessuno ascolta, l'evento e emesso senza effetto
- Il tool non attende mai il completamento degli handler degli eventi
- Errori negli handler non propagano al tool

---

## Come Sottoscrivere Eventi

### Sottoscrizione a un evento specifico

```typescript
// Nel file collaboration.ts di un server
export function setupCollaborationHandlers(eventBus: EventBus, store: ScrumStore): void {
  eventBus.subscribe('retro:action-item-created', (payload) => {
    // payload e tipizzato: { retroId, item, assignee, dueDate? }
    console.log(`Nuovo action item: ${payload.item} assegnato a ${payload.assignee}`);
  });
}
```

### Sottoscrizione con pattern wildcard

```typescript
// Ascolta tutti gli eventi del dominio scrum
eventBus.subscribePattern('scrum:*', (eventName, payload) => {
  console.log(`Evento scrum ricevuto: ${eventName}`, payload);
});

// Ascolta tutti gli eventi di completamento
eventBus.subscribePattern('*:*-completed', (eventName, payload) => {
  console.log(`Completamento: ${eventName}`, payload);
});
```

### Cancellare una sottoscrizione

Sia `subscribe` che `subscribePattern` restituiscono una funzione di unsubscribe:

```typescript
const unsubscribe = eventBus.subscribe('scrum:task-updated', (payload) => {
  // ...
});

// Piu tardi, per cancellare la sottoscrizione:
unsubscribe();
```

---

## Pattern Matching con Wildcard

La libreria `micromatch` supporta i seguenti pattern:

| Pattern | Corrisponde a | Esempio |
|---------|---------------|---------|
| `scrum:*` | Tutti gli eventi scrum | `scrum:sprint-started`, `scrum:task-updated` |
| `code:*` | Tutti gli eventi code | `code:commit-analyzed`, `code:review-completed` |
| `*:*-completed` | Tutti gli eventi di completamento | `scrum:sprint-completed`, `retro:completed` |
| `*:*-alert` | Tutti gli alert | `code:dependency-alert`, `economics:budget-alert` |
| `{scrum,time}:*` | Eventi scrum o time | `scrum:task-updated`, `time:entry-logged` |

---

## Flusso degli Eventi: Esempio Completo

```
┌──────────────────┐                              ┌──────────────────┐
│   scrum-board    │                              │  agile-metrics   │
│                  │                              │                  │
│  tool: update-   │  publish('scrum:task-        │  subscribe(      │
│  task-status     │  updated', {                 │  'scrum:*',      │
│                  │    taskId: '42',             │   handler        │
│                  │    previousStatus: 'todo',   │  )               │
│                  │    newStatus: 'done'         │                  │
│                  │  })                          │  => Ricalcola    │
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
                       │  => Aggiorna    │
                       │     report      │
                       └─────────────────┘
```

---

## Futuro: RedisEventBus

Per deployment distribuiti dove i server girano su processi o macchine diverse, e prevista un'implementazione `RedisEventBus` che usa Redis Pub/Sub:

```typescript
// Futuro - non ancora implementato
export class RedisEventBus implements EventBus {
  // Usa Redis Pub/Sub per comunicazione cross-process
  // Stessa interfaccia EventBus, diverso trasporto
}
```

La configurazione per il futuro e gia predisposta nello schema:

```typescript
eventBus: z.object({
  type: z.enum(['local', 'redis']).default('local'),
  redisUrl: z.string().optional(),
})
```

Quando sara disponibile, bastera cambiare:
```bash
MCP_SUITE_EVENT_BUS_TYPE=redis
MCP_SUITE_REDIS_URL=redis://localhost:6379
```
