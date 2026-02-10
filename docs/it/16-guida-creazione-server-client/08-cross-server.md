# Comunicazione Cross-Server

## Introduzione

L'EventBus permette comunicazione asincrona fire-and-forget. Ma a volte un server ha bisogno di **chiamare un tool su un altro server** e ottenere il risultato. Questo e' il pattern cross-server: un server MCP agisce come client di un altro server.

---

## EventBus vs ClientManager

| Aspetto | EventBus | ClientManager |
|---------|----------|---------------|
| **Direzione** | Publisher -> N Subscriber | Caller -> 1 Target |
| **Risposta** | Nessuna (fire-and-forget) | Risultato sincrono |
| **Accoppiamento** | Zero (disaccoppiato) | Basso (conosce nome server e tool) |
| **Caso d'uso** | Notifiche, reazioni | Aggregazione dati, orchestrazione |
| **Esempio** | "Budget superato!" | "Dammi la velocity dello sprint" |

I due meccanismi sono complementari:
- **EventBus**: per segnalare che qualcosa e' successo
- **ClientManager**: per chiedere dati a un altro server

---

## La Classe ClientManager

Il ClientManager gestisce connessioni a server multipli e fornisce un'API unificata per chiamare tool:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

interface ServerEntry {
  name: string;
  transport: "stdio" | "http" | "in-memory";
  command?: string;      // Per stdio
  args?: string[];       // Per stdio
  url?: string;          // Per http
}

export class McpClientManager {
  private clients = new Map<string, Client>();

  /** Registra un server (non si connette ancora) */
  register(entry: ServerEntry): void {
    // Salva la configurazione per connessione lazy
  }

  /** Ottieni o crea una connessione a un server */
  async getClient(serverName: string): Promise<Client> {
    if (this.clients.has(serverName)) {
      return this.clients.get(serverName)!;
    }
    // Crea e connetti il client in base al tipo di transport
    // ...
  }

