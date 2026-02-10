# Snippet Manager Server

## Panoramica

Il server **snippet-manager** e' un gestore di frammenti di codice riusabili con
persistenza su SQLite. Permette di salvare, cercare, recuperare e organizzare snippet
di codice con supporto per tag, linguaggio di programmazione e ricerca full-text.

A differenza dei server stateless, snippet-manager mantiene uno stato persistente
attraverso il servizio `SnippetStore` basato su SQLite, garantendo che gli snippet
siano disponibili tra sessioni diverse.

```
+---------------------------------------------------------------------+
|                    snippet-manager server                           |
|                                                                     |
|  +-------------+ +----------------+ +-----------+ +---------------+ |
|  |save-snippet | |search-snippets | |get-snippet| |delete-snippet | |
|  +------+------+ +-------+--------+ +-----+-----+ +------+--------+ |
|         |                |               |              |           |
|  +------+------+                                                    |
|  | list-tags   |                                                    |
|  +------+------+                                                    |
|         |                |               |              |           |
|         v                v               v              v           |
|  +-------------------------------------------------------------+    |
|  |                  SnippetStore (SQLite)                      |    |
|  |  +-------------------------------------------------------+  |    |
|  |  | snippets                                              |  |    |
|  |  | id | title | code | language | description | tags     |  |    |
|  |  |    |       |      |          |             | (JSON)   |  |    |
|  |  |    |       |      |          |             |          |  |    |
|  |  | createdAt  | updatedAt                                |  |    |
|  |  +-------------------------------------------------------+  |    |
|  +-------------------------------------------------------------+    |
+---------------------------------------------------------------------+
```

**Versione:** 0.1.0
**Entry point:** `servers/snippet-manager/src/index.ts`
**Dipendenze:** `@mcp-suite/core`, `@mcp-suite/event-bus`, `@mcp-suite/database`

---

## Tabella dei Tool

| Tool | Descrizione | Parametri |
|------|-------------|-----------|
| `save-snippet` | Salva un nuovo snippet di codice | `title` (string): titolo; `code` (string): codice; `language` (string): linguaggio; `description` (string, opzionale): descrizione; `tags` (string[], opzionale): tag |
| `search-snippets` | Cerca snippet per keyword, tag o linguaggio | `keyword` (string, opzionale): ricerca full-text; `tag` (string, opzionale): filtro per tag; `language` (string, opzionale): filtro per linguaggio |
| `get-snippet` | Recupera uno snippet per ID | `id` (string): ID dello snippet |
| `delete-snippet` | Elimina uno snippet per ID | `id` (string): ID dello snippet |
| `list-tags` | Elenca tutti i tag con conteggio di utilizzo | Nessun parametro |

---

## Dettaglio dei Tool

### save-snippet

Crea un nuovo record nella tabella `snippets` con timestamp automatici. I tag vengono
serializzati come array JSON.

```json
{
  "tool": "save-snippet",
  "arguments": {
    "title": "Debounce function TypeScript",
    "code": "export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {\n  let timer: ReturnType<typeof setTimeout>;\n  return ((...args: any[]) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), ms);\n  }) as T;\n}",
    "language": "typescript",
    "description": "Implementazione generica di debounce con tipizzazione TypeScript",
    "tags": ["utility", "performance", "typescript"]
  }
}
```

### search-snippets

Supporta tre modalita' di ricerca combinabili:

| Modalita' | Campo | Query SQL |
|-----------|-------|-----------|
| `keyword` | title, description, code | `LIKE %keyword%` su tutti e tre i campi |
| `tag` | tags (JSON) | `LIKE %"tag"%` nel campo JSON |
| `language` | language | Corrispondenza esatta |

I filtri sono combinabili con AND:

```json
{
  "tool": "search-snippets",
  "arguments": {
    "keyword": "fetch",
    "tag": "async",
    "language": "typescript"
  }
}
```

