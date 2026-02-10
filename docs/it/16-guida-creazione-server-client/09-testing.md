# Testing Professionale

## Introduzione

Un server MCP professionale ha tre livelli di test: unit test sullo store, integration test sui tool via test harness, e wiring test per la comunicazione cross-server.

---

## Piramide dei Test MCP

```
                    /\
                   /  \
                  / W  \        Wiring Test
                 / I  R \       (cross-server con InMemoryTransport)
                /  I  I  \
               / N  N  G  \
              /────────────\
             /  INTEGRATION \   Tool Test
            / (test harness) \  (tool → store → risultato)
           /──────────────────\
          /                    \
         /      UNIT TEST       \  Store Test
        /    (store in-memory)   \ (logica pura, nessun MCP)
       /──────────────────────────\
```

| Livello | Cosa testa | Velocita' | Setup |
|---------|------------|-----------|-------|
| **Unit** | Metodi dello store | Velocissimo | Solo store in-memory |
| **Integration** | Tool end-to-end | Veloce | TestHarness + InMemoryTransport |
| **Wiring** | Cross-server reale | Medio | Piu' server + ClientManager |

---

## Unit Test dello Store

Testano la logica di persistenza isolata, senza MCP:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { NotesStore } from "../../src/services/notes-store.js";

describe("NotesStore", () => {
  let store: NotesStore;

  beforeEach(() => {
    // Ogni test ha un database fresco in-memory
    store = new NotesStore({ inMemory: true });
  });

  it("should add and retrieve a note", () => {
    const note = store.addNote({
      title: "Test",
      content: "Contenuto di test",
      tags: ["tag1", "tag2"],
    });

    expect(note.id).toBe(1);
    expect(note.title).toBe("Test");
    expect(note.tags).toEqual(["tag1", "tag2"]);

    const retrieved = store.getNote(1);
    expect(retrieved).toEqual(note);
  });

  it("should return undefined for non-existent note", () => {
    const note = store.getNote(999);
    expect(note).toBeUndefined();
  });

  it("should list notes ordered by updatedAt desc", () => {
    store.addNote({ title: "Prima", content: "A" });
    store.addNote({ title: "Seconda", content: "B" });
    store.addNote({ title: "Terza", content: "C" });

    const notes = store.listNotes();
    expect(notes).toHaveLength(3);
    expect(notes[0].title).toBe("Terza"); // Piu' recente
  });

  it("should handle UNIQUE constraint on title", () => {
    store.addNote({ title: "Unico", content: "A" });
    expect(() => store.addNote({ title: "Unico", content: "B" })).toThrow();
  });

  it("should delete a note and return true", () => {
    store.addNote({ title: "Da cancellare", content: "X" });
    expect(store.deleteNote(1)).toBe(true);
    expect(store.getNote(1)).toBeUndefined();
  });

  it("should return false when deleting non-existent note", () => {
    expect(store.deleteNote(999)).toBe(false);
  });

  it("should search notes by content", () => {
    store.addNote({ title: "JS", content: "Arrow functions e closures" });
    store.addNote({ title: "TS", content: "Tipi generici e interfacce" });

    const results = store.searchNotes("functions");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("JS");
  });

  it("should update note content", () => {
    store.addNote({ title: "Aggiornabile", content: "Vecchio" });
    const updated = store.updateNote(1, { content: "Nuovo" });
    expect(updated?.content).toBe("Nuovo");
  });
});
```

### Best Practice per Unit Test Store

- Usa `beforeEach` con `inMemory: true` per isolamento totale
- Testa CRUD completo: create, read, update, delete
- Testa edge case: record inesistente, constraint violati, filtri vuoti
- Testa serializzazione/deserializzazione JSON (array, oggetti)
- Non testare query SQL direttamente, testa il comportamento

---

## Integration Test dei Tool

Testano il tool end-to-end tramite il protocollo MCP, usando `createTestHarness()`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { createTestHarness, MockEventBus, type TestHarness } from "@mcp-suite/testing";
import { createNotesServer } from "../../src/server.js";

describe("add-note tool", () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) await harness.close();
  });

  it("should add a note and return it as JSON", async () => {
    const { server } = createNotesServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(server);

    const result = await harness.client.callTool({
      name: "add-note",
      arguments: {
        title: "Test Note",
        content: "Hello World",
        tags: ["test"],
      },
    });

    // Verifica formato risultato MCP
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].type).toBe("text");

    // Verifica contenuto
    const note = JSON.parse(content[0].text);
    expect(note.title).toBe("Test Note");
    expect(note.content).toBe("Hello World");
    expect(note.tags).toEqual(["test"]);
    expect(note.id).toBeDefined();
  });

  it("should return error for duplicate title", async () => {
    const { server } = createNotesServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(server);

    await harness.client.callTool({
      name: "add-note",
      arguments: { title: "Duplicato", content: "Primo" },
    });

    const result = await harness.client.callTool({
      name: "add-note",
      arguments: { title: "Duplicato", content: "Secondo" },
    });

    expect(result.isError).toBe(true);
  });

  it("should publish event when note is added", async () => {
    const eventBus = new MockEventBus();
    const { server } = createNotesServer({
      eventBus,
      storeOptions: { inMemory: true },
    });
    harness = await createTestHarness(server);

    await harness.client.callTool({
      name: "add-note",
      arguments: { title: "Evento", content: "Test" },
    });

    expect(eventBus.wasPublished("notes:created")).toBe(true);
    const events = eventBus.getPublishedEvents("notes:created");
    expect(events[0].payload).toMatchObject({ title: "Evento" });
  });
});
```

