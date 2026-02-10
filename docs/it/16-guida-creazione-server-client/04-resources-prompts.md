# Resources e Prompts

## Introduzione

Oltre ai tool, MCP espone due primitive aggiuntive: **Resources** per fornire dati contestuali e **Prompts** per template di interazione. Insieme ai tool, formano le tre colonne del protocollo.

```
  +-------------------------------------------------------------------+
  |                    PRIMITIVE MCP                                  |
  +-------------------------------------------------------------------+
  |                                                                   |
  |  TOOLS               RESOURCES            PROMPTS                 |
  |  Controllati dal     Controllate dalla     Controllati            |
  |  modello AI          applicazione host     dall'utente            |
  |                                                                   |
  |  Il modello decide   L'app decide quando   L'utente seleziona     |
  |  quando invocarli    caricare i dati       un template            |
  |                                                                   |
  |  Azioni attive       Dati passivi          Interazioni guidate    |
  |  (eseguono codice)   (forniscono contesto) (strutturano prompt)   |
  +-------------------------------------------------------------------+
```

---

## Resources

Le risorse sono sorgenti di dati identificate da URI. A differenza dei tool (che eseguono azioni), le risorse forniscono informazioni che arricchiscono il contesto dell'AI.

### Registrare una Risorsa Statica

```typescript
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({
  name: "docs-server",
  version: "1.0.0",
});

// Risorsa statica: contenuto fisso
server.resource(
  "readme",                                      // Nome
  "file:///project/README.md",                   // URI univoco
  { mimeType: "text/markdown" },                 // Metadata
  async () => ({
    contents: [
      {
        uri: "file:///project/README.md",
        mimeType: "text/markdown",
        text: "# Il Mio Progetto\n\nDescrizione del progetto...",
      },
    ],
  }),
);
```

Il client accede alla risorsa con `resources/read` specificando l'URI.

### Registrare Resource Templates

I template permettono risorse parametrizzate con URI pattern (RFC 6570):

```typescript
// Resource template: contenuto dinamico basato su parametro
server.resource(
  "note-by-title",
  new ResourceTemplate("notes://{title}", { list: undefined }),
  { mimeType: "text/plain" },
  async (uri, { title }) => {
    const content = notes.get(title as string);
    if (!content) {
      throw new Error(`Nota "${title}" non trovata`);
    }
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: content,
        },
      ],
    };
  },
);
```

Con `list: undefined`, il template non appare nella lista delle risorse. Per elencare le istanze disponibili:

```typescript
server.resource(
  "note-by-title",
  new ResourceTemplate("notes://{title}", {
    list: async () => {
      // Ritorna le risorse attualmente disponibili
      return {
        resources: Array.from(notes.keys()).map((title) => ({
          uri: `notes://${encodeURIComponent(title)}`,
          name: title,
          mimeType: "text/plain",
        })),
      };
    },
  }),
  async (uri, { title }) => {
    const content = notes.get(title as string);
    return {
      contents: [{
        uri: uri.href,
        mimeType: "text/plain",
        text: content ?? "Non trovata",
      }],
    };
  },
);
```

### Tipi di Contenuto

Le risorse supportano contenuto testuale e binario:

```typescript
// Contenuto testuale
{
  uri: "file:///config.json",
  mimeType: "application/json",
  text: '{"key": "value"}'
}

// Contenuto binario (base64)
{
  uri: "file:///logo.png",
  mimeType: "image/png",
  blob: "iVBORw0KGgoAAAANSUhEUg..."  // base64
}
```

### Subscription alle Risorse

Se una risorsa cambia nel tempo, il server puo' notificare i client:

```typescript
// Nella capability declaration, abilita subscribe
// Il server emette notifiche quando i dati cambiano:
server.notification({
  method: "notifications/resources/updated",
  params: { uri: "notes://my-note" },
});
```

---

## Prompts

I prompt sono template riutilizzabili che strutturano interazioni con il modello. Tipicamente esposti come slash commands nell'interfaccia utente.

### Registrare un Prompt Semplice

```typescript
server.prompt(
  "summarize-notes",                              // Nome (diventa /summarize-notes)
  "Riassumi tutte le note salvate",              // Descrizione
  async () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Ecco le mie note. Fai un riassunto conciso:\n\n${
            Array.from(notes.entries())
              .map(([title, content]) => `## ${title}\n${content}`)
              .join("\n\n")
          }`,
        },
      },
    ],
  }),
);
```

### Prompt con Argomenti

```typescript
server.prompt(
  "review-note",
  "Revisiona e migliora una nota specifica",
  [
    {
      name: "title",
      description: "Titolo della nota da revisionare",
      required: true,
    },
    {
      name: "style",
      description: "Stile desiderato: formale, informale, tecnico",
      required: false,
    },
  ],
  async ({ title, style }) => {
    const content = notes.get(title);
    if (!content) {
      throw new Error(`Nota "${title}" non trovata`);
    }

    const styleHint = style ? ` Usa uno stile ${style}.` : "";

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Revisiona e migliora questa nota.${styleHint}\n\n# ${title}\n\n${content}`,
          },
        },
      ],
    };
  },
);
```

### Prompt Multi-Messaggio

I prompt possono includere messaggi con ruoli diversi per creare contesti ricchi:

```typescript
server.prompt(
  "debug-session",
  "Avvia una sessione di debug guidata",
  [
    {
      name: "error",
      description: "Il messaggio di errore da analizzare",
      required: true,
    },
  ],
  async ({ error }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Ho questo errore: ${error}`,
        },
      },
      {
        role: "assistant",
        content: {
          type: "text",
          text: "Capisco il problema. Analizziamo passo per passo. Per prima cosa, "
            + "dimmi in quale contesto si verifica l'errore.",
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: "Si verifica durante l'esecuzione dei test.",
        },
      },
    ],
  }),
);
```

### Prompt con Risorse Embedded

Un prompt puo' includere risorse inline come contesto:

```typescript
server.prompt(
  "analyze-project",
  "Analizza la struttura del progetto",
  async () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "resource",
          resource: {
            uri: "file:///project/package.json",
            mimeType: "application/json",
            text: JSON.stringify(packageJson, null, 2),
          },
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: "Analizza questa configurazione e suggerisci miglioramenti.",
        },
      },
    ],
  }),
);
```

---

## Tool vs Resource vs Prompt: Quando Usare Cosa

| Scenario | Primitiva | Motivo |
|----------|-----------|--------|
| Eseguire un calcolo | **Tool** | Azione attiva con side-effect |
| Leggere un file di configurazione | **Resource** | Dato contestuale passivo |
| Salvare dati nel database | **Tool** | Azione che modifica stato |
| Fornire schema del DB | **Resource** | Contesto statico |
| "Revisiona il mio codice" | **Prompt** | Template di interazione |
| Cercare in un archivio | **Tool** | Azione con parametri dinamici |
| Documentazione API | **Resource** | Contesto di riferimento |
| "Genera test per questo file" | **Prompt** | Workflow strutturato |

**Regola pratica**: se il modello deve decidere quando e come usarlo, e' un **Tool**. Se l'applicazione carica i dati in background, e' una **Resource**. Se l'utente seleziona un'azione predefinita, e' un **Prompt**.

---

## Riepilogo

In questo capitolo hai imparato:

1. Come registrare risorse statiche e parametrizzate con URI template
2. La differenza tra contenuto testuale e binario nelle risorse
3. Come creare prompt semplici, con argomenti e multi-messaggio
4. Come incorporare risorse nei prompt
5. Quando usare tool, resource o prompt

**Prossimo**: [Transport HTTP e Deployment](./05-transport-http.md)