  /** Chiama un tool su un server remoto */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    const client = await this.getClient(serverName);
    return client.callTool({ name: toolName, arguments: args });
  }

  /** Crea una coppia di transport in-memory (per testing) */
  static createInMemoryPair() {
    return InMemoryTransport.createLinkedPair();
  }

  /** Connetti un server in-memory */
  async connectInMemoryWithTransport(
    serverName: string,
    clientTransport: InMemoryTransport,
  ): Promise<void> {
    const client = new Client({ name: `client-${serverName}`, version: "1.0.0" });
    await client.connect(clientTransport);
    this.clients.set(serverName, client);
  }

  /** Disconnetti tutti i server */
  async disconnectAll(): Promise<void> {
    for (const [name, client] of this.clients) {
      await client.close();
      this.clients.delete(name);
    }
  }
}
```

---

## Usare ClientManager nei Tool

Un tool che ha bisogno di dati da un altro server riceve `clientManager` come parametro opzionale:

```typescript
export function registerForecastBudget(
  server: McpServer,
  store: EconomicsStore,
  clientManager?: McpClientManager,
): void {
  server.tool(
    "forecast-budget",
    "Prevedi quando il budget si esaurira'. Include dati da time-tracking se disponibili.",
    {
      projectName: z.string(),
      includeTimeData: z.boolean().optional().default(false),
    },
    async ({ projectName, includeTimeData }) => {
      try {
        const forecast = store.forecastBudget(projectName);
        const result: Record<string, unknown> = { ...forecast };

        // Cross-server call: recupera dati dal time-tracking
        if (includeTimeData && clientManager) {
          const timeResult = await clientManager.callTool(
            "time-tracking",     // Server target
            "get-timesheet",     // Tool da invocare
            {},                  // Argomenti
          );

          // Parse del risultato MCP
          const content = (timeResult as {
            content: Array<{ type: string; text: string }>;
          }).content;
          const timesheet = JSON.parse(content[0].text);

          result.laborAnalysis = {
            trackedHours: timesheet.totalMinutes / 60,
            estimatedLaborCost: (timesheet.totalMinutes / 60) * 50,
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
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

### Pattern di Parsing del Risultato MCP

Quando chiami `clientManager.callTool()`, il risultato ha il formato standard MCP:

```typescript
const result = await clientManager.callTool("server", "tool", args);

// Il risultato ha sempre questa struttura:
const content = (result as {
  content: Array<{ type: string; text: string }>;
}).content;

// Estrai il testo dal primo elemento content
const data = JSON.parse(content[0].text);
```

### Graceful Degradation

Il pattern `clientManager?` garantisce che il tool funzioni anche senza cross-server:

```typescript
// Se clientManager non e' disponibile, il tool funziona con dati locali
if (includeTimeData && clientManager) {
  // Arricchisci con dati cross-server
} else {
  // Funziona comunque con dati locali
}
```

---

## Pattern SafeCall

Per server "intelligence" che aggregano dati da molti server, usa `safeCall()` per gestire server non disponibili:

```typescript
async function safeCall(
  clientManager: McpClientManager | undefined,
  server: string,
  tool: string,
  args: Record<string, unknown> = {},
): Promise<Record<string, unknown> | null> {
  if (!clientManager) return null;
  try {
    const result = await clientManager.callTool(server, tool, args);
    const content = (result as {
      content: Array<{ type: string; text: string }>;
    }).content;
    return JSON.parse(content[0].text);
  } catch {
    return null;  // Server non disponibile
  }
}

// Uso in un tool aggregatore
async function getProjectHealth(clientManager?: McpClientManager) {
  const dataSources: Record<string, string> = {};

  const velocity = await safeCall(clientManager, "agile-metrics", "calculate-velocity", {
    sprints: [{ name: "sample", completedPoints: 0, totalPoints: 0 }],
  });
  dataSources["agile-metrics"] = velocity ? "available" : "unavailable";

  const timesheet = await safeCall(clientManager, "time-tracking", "get-timesheet", {});
  dataSources["time-tracking"] = timesheet ? "available" : "unavailable";

  return {
    velocity: velocity ?? { status: "unavailable" },
    timeTracking: timesheet ?? { status: "unavailable" },
    dataSources,
  };
}
```

Il campo `dataSources` nell'output permette al chiamante di sapere quali server hanno risposto.

---

## Wiring nella Server Factory

La server factory accetta `clientManager` opzionale e lo passa ai tool:

```typescript
export function createInsightEngineServer(options?: {
  eventBus?: EventBus;
  clientManager?: McpClientManager;
  storeOptions?: { inMemory?: boolean };
}) {
  const server = new McpServer({
    name: "insight-engine",
    version: "1.0.0",
  });

  const store = new InsightStore(options?.storeOptions);

  // Passa clientManager ai tool che ne hanno bisogno
  registerHealthDashboard(server, store, options?.clientManager);
  registerCorrelateMetrics(server, store, options?.clientManager);
  registerQueryInsight(server, store, options?.clientManager);

  return { server, store };
}
```

---

## Test di Integrazione Cross-Server

I test di integrazione verificano che la comunicazione cross-server funzioni realmente, usando `InMemoryTransport`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { McpClientManager } from "../client-manager.js";
import { createInsightEngineServer } from "../../src/server.js";
import { createAgileMetricsServer } from "../../../agile-metrics/src/server.js";
import { createTimeTrackingServer } from "../../../time-tracking/src/server.js";
import { createTestHarness, type TestHarness } from "@mcp-suite/testing";

describe("insight-engine -> agile-metrics + time-tracking wiring", () => {
  let callerHarness: TestHarness;
  let clientManager: McpClientManager;

  afterEach(async () => {
    if (callerHarness) await callerHarness.close();
    if (clientManager) await clientManager.disconnectAll();
  });

  it("should aggregate data from multiple servers", async () => {
    // STEP 1: Crea i server target in-memory
    const metricsSuite = createAgileMetricsServer({
      storeOptions: { inMemory: true },
    });
    const timeSuite = createTimeTrackingServer({
      storeOptions: { inMemory: true },
    });

    // STEP 2: Collega i target al ClientManager via InMemoryTransport
    clientManager = new McpClientManager();

    const [ct1, st1] = McpClientManager.createInMemoryPair();
    await metricsSuite.server.connect(st1);  // Server PRIMA
    await clientManager.connectInMemoryWithTransport("agile-metrics", ct1);

    const [ct2, st2] = McpClientManager.createInMemoryPair();
    await timeSuite.server.connect(st2);
    await clientManager.connectInMemoryWithTransport("time-tracking", ct2);

    // STEP 3: Popola dati di test sui target
    await clientManager.callTool("time-tracking", "log-time", {
      taskId: "TASK-1",
      durationMinutes: 480,
    });

    // STEP 4: Crea il server chiamante CON clientManager
    const callerSuite = createInsightEngineServer({
      clientManager,
      storeOptions: { inMemory: true },
    });
    callerHarness = await createTestHarness(callerSuite.server);

    // STEP 5: Invoca il tool che fa cross-server calls
    const result = await callerHarness.client.callTool({
      name: "health-dashboard",
      arguments: {},
    });

    // STEP 6: Verifica
    const content = result.content as Array<{ type: string; text: string }>;
    const dashboard = JSON.parse(content[0].text);

    expect(dashboard.dataSources["agile-metrics"]).toBe("available");
    expect(dashboard.dataSources["time-tracking"]).toBe("available");
  });
});
```

### Ordine Critico nel Setup

```
1. Crea il server target:     createTargetServer({ storeOptions: { inMemory: true } })
2. Crea InMemoryTransport:    McpClientManager.createInMemoryPair()
3. Connetti il SERVER prima:  targetSuite.server.connect(serverTransport)
4. Connetti il CLIENT dopo:   clientManager.connectInMemoryWithTransport(name, clientTransport)
5. Popola dati di test:       clientManager.callTool("target", "setup-tool", data)
6. Crea il server caller:     createCallerServer({ clientManager })
7. Crea test harness:         createTestHarness(callerSuite.server)
8. Invoca e verifica:         harness.client.callTool(...)
```

Il server DEVE connettersi al transport PRIMA del client, perche' il client invia `initialize` immediatamente al `connect()`.

---

## Riepilogo

In questo capitolo hai imparato:

1. La differenza tra EventBus (fire-and-forget) e ClientManager (request-response)
2. Come implementare un ClientManager con supporto multi-transport
3. Il pattern di parsing dei risultati MCP da `callTool()`
4. Graceful degradation quando il server target non e' disponibile
5. Il pattern `safeCall()` per aggregatori
6. Come scrivere test di integrazione cross-server con InMemoryTransport

**Prossimo**: [Testing Professionale](./09-testing.md)
