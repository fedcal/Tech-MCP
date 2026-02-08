# Guida per Contribuire

## Benvenuto

MCP Suite e un progetto open source e i contributi sono benvenuti. Questa guida spiega come contribuire efficacemente al progetto.

---

## Prerequisiti

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- Conoscenza base di TypeScript e del Model Context Protocol

---

## Setup Ambiente di Sviluppo

```bash
# 1. Fork e clone
git clone https://github.com/<tuo-utente>/mcp-suite.git
cd mcp-suite

# 2. Installa dipendenze
pnpm install

# 3. Build completo
pnpm build

# 4. Verifica che tutto compili
pnpm typecheck
```

---

## Tipi di Contributo

### 1. Aggiungere un Nuovo Server MCP

La struttura e standardizzata. Per creare un nuovo server:

```bash
# Crea la struttura del server
mkdir -p servers/mio-server/src/{tools,services}
```

**File necessari:**

```
servers/mio-server/
├── package.json          # Dipendenze e script
├── tsconfig.json         # Configurazione TypeScript
└── src/
    ├── index.ts          # Entry point
    ├── server.ts         # Factory e registrazione tool
    ├── tools/            # Un file per tool
    │   └── mio-tool.ts
    ├── services/         # Business logic (opzionale)
    │   └── mio-store.ts
    └── collaboration.ts  # Event handler (opzionale)
```

**package.json template:**

```json
{
  "name": "@mcp-suite/server-mio-server",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@mcp-suite/core": "workspace:*",
    "@mcp-suite/event-bus": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.12.1",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

**Registra il server** in `pnpm-workspace.yaml` (gia coperto dal glob `servers/*`).

### 2. Aggiungere un Nuovo Tool a un Server Esistente

1. Crea il file in `servers/<nome>/src/tools/mio-tool.ts`
2. Segui il pattern esistente:

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';

export function registerMioTool(
  server: McpServer,
  store: MyStore,
  eventBus?: EventBus,
): void {
  server.tool(
    'mio-tool',
    'Descrizione chiara di cosa fa il tool',
    {
      param1: z.string().describe('Descrizione del parametro'),
      param2: z.number().optional().describe('Parametro opzionale'),
    },
    async ({ param1, param2 }) => {
      try {
        const result = store.doSomething(param1, param2);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        };
      }
    },
  );
}
```

3. Registra il tool in `server.ts` chiamando la funzione di registrazione

### 3. Aggiungere un Nuovo Evento

1. Aggiungi la definizione in `packages/event-bus/src/events.ts`:

```typescript
export interface EventMap {
  // ... eventi esistenti ...
  'dominio:mio-evento': {
    campo1: string;
    campo2: number;
  };
}
```

2. Pubblica nel tool appropriato
3. Sottoscri nel `collaboration.ts` del server interessato
4. Documenta nella matrice di collaborazione

### 4. Implementare i Collaboration Handler Placeholder

Molti `collaboration.ts` contengono handler con `void payload` (placeholder). Implementare la logica reale e un ottimo contributo:

```typescript
// Da:
eventBus.subscribe('scrum:task-updated', (payload) => {
  void payload;
});

// A:
eventBus.subscribe('scrum:task-updated', (payload) => {
  if (payload.newStatus === 'in_progress') {
    store.autoStartTimer(payload.taskId, payload.assignee);
  }
});
```

### 5. Scrivere Test

I test sono la priorita principale. Ogni contributo che aggiunge test e particolarmente apprezzato.

---

## Convenzioni

### Codice

- **Formatter**: Prettier (configurato in `.prettierrc`)
- **Stile**: Single quotes, trailing commas, 100 char line width
- **Importazioni**: Usare `type` import per tipi (`import type { ... }`)
- **Errori**: Sempre `error instanceof Error ? error.message : String(error)`
- **Naming tool**: kebab-case (`create-sprint`, non `createSprint`)
- **Naming eventi**: `dominio:azione-kebab-case`

### Git

- **Branch**: `feature/nome-feature`, `fix/nome-fix`, `docs/nome-docs`
- **Commit message**: Imperativo, conciso (es. "Add auto-timer to time-tracking")
- **PR**: Una feature/fix per PR, con descrizione chiara

### Descrizioni Tool

Le descrizioni dei tool sono cruciali perche l'AI le usa per decidere quale tool chiamare. Devono essere:

- **Specifiche**: Spiegare cosa fa, cosa ritorna, quando usarlo
- **In inglese**: Per compatibilita con tutti i client AI
- **Sotto i 200 caratteri**: Per non occupare troppo contesto

---

## Processo di Review

1. **Fork** il repository
2. **Crea un branch** dalla `main`
3. **Implementa** seguendo le convenzioni
4. **Build e typecheck**: `pnpm build && pnpm typecheck`
5. **Committa** con messaggi chiari
6. **Apri una Pull Request** verso `main`
7. **Rispondi** al feedback della review

---

## Aree dove Serve Aiuto

| Area | Priorita | Difficolta |
|------|----------|------------|
| Unit test per tutti i tool | Alta | Media |
| Implementazione Redis EventBus | Alta | Media |
| Implementazione Client Manager wiring | Media | Alta |
| HTTP Transport | Media | Alta |
| GitHub Actions CI/CD | Media | Bassa |
| Dashboard web di monitoraggio | Bassa | Alta |
| Plugin system | Bassa | Alta |
| Completamento collaboration handler | Media | Bassa |
