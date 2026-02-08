# Creare il Primo Server MCP

## Introduzione

In questo capitolo costruirai un server MCP completo partendo da un progetto vuoto. Il server esporra' tool per la gestione di note, con validazione degli input tramite Zod e transport STDIO.

---

## Setup del Progetto

### Prerequisiti

- Node.js >= 18
- npm o pnpm
- TypeScript 5.x

### Inizializzazione

```bash
mkdir mcp-notes-server && cd mcp-notes-server
npm init -y
```

Installa le dipendenze:

```bash
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node
```

### Configurazione TypeScript

Crea `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

### Package.json

Aggiorna `package.json`:

```json
{
  "name": "mcp-notes-server",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "mcp-notes": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  }
}
```

Il campo `"type": "module"` e' fondamentale: MCP SDK usa ESM.

### Struttura Cartelle

```bash
mkdir -p src
```

```
mcp-notes-server/
  src/
    index.ts         # Entry point + logica server
  package.json
  tsconfig.json
```

---

## Il Server Minimo

Crea `src/index.ts`:

```typescript
#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Stato in memoria
const notes: Map<string, string> = new Map();

// Crea il server
const server = new McpServer({
  name: "notes-server",
  version: "1.0.0",
});

// Registra il primo tool
server.tool(
  "add-note",
  "Aggiunge una nuova nota",
  {
    title: z.string().describe("Titolo della nota"),
    content: z.string().describe("Contenuto della nota"),
  },
  async ({ title, content }) => {
    notes.set(title, content);
    return {
      content: [
        {
          type: "text",
          text: `Nota "${title}" salvata con successo.`,
        },
      ],
    };
  },
);

// Avvio con transport STDIO
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Notes MCP Server avviato su stdio");
}

main().catch((error) => {
  console.error("Errore fatale:", error);
  process.exit(1);
});
```

### Anatomia del Codice

**1. Import dell'SDK:**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
```

`McpServer` e' la classe principale. Gestisce il lifecycle del protocollo, la registrazione dei tool e la negoziazione delle capability.

**2. Creazione del server:**

```typescript
const server = new McpServer({
  name: "notes-server",    // Identificativo univoco
  version: "1.0.0",        // Versione (semver)
});
```

**3. Registrazione di un tool:**

```typescript
server.tool(
  "add-note",              // Nome del tool (identificativo)
  "Aggiunge una nuova nota", // Descrizione (il modello AI la legge!)
  {                        // Input schema (oggetto Zod)
    title: z.string(),
    content: z.string(),
  },
  async ({ title, content }) => {  // Handler asincrono
    // ... logica ...
    return {
      content: [{ type: "text", text: "risultato" }],
    };
  },
);
```

La firma di `server.tool()` ha 4 argomenti:
- **name**: stringa univoca che identifica il tool
- **description**: testo che il modello AI usa per decidere quando invocare il tool
- **inputSchema**: oggetto con chiavi Zod che definisce i parametri
- **handler**: funzione asincrona che riceve i parametri tipizzati e ritorna il risultato

**4. Formato del risultato:**

```typescript
return {
  content: [
    { type: "text", text: "testo del risultato" }
  ],
  isError: false,  // opzionale, default false
};
```

Il campo `content` e' un array che puo' contenere:
- `{ type: "text", text: "..." }` — testo
- `{ type: "image", data: "base64...", mimeType: "image/png" }` — immagine
- `{ type: "resource", resource: { uri: "...", text: "..." } }` — risorsa embedded

**5. Transport STDIO:**

```typescript
const transport = new StdioServerTransport();
await server.connect(transport);
```

`connect()` avvia il loop di lettura/scrittura su stdin/stdout. Da questo momento il server e' in ascolto.

**6. Logging su stderr:**

```typescript
console.error("Notes MCP Server avviato su stdio");
```

**Mai usare `console.log()`** in un server STDIO: corromperebbe il protocollo. Tutto il logging va su stderr con `console.error()`.

---

## Aggiungere Piu' Tool

Espandi il server con tool per leggere, elencare e cancellare note:

