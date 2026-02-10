# Roadmap e Sviluppi Futuri

## Panoramica

MCP Suite e un progetto in evoluzione. La struttura attuale (22 server, 6 pacchetti condivisi, EventBus wired) rappresenta il nucleo funzionale. Questa sezione descrive le aree di sviluppo pianificate, ordinate per priorita.

---

## Stato Attuale

| Area | Stato | Dettaglio |
|------|-------|----------|
| 22 Server MCP | Completo | Tutti i server buildano e registrano i tool |
| 6 Pacchetti Condivisi | Completo | core, event-bus, client-manager, database, testing, cli |
| EventBus Wiring | Completo | 13 server pubblicano, 6 hanno collaboration handler |
| Trasporto STDIO | Completo | Compatibile Claude Desktop, Cursor, VS Code |
| Documentazione | Completo | 15 sezioni nella cartella docs/ |
| Testing | Completo | 300 test Vitest, tutti i 22 server coperti |
| Storage Layer SQLite | Completo | Tutti i 22 server con persistenza SQLite |
| HTTP Transport | Completo | STDIO + Streamable HTTP stateful, tutte le 22 porte assegnate |
| Client Manager Wiring | Completo | 6 scenari cross-server, 5 server wired, test di integrazione |
| Redis EventBus | Da fare | Solo LocalEventBus (in-process) disponibile |

---

## Priorita 1: Testing

### Unit Test con Vitest

L'infrastruttura di testing e predisposta nel pacchetto `@mcp-suite/testing` con:
- `MockEventBus` per testare pubblicazione/sottoscrizione eventi
- `TestServer` per istanziare server in-memory senza STDIO

**Cosa testare per ogni server:**

```
tests/
├── tools/
│   ├── create-sprint.test.ts      # Test singolo tool
│   ├── update-task-status.test.ts
│   └── ...
├── services/
│   └── scrum-store.test.ts        # Test business logic
├── collaboration.test.ts          # Test event handler
└── server.test.ts                 # Test factory e registrazione
```

**Esempio di test con MockEventBus:**

```typescript
import { describe, it, expect } from 'vitest';
import { MockEventBus } from '@mcp-suite/testing';

describe('create-sprint', () => {
  it('should publish scrum:sprint-started event', async () => {
    const eventBus = new MockEventBus();
    const store = new ScrumStore();
    registerCreateSprint(server, store, eventBus);

    // Invoca il tool
    await callTool('create-sprint', { name: 'Sprint 1', ... });

    // Verifica evento pubblicato
    expect(eventBus.published).toContainEqual({
      event: 'scrum:sprint-started',
      payload: expect.objectContaining({ name: 'Sprint 1' }),
    });
  });
});
```

**Obiettivo coverage:** almeno un test per ogni tool e collaboration handler.

### Integration Test

Test end-to-end che verificano il flusso completo:

1. Creare un server con `InMemoryTransport`
2. Chiamare un tool
3. Verificare il risultato e gli eventi pubblicati
4. Verificare che i collaboration handler reagiscano correttamente

---

## Priorita 2: Redis EventBus

### Motivazione

`LocalEventBus` funziona solo quando tutti i server sono nello stesso processo Node.js. Per deployment reali dove ogni server e un processo separato, serve un broker di messaggi esterno.

### Architettura Prevista

```
Server A (Processo 1)         Redis          Server B (Processo 2)
       |                        |                    |
       |-- PUBLISH channel ---->|                    |
       |                        |-- message -------->|
       |                        |                    |
       |     Serializzazione    |   Deserializzazione|
       |     JSON.stringify()   |   JSON.parse()     |
```

### Implementazione

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

### Configurazione

```bash
# Variabile d'ambiente per abilitare Redis
MCP_SUITE_EVENT_BUS=redis
MCP_SUITE_REDIS_URL=redis://localhost:6379
```

---

## Priorita 3: Client Manager Wiring (Completato)

Il Client Manager Wiring e stato implementato con 6 scenari cross-server che coinvolgono 5 server chiamanti e 3 server target. Ogni server chiamante usa `McpClientManager` per chiamare tool su altri server in modo sincrono, con graceful degradation (funziona anche senza clientManager).

Documentazione completa: [Client Manager Wiring](../14-collaborazione-inter-server/04-client-manager-wiring.md) e [Pacchetto client-manager](../05-pacchetti-condivisi/05-client-manager.md).

---

## Priorita 4: HTTP Transport (Completato)

Il trasporto HTTP Streamable e stato implementato in `@mcp-suite/core` tramite la funzione `startHttpServer()`. Usa il protocollo MCP Streamable HTTP dell'SDK ufficiale con modalita stateful (session UUID). Ogni server ha una porta dedicata configurabile via variabili d'ambiente.

Documentazione completa: [Core - startHttpServer](../05-pacchetti-condivisi/01-core.md).

---

## Priorita 5: Funzionalita Avanzate

### Resources e Prompts MCP

Attualmente MCP Suite usa solo la primitiva **Tools**. Le specifiche MCP definiscono anche:

- **Resources**: Dati esposti con URI (`sprint://42`, `db://schema/users`). Permetterebbero all'AI di leggere dati senza chiamare tool.
- **Prompts**: Template predefiniti che guidano l'AI in task complessi. Esempio: un prompt "sprint-review" che suggerisce la sequenza di tool da chiamare.

### Dashboard Web

Una web dashboard per visualizzare:
- Stato di tutti i server
- Eventi pubblicati in tempo reale
- Metriche di utilizzo tool
- Health check

### Plugin System

Architettura per plugin third-party:
- Registry di plugin
- Hot-reload di tool
- Marketplace condiviso

---

## Come Contribuire

Vedi la sezione [Contribuire](02-contribuire.md) per le linee guida dettagliate.