### createTestHarness()

Questa utility crea una coppia client-server collegata in-memory:

```typescript
export async function createTestHarness(server: McpServer): Promise<TestHarness> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1.0.0" });

  await server.connect(serverTransport);   // Server PRIMA
  await client.connect(clientTransport);    // Client DOPO

  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}
```

### Best Practice per Integration Test

- Testa il "happy path" e i casi di errore
- Verifica il formato del risultato MCP (content[0].type, isError)
- Verifica gli eventi pubblicati con MockEventBus
- Usa `afterEach` per chiudere il harness (evita leak di risorse)
- Non testare la logica dello store qui (gia' coperta dagli unit test)

---

## Wiring Test Cross-Server

Testano la comunicazione reale tra server:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { createTestHarness, type TestHarness } from "@mcp-suite/testing";
import { McpClientManager } from "@mcp-suite/client-manager";
import { createInsightEngineServer } from "../../src/server.js";
import { createAgileMetricsServer } from "../../../agile-metrics/src/server.js";

describe("insight-engine -> agile-metrics wiring", () => {
  let callerHarness: TestHarness;
  let clientManager: McpClientManager;

  afterEach(async () => {
    if (callerHarness) await callerHarness.close();
    if (clientManager) await clientManager.disconnectAll();
  });

  it("should fetch velocity from agile-metrics", async () => {
    // 1. Target server
    const targetSuite = createAgileMetricsServer({
      storeOptions: { inMemory: true },
    });

    // 2. Wire al ClientManager
    clientManager = new McpClientManager();
    const [ct, st] = McpClientManager.createInMemoryPair();
    await targetSuite.server.connect(st);
    await clientManager.connectInMemoryWithTransport("agile-metrics", ct);

    // 3. Caller server
    const callerSuite = createInsightEngineServer({
      clientManager,
      storeOptions: { inMemory: true },
    });
    callerHarness = await createTestHarness(callerSuite.server);

    // 4. Chiama tool che fa cross-server
    const result = await callerHarness.client.callTool({
      name: "health-dashboard",
      arguments: {},
    });

    // 5. Verifica
    const content = result.content as Array<{ type: string; text: string }>;
    const dashboard = JSON.parse(content[0].text);
    expect(dashboard.dataSources["agile-metrics"]).toBe("available");
  });
});
```

### Struttura di un Wiring Test

```
Fase     Azione                           Commento
─────────────────────────────────────────────────────────
1.       Crea target server (in-memory)   Server che viene chiamato
2.       Crea InMemoryTransport pair      [clientT, serverT]
3.       target.server.connect(serverT)   Server PRIMA
4.       clientManager.connect(clientT)   Client DOPO
5.       (Opzionale) Popola dati target   Via clientManager.callTool()
6.       Crea caller con clientManager    Server che chiama
7.       createTestHarness(caller)        Per invocare tool
8.       Invoca tool cross-server         Via harness.client.callTool()
9.       Verifica risultato               Assert sul contenuto
```

---

## Organizzazione dei File di Test

```
servers/my-server/
  tests/
    services/
      my-store.test.ts           # Unit test store
    tools/
      add-item.test.ts           # Integration test tool
      get-stats.test.ts
      get-stats-wiring.test.ts   # Wiring test cross-server
    server.test.ts               # Test factory (opzionale)
```

Configurazione Vitest:

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});
```

---

## Riepilogo

In questo capitolo hai imparato:

1. La piramide dei test MCP: unit, integration, wiring
2. Come testare lo store in isolamento con `inMemory: true`
3. `createTestHarness()` per test integration end-to-end
4. `MockEventBus` per verificare eventi pubblicati
5. Pattern completo di wiring test con InMemoryTransport + ClientManager
6. Organizzazione dei file di test per server

**Prossimo**: [Best Practice e Produzione](./10-best-practice-produzione.md)