I risultati sono ordinati per `updatedAt DESC` (snippet piu' recenti prima).

### get-snippet

Recupero diretto per ID. Restituisce l'oggetto `CodeSnippet` completo o errore se
non trovato.

### delete-snippet

Eliminazione permanente per ID. Restituisce `true` se lo snippet e' stato eliminato,
errore se l'ID non esiste.

### list-tags

Raccoglie tutti i tag unici da tutti gli snippet e restituisce un array ordinato per
conteggio decrescente:

```json
[
  { "tag": "typescript", "count": 15 },
  { "tag": "utility", "count": 12 },
  { "tag": "react", "count": 8 },
  { "tag": "async", "count": 5 }
]
```

---

## Architettura

```
index.ts
  |
  +-- server.ts (createSnippetManagerServer)
  |     |
  |     +-- crea SnippetStore
  |     +-- registra tutti i tool passando lo store
  |
  +-- services/
  |     +-- snippet-store.ts  --> SnippetStore (classe con metodi CRUD)
  |
  +-- tools/
        +-- save-snippet.ts
        +-- search-snippets.ts
        +-- get-snippet.ts
        +-- delete-snippet.ts
        +-- list-tags.ts
```

### SnippetStore

Lo store utilizza `@mcp-suite/database` per creare e gestire il database SQLite.

**Schema della tabella `snippets`:**

| Colonna | Tipo | Vincoli |
|---------|------|---------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `title` | TEXT | NOT NULL |
| `code` | TEXT | NOT NULL |
| `language` | TEXT | NOT NULL |
| `description` | TEXT | Nullable |
| `tags` | TEXT | NOT NULL, DEFAULT '[]' (JSON array) |
| `createdAt` | TEXT | NOT NULL, DEFAULT datetime('now') |
| `updatedAt` | TEXT | NOT NULL, DEFAULT datetime('now') |

**Migrazione (versione 1):**
```sql
CREATE TABLE IF NOT EXISTS snippets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  code TEXT NOT NULL,
  language TEXT NOT NULL,
  description TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Gestione tag:**
I tag sono memorizzati come stringa JSON (`["tag1", "tag2"]`) nel campo `tags`.
La deserializzazione avviene nel metodo `rowToSnippet()` tramite `JSON.parse()`.

Il metodo `listTags()` effettua una scansione completa della tabella, parsifica tutti
i tag e li aggrega in una `Map<string, number>` per conteggio.

---

## Integrazione Event Bus

Il server **non pubblica** e **non sottoscrive** alcun evento. Gli snippet sono gestiti
in modo completamente locale.

---

## Interazioni con altri Server

```
+------------------+                         +------------------+
| code-review      | ---- (manuale) ------>  | snippet-manager  |
| (trova pattern   |                         | (salva pattern   |
|  riusabili)      |                         |  come snippet)   |
+------------------+                         +------------------+
        ^                                           |
        |                                           v
+------------------+                         +------------------+
| test-generator   |                         | project-         |
| (genera test     |                         | scaffolding      |
|  per snippet)    |                         | (usa snippet in  |
+------------------+                         |  template)       |
                                             +------------------+
```

- **code-review:** durante una review, salvare pattern riusabili come snippet
- **test-generator:** generare test per funzioni salvate come snippet
- **project-scaffolding:** usare snippet salvati come template per nuovi progetti

---

## Esempi di Utilizzo

### Salvare un helper React

```json
{
  "tool": "save-snippet",
  "arguments": {
    "title": "useLocalStorage Hook",
    "code": "function useLocalStorage<T>(key: string, initialValue: T) {\n  const [value, setValue] = useState<T>(() => {\n    const stored = localStorage.getItem(key);\n    return stored ? JSON.parse(stored) : initialValue;\n  });\n  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);\n  return [value, setValue] as const;\n}",
    "language": "typescript",
    "description": "Hook React per sincronizzare stato con localStorage",
    "tags": ["react", "hooks", "localstorage"]
  }
}
```

### Cercare snippet per tag

```json
{
  "tool": "search-snippets",
  "arguments": { "tag": "react" }
}
```

### Visualizzare tutti i tag disponibili

```json
{
  "tool": "list-tags",
  "arguments": {}
}
```

---

## Sviluppi Futuri

- **Versioning degli snippet:** mantenere storico delle modifiche per ogni snippet
- **Import/export:** importare snippet da Gist GitHub, esportare come file
- **Ricerca full-text avanzata:** indice FTS5 di SQLite per ricerca piu' performante
- **Snippet condivisi:** sincronizzazione tramite Event Bus con altri utenti della suite
- **Template con placeholder:** supportare variabili `{{name}}` sostituibili al momento
  dell'uso
- **Integrazione editor:** generare snippet VS Code o IntelliJ direttamente dallo store
- **Deduplicazione:** rilevare snippet duplicati o molto simili e suggerire il merge
- **Rating e statistiche:** tracciare quante volte uno snippet viene usato per ordinare
  per popolarita'
