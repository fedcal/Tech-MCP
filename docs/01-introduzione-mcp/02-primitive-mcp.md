# Le Primitive MCP: Tools, Resources, Prompts

## Panoramica

Il Model Context Protocol definisce tre tipi di primitive che un server puo esporre. Ogni primitiva ha un ruolo specifico nell'interazione tra AI e server.

```
                    MCP Server
        +-------------------------------+
        |                               |
        |  +---------+  +-----------+   |
        |  | Tools   |  | Resources |   |
        |  | (azioni)|  |  (dati)   |   |
        |  +---------+  +-----------+   |
        |                               |
        |  +------------+               |
        |  | Prompts    |               |
        |  | (template) |               |
        |  +------------+               |
        +-------------------------------+
```

---

## 1. Tools (Strumenti)

I **Tools** sono funzioni che l'AI puo invocare per eseguire azioni. Rappresentano il cuore dell'interazione MCP.

### Caratteristiche

- **L'AI decide quando chiamarli**: Basandosi sul contesto della conversazione, l'AI sceglie autonomamente quale tool usare
- **Hanno parametri tipizzati**: Ogni tool dichiara i suoi input con uno schema Zod
- **Ritornano risultati strutturati**: Il risultato e sempre un array di `content` con tipo `text`, `image`, o `resource`
- **Possono avere effetti collaterali**: Creare file, scrivere nel database, chiamare API esterne

### Anatomia di un Tool in MCP Suite

```typescript
server.tool(
  'create-sprint',                    // Nome univoco
  'Create a new sprint',             // Descrizione per l'AI
  {                                   // Schema parametri (Zod)
    name: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    goals: z.array(z.string()),
  },
  async ({ name, startDate, endDate, goals }) => {  // Handler
    const sprint = store.createSprint({ name, startDate, endDate, goals });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(sprint, null, 2)
      }]
    };
  }
);
```

### Categorie di Tool in MCP Suite

| Categoria | Esempio | Effetti |
|-----------|---------|---------|
| **Creazione** | `create-sprint`, `save-snippet` | Scrivono nel database |
| **Lettura** | `get-sprint`, `search-snippets` | Solo lettura |
| **Analisi** | `analyze-diff`, `find-bottlenecks` | Elaborano input, nessun side effect |
| **Generazione** | `generate-unit-tests`, `generate-compose` | Producono codice/config |
| **Monitoraggio** | `list-pipelines`, `get-budget-status` | Leggono stato esterno |

---

## 2. Resources (Risorse)

Le **Resources** sono dati che l'AI puo leggere. Sono identificate da URI e possono essere statiche o dinamiche.

### Caratteristiche

- **Identificate da URI**: Es. `file:///path/to/file`, `db://schema/table`
- **L'applicazione le richiede**: A differenza dei tool, le resource sono tipicamente richieste dall'applicazione host
- **Read-only**: Non modificano stato
- **Supportano template URI**: Es. `sprint://{id}` per risorse parametriche

### Esempio concettuale

```typescript
server.resource(
  'sprint://{id}',
  'Get sprint details',
  async (uri) => {
    const id = extractId(uri);
    const sprint = store.getSprint(id);
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(sprint)
      }]
    };
  }
);
```

> **Nota**: MCP Suite attualmente usa principalmente i Tool per esporre funzionalita. Le Resources sono previste per sviluppi futuri.

---

## 3. Prompts (Template)

I **Prompts** sono template predefiniti che guidano l'AI in task specifici.

### Caratteristiche

- **Guidano l'AI**: Forniscono istruzioni strutturate per task complessi
- **Accettano argomenti**: Possono essere parametrizzati
- **Combinabili con tool**: Un prompt puo suggerire all'AI una sequenza di tool da chiamare

### Esempio concettuale

```typescript
server.prompt(
  'sprint-review',
  'Generate a sprint review report',
  [{ name: 'sprintId', description: 'Sprint to review', required: true }],
  async ({ sprintId }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Analizza lo sprint ${sprintId}: usa get-sprint per i dati,
               calculate-velocity per le metriche, e genera un report.`
      }
    }]
  })
);
```

> **Nota**: MCP Suite attualmente usa principalmente i Tool. I Prompts sono previsti per sviluppi futuri.

---

## Come l'AI Sceglie i Tool

Quando l'AI riceve la lista dei tool disponibili, per ogni tool conosce:

1. **Nome**: Identificativo univoco (es. `create-sprint`)
2. **Descrizione**: Testo che spiega cosa fa il tool
3. **Schema parametri**: Struttura dei parametri di input con tipi e descrizioni

L'AI usa queste informazioni per decidere quale tool chiamare in risposta alla richiesta dell'utente. La descrizione e cruciale: deve essere chiara e specifica per aiutare l'AI a fare la scelta giusta.

### Buone pratiche per le descrizioni

```
"Create a new sprint with a name, date range, and goals"
   Chiaro: spiega COSA fa e QUALI input servono

"Sprint creation tool"
   Vago: l'AI potrebbe non capire quando usarlo

"Create a new sprint. Returns the created sprint object with id,
 name, dates, status. Use this when the user wants to start
 planning a new iteration."
   Ottimo: spiega cosa fa, cosa ritorna, e quando usarlo
```

---

## Il Ciclo di Vita di una Sessione MCP

```
[1] INIZIALIZZAZIONE
    Client --> Server: initialize (versione protocollo, capabilities)
    Server --> Client: capabilities (tool list, resource templates)

[2] DISCOVERY
    Client --> Server: tools/list
    Server --> Client: [{ name, description, inputSchema }, ...]

[3] UTILIZZO (ripetuto N volte)
    Client --> Server: tools/call { name, arguments }
    Server --> Client: { content: [...] }

[4] CHIUSURA
    Client --> Server: close
```

Ogni sessione MCP segue questo flusso. Il Server resta in ascolto dopo l'inizializzazione, pronto a rispondere a chiamate tool fino alla chiusura della sessione.