```typescript
// Tool: leggere una nota
server.tool(
  "get-note",
  "Recupera il contenuto di una nota dal titolo",
  {
    title: z.string().describe("Titolo della nota da leggere"),
  },
  async ({ title }) => {
    const content = notes.get(title);
    if (!content) {
      return {
        content: [{ type: "text", text: `Nota "${title}" non trovata.` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: content }],
    };
  },
);

// Tool: elencare tutte le note
server.tool(
  "list-notes",
  "Elenca tutte le note salvate",
  {},  // Nessun parametro richiesto
  async () => {
    if (notes.size === 0) {
      return {
        content: [{ type: "text", text: "Nessuna nota salvata." }],
      };
    }
    const list = Array.from(notes.keys())
      .map((title, i) => `${i + 1}. ${title}`)
      .join("\n");
    return {
      content: [{ type: "text", text: list }],
    };
  },
);

// Tool: cancellare una nota
server.tool(
  "delete-note",
  "Cancella una nota dal titolo",
  {
    title: z.string().describe("Titolo della nota da cancellare"),
  },
  async ({ title }) => {
    const deleted = notes.delete(title);
    if (!deleted) {
      return {
        content: [{ type: "text", text: `Nota "${title}" non trovata.` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: `Nota "${title}" cancellata.` }],
    };
  },
);
```

---

## Validazione Avanzata con Zod

Zod permette di definire schemi di validazione espressivi:

```typescript
server.tool(
  "search-notes",
  "Cerca note per parola chiave con opzioni di filtro",
  {
    query: z.string().min(2).describe("Testo da cercare (minimo 2 caratteri)"),
    caseSensitive: z.boolean().optional().default(false)
      .describe("Se true, la ricerca e' case-sensitive"),
    limit: z.number().int().min(1).max(100).optional().default(10)
      .describe("Numero massimo di risultati (1-100)"),
  },
  async ({ query, caseSensitive, limit }) => {
    const results: string[] = [];
    for (const [title, content] of notes) {
      const haystack = caseSensitive ? content : content.toLowerCase();
      const needle = caseSensitive ? query : query.toLowerCase();
      if (haystack.includes(needle)) {
        results.push(title);
      }
      if (results.length >= limit) break;
    }

    return {
      content: [{
        type: "text",
        text: results.length > 0
          ? `Trovate ${results.length} note:\n${results.join("\n")}`
          : `Nessun risultato per "${query}".`,
      }],
    };
  },
);
```

### Pattern Zod Comuni

```typescript
// Stringhe
z.string()                           // stringa qualsiasi
z.string().min(1)                    // non vuota
z.string().email()                   // email valida
z.string().url()                     // URL valido
z.string().uuid()                    // UUID valido

// Numeri
z.number()                           // numero qualsiasi
z.number().int()                     // intero
z.number().int().positive()          // intero positivo
z.number().min(0).max(100)           // range

// Booleani e enum
z.boolean()                          // true/false
z.enum(["low", "medium", "high"])    // enum di stringhe

// Opzionali e default
z.string().optional()                // stringa | undefined
z.number().optional().default(10)    // con valore default

// Array e oggetti
z.array(z.string())                  // array di stringhe
z.object({                           // oggetto annidato
  name: z.string(),
  tags: z.array(z.string()).optional(),
})

// Describe (importante per l'AI!)
z.string().describe("Descrizione del campo per il modello AI")
```

Il `.describe()` e' cruciale: il testo viene incluso nello schema JSON inviato al modello, aiutandolo a capire cosa fornire come argomento.

---

## Error Handling

### Errori di Esecuzione (gestiti dal tool)

Quando un tool incontra un errore prevedibile, ritorna `isError: true`:

```typescript
async ({ title }) => {
  try {
    const data = fetchData(title);
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
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
}
```

Questo e' il pattern standard: try/catch che wrappa la logica, con `isError: true` in caso di fallimento. Il modello AI riceve l'errore come contesto e puo' decidere come procedere.

### Errori di Protocollo (eccezioni non gestite)

Se il tool lancia un'eccezione non gestita, l'SDK la trasforma automaticamente in un errore JSON-RPC. E' buona pratica gestire sempre gli errori esplicitamente.

---

## Build e Test Manuale

```bash
npm run build
```

Testa il server con l'MCP Inspector (tool ufficiale):

```bash
npx @modelcontextprotocol/inspector dist/index.js
```

Questo apre un'interfaccia web dove puoi elencare e invocare i tool del server.

---

## Configurazione Claude Desktop

Per usare il server con Claude Desktop, aggiungi al file di configurazione:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "notes": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-notes-server/dist/index.js"]
    }
  }
}
```

Dopo aver riavviato Claude Desktop, il modello vedra' i tool del server e potra' invocarli quando pertinente alla conversazione.

---

## Riepilogo

In questo capitolo hai imparato:

1. Come strutturare un progetto server MCP con TypeScript
2. Come registrare tool con `server.tool()` e validare input con Zod
3. Il formato dei risultati (content array con tipi text/image/resource)
4. Error handling con `isError: true`
5. L'importanza di usare `console.error()` invece di `console.log()` con STDIO
6. Come testare con MCP Inspector e configurare Claude Desktop

**Prossimo**: [Creare il Primo Client MCP](./03-primo-client.md)
