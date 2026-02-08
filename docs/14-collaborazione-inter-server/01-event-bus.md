# EventBus: Il Sistema di Collaborazione Inter-Server

## Panoramica

L'**EventBus** e il meccanismo che permette ai 22 server MCP Suite di collaborare tra loro in modo asincrono e disaccoppiato. Quando un server esegue un'azione significativa (creazione sprint, log tempo, completamento build), pubblica un evento tipizzato che altri server possono sottoscrivere per reagire automaticamente.

```
Server A                    EventBus                    Server B
   |                           |                           |
   |-- publish(evento) ------->|                           |
   |                           |-- handler(payload) ------>|
   |                           |                           |
   |   (fire-and-forget)       |   (delivery garantita     |
   |                           |    in-process)            |
```

Questo pattern e noto come **Publish/Subscribe (Pub/Sub)** e offre vantaggi fondamentali:

- **Disaccoppiamento**: il publisher non conosce i subscriber
- **Estensibilita**: aggiungere un nuovo subscriber non richiede modifiche al publisher
- **Opzionalita**: l'EventBus e sempre opzionale; ogni server funziona perfettamente anche senza

---

## Architettura

### Interfaccia EventBus

L'interfaccia `EventBus` definisce il contratto per qualsiasi implementazione:

```typescript
interface EventBus {
  publish<E extends EventName>(event: E, payload: EventPayload<E>): Promise<void>;
  subscribe<E extends EventName>(event: E, handler: EventHandler<E>): () => void;
  subscribePattern(pattern: string, handler: PatternHandler): () => void;
  clear(): void;
}
```

| Metodo | Descrizione |
|--------|-------------|
| `publish` | Pubblica un evento tipizzato con il suo payload |
| `subscribe` | Sottoscrive a un evento specifico. Ritorna una funzione di unsubscribe |
| `subscribePattern` | Sottoscrive a eventi che matchano un pattern glob (es. `scrum:*`) |
| `clear` | Rimuove tutte le sottoscrizioni |

### LocalEventBus (Implementazione In-Process)

La classe `LocalEventBus` e l'implementazione predefinita, basata su Node.js `EventEmitter` con supporto pattern via `micromatch`:

```
LocalEventBus
  |
  +-- EventEmitter (per subscribe a eventi specifici)
  |
  +-- patternSubs[] (per subscribePattern con glob matching)
```

**Caratteristiche**:
- Max 100 listener per evento (configurato via `setMaxListeners`)
- Pattern matching via `micromatch` per wildcard (`scrum:*`, `*:completed`, ecc.)
- Errori nei pattern handler catturati silenziosamente per non interrompere la pubblicazione
- Zero dipendenze esterne oltre `micromatch`

### Tipizzazione Completa

Ogni evento e tipizzato sia nel nome che nel payload grazie a `EventMap`:

```typescript
// Il compilatore TypeScript verifica che il payload sia corretto
eventBus.publish('scrum:sprint-started', {
  sprintId: '42',
  name: 'Sprint 15',
  startDate: '2025-01-01',
  endDate: '2025-01-14',
});

// Errore di compilazione: manca il campo 'name'
eventBus.publish('scrum:sprint-started', {
  sprintId: '42',
});
```

---

## Pattern di Integrazione nei Server

### 1. Creazione dell'EventBus (index.ts)

Ogni server crea un'istanza di `LocalEventBus` nel suo entry point:

```typescript
// servers/<nome>/src/index.ts
import { LocalEventBus } from '@mcp-suite/event-bus';

const eventBus = new LocalEventBus();
const suite = createMyServer(eventBus);
```

### 2. Iniezione nel Server (server.ts)

Il server factory accetta l'EventBus opzionale e lo passa ai tool che ne hanno bisogno:

```typescript
// servers/<nome>/src/server.ts
export function createMyServer(eventBus?: EventBus): McpSuiteServer {
  const suite = createMcpServer({
    name: 'my-server',
    version: '0.1.0',
    eventBus,
  });

  const store = new MyStore();

  // Tool che pubblica eventi
  registerCreateItem(suite.server, store, suite.eventBus);

  // Tool read-only: non serve l'eventBus
  registerListItems(suite.server, store);

  // Collaboration handlers
  if (suite.eventBus) {
    setupCollaborationHandlers(suite.eventBus, store);
  }

  return suite;
}
```

### 3. Pubblicazione negli Handler dei Tool (tools/*.ts)

I tool che eseguono azioni mutanti pubblicano eventi dopo il successo:

```typescript
// servers/<nome>/src/tools/create-item.ts
export function registerCreateItem(
  server: McpServer,
  store: MyStore,
  eventBus?: EventBus,
): void {
  server.tool('create-item', 'Create a new item', schema, async (args) => {
    const item = store.create(args);

    // Fire-and-forget: eventBus puo essere undefined
    eventBus?.publish('domain:item-created', {
      itemId: item.id,
      // ...payload tipizzato
    });

    return { content: [{ type: 'text', text: JSON.stringify(item) }] };
  });
}
```

### 4. Sottoscrizione (collaboration.ts)

I server che reagiscono a eventi esterni hanno un file `collaboration.ts` dedicato:

```typescript
// servers/<nome>/src/collaboration.ts
export function setupCollaborationHandlers(
  eventBus: EventBus,
  store: MyStore,
): void {
  eventBus.subscribe('other-domain:event', (payload) => {
    // Reagisci all'evento
    store.updateSomething(payload);
  });
}
```

---

## Principi di Design

### Fire-and-Forget

La pubblicazione degli eventi usa il pattern fire-and-forget con optional chaining:

```typescript
eventBus?.publish('scrum:task-updated', payload);
```

- `?.` gestisce il caso in cui l'EventBus non e stato fornito
- Non si usa `await`: il tool non attende la fine della consegna
- Il fallimento di un subscriber non impatta il publisher

### Solo Tool Mutanti Pubblicano

| Tipo di Tool | Pubblica Eventi? | Esempio |
|-------------|-----------------|---------|
| Creazione | Si | `create-sprint`, `log-time` |
| Aggiornamento | Si | `update-task-status` |
| Cancellazione | Si | (quando implementati) |
| Lettura | No | `get-sprint`, `search-snippets` |
| Analisi | Dipende | `find-bottlenecks` si, `explain-regex` no |

### Collaborazione Isolata

La logica di reazione agli eventi e sempre in un file separato (`collaboration.ts`) e mai mischiata con i tool handler. Questo garantisce:

- Chiarezza su quali eventi un server sottoscrive
- Facilita di testing della logica di collaborazione
- Separazione tra logica di business del tool e logica inter-server

---

## Confronto con Alternative

| Caratteristica | EventBus (Pub/Sub) | Client Manager (RPC) | REST API |
|---------------|-------------------|---------------------|----------|
| Accoppiamento | Nessuno | Basso | Medio |
| Sincrono | No | Si | Si |
| Tipizzazione | Forte (EventMap) | Forte | Debole (HTTP) |
| Latenza | Microsec (in-process) | Millisecondi | Millisecondi |
| Persistenza | No (in-memory) | No | Dipende |
| Scalabilita | Redis per distribuito | N/A | Nativa |

L'EventBus e il canale preferito per **notifiche e reazioni automatiche**. Il [Client Manager](04-client-manager-wiring.md) e usato per **query sincrone** tra server (es. agile-metrics che chiede dati a scrum-board). Vedi la documentazione del [pacchetto client-manager](../05-pacchetti-condivisi/05-client-manager.md) per l'API e i dettagli di implementazione.
