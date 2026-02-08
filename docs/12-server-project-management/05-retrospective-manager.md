# Retrospective Manager Server

## Panoramica

Il server **retrospective-manager** gestisce il ciclo completo delle retrospettive agili:
dalla creazione della sessione con formato specifico, alla raccolta del feedback per
categoria, al sistema di votazione, fino alla generazione automatica di action item dai
temi piu' votati.

Supporta tre formati di retrospettiva standard, ognuno con le proprie categorie:

```
  +------------------------+   +---------------------+   +-----------------------+
  |   MAD - SAD - GLAD     |   |         4Ls         |   | START - STOP - CONT.  |
  +------------------------+   +---------------------+   +-----------------------+
  |  mad: cosa ti ha       |   | liked: cosa ci e'   |   | start: cosa iniziare  |
  |       fatto arrabbiare |   | piaciuto            |   | stop: cosa smettere   |
  |  sad: cosa ti ha       |   | learned: cosa       |   | continue: cosa        |
  |       reso triste      |   | abbiamo imparato    |   | continuare a fare     |
  |  glad: cosa ti ha      |   | lacked: cosa e'     |   |                       |
  |        reso felice     |   | mancato             |   |                       |
  |                        |   | longed-for: cosa    |   |                       |
  |                        |   | avremmo voluto      |   |                       |
  +------------------------+   +---------------------+   +-----------------------+
```

Il server e' uno dei piu' attivi nella rete di collaborazione della MCP Suite:
pubblica action item che vengono raccolti dallo scrum-board e sottoscrive eventi
per creare retrospettive automatiche alla fine di uno sprint o dopo build fallite.

```
+------------------------------------------------------------------------------+
|                 retrospective-manager server                                 |
|                                                                              |
|  +-------------+ +----------+ +-----------+ +------------------+ +---------+ |
|  |create-retro | |add-retro-| |vote-retro-| |generate-action-  | |get-retro| |
|  |             | |item      | |item       | |items             | |         | |
|  | 3 formati   | | validaz. | | +1 voto   | | top-N votati     | |         | |
|  | categorie   | | per cat. | |           | | crea action      | |         | |
|  +------+------+ +----+-----+ +-----+-----+ +--------+---------+ +----+----+ |
|         |             |             |                |                |      |
|         v             v             v                v                v      |
|  +----------------------------------------------------------------------+    |
|  |                   RetroStore (SQLite)                                |    |
|  |                                                                      |    |
|  |  +----------+         +-------------+          +------------------+  |    |
|  |  | retros   |         | retro_items |          | action_items     |  |    |
|  |  | id       |         | id          |          | id               |  |    |
|  |  | sprintId |         | retroId(FK) |          | retroId (FK)     |  |    |
|  |  | format   |         | category    |          | description      |  |    |
|  |  | status   |         | content     |          | assignee         |  |    |
|  |  | createdAt|         | votes       |          | dueDate, status  |  |    |
|  |  +----------+         | authorId    |          | createdAt        |  |    |
|  |                       +-------------+          +------------------+  |    |
|  +----------------------------------------------------------------------+    |
|                                                                              |
|  Pubblica: retro:action-item-created                                         |
|  Sottoscrive: scrum:sprint-completed, cicd:build-failed                      |
+------------------------------------------------------------------------------+
```

**Versione:** 0.1.0
**Entry point:** `servers/retrospective-manager/src/index.ts`
**Dipendenze:** `@mcp-suite/core`, `@mcp-suite/event-bus`, `@mcp-suite/database`

---

## Tabella dei Tool

| Tool | Descrizione | Parametri |
|------|-------------|-----------|
| `create-retro` | Crea una nuova retrospettiva con formato specifico | `format` (enum: `mad-sad-glad`, `4ls`, `start-stop-continue`); `sprintId` (string, opzionale) |
| `add-retro-item` | Aggiunge un elemento alla retrospettiva (con validazione categoria) | `retroId` (number); `category` (string): deve essere valida per il formato; `content` (string); `authorId` (string, opzionale) |
| `vote-retro-item` | Aggiunge un voto a un elemento | `itemId` (number) |
| `generate-action-items` | Genera action item dagli elementi piu' votati | `retroId` (number); `topN` (number, default: 3): quanti elementi considerare |
| `get-retro` | Recupera la retrospettiva completa con elementi e action item | `retroId` (number) |

---

## Dettaglio dei Tool

### create-retro

Crea una nuova retrospettiva con il formato specificato. Le categorie valide vengono
determinate automaticamente dal formato:

| Formato | Categorie valide |
|---------|-----------------|
| `mad-sad-glad` | `mad`, `sad`, `glad` |
| `4ls` | `liked`, `learned`, `lacked`, `longed-for` |
| `start-stop-continue` | `start`, `stop`, `continue` |

```json
{
  "tool": "create-retro",
  "arguments": {
    "format": "mad-sad-glad",
    "sprintId": "sprint-14"
  }
}
```

### add-retro-item

Aggiunge un elemento alla retrospettiva. Il server **valida la categoria** verificando
che sia coerente con il formato della retrospettiva. Se la categoria non e' valida,
restituisce un errore con l'elenco delle categorie ammesse.

```
  add-retro-item(retroId: 1, category: "happy", content: "...")
       |
       v
  Verifica formato retro #1 = "mad-sad-glad"
  Categorie valide: ["mad", "sad", "glad"]
  "happy" NON e' valida
       |
       v
  Errore: 'Invalid category "happy" for format "mad-sad-glad".
           Valid categories: mad, sad, glad'
```

### vote-retro-item

Incrementa di 1 il contatore `votes` di un elemento. Non c'e' limite al numero di
voti che un elemento puo' ricevere (votazione aperta).

### generate-action-items

Seleziona i top-N elementi piu' votati della retrospettiva e genera un action item
per ciascuno. La descrizione dell'action item include la categoria originale come
prefisso: `[categoria] contenuto`.

```
  Top 3 votati --> Action Items:
  1. [mad] Deploy troppo lento (8 voti)
  2. [sad] Manca documentazione (6 voti)
  3. [glad] Code review migliora qualita' (5 voti)
```

Ogni action item generato pubblica l'evento `retro:action-item-created` che viene
intercettato dallo scrum-board per creare task nel backlog.

### get-retro

Restituisce la retrospettiva completa in formato `FullRetro`:

```json
{
  "retro": { "id": 1, "format": "mad-sad-glad", "status": "active" },
  "categories": {
    "mad": [{ "id": 1, "content": "Deploy lento", "votes": 8 }],
    "sad": [{ "id": 2, "content": "Manca documentazione", "votes": 6 }],
    "glad": [{ "id": 3, "content": "Code review efficaci", "votes": 5 }]
  },
  "actionItems": [{ "id": 1, "description": "[mad] Deploy lento", "status": "open" }]
}
```

---

## Architettura

```
index.ts
  |
  +-- server.ts (createRetrospectiveManagerServer)
  |     |
  |     +-- crea RetroStore
  |     +-- registra 5 tool
  |     +-- setupCollaborationHandlers(eventBus, store)
  |
  +-- services/
  |     +-- retro-store.ts  --> RetroStore
  |
  +-- tools/
  |     +-- create-retro.ts
  |     +-- add-item.ts
  |     +-- vote-item.ts
  |     +-- generate-action-items.ts
  |     +-- get-retro.ts
  |
  +-- collaboration.ts  --> gestori eventi cross-server
```

### RetroStore

**Schema tabella `retros`:**

| Colonna | Tipo | Note |
|---------|------|------|
| `id` | INTEGER PK | Auto-increment |
| `sprintId` | TEXT | Nullable, collegamento sprint |
| `format` | TEXT NN | 'mad-sad-glad', '4ls', 'start-stop-continue' |
| `status` | TEXT NN | Default 'active' |
| `createdAt` | TEXT NN | datetime('now') |

**Schema tabella `retro_items`:**

| Colonna | Tipo | Note |
|---------|------|------|
| `id` | INTEGER PK | Auto-increment |
| `retroId` | INTEGER FK NN | Riferimento a retros(id) |
| `category` | TEXT NN | Validata dal formato |
| `content` | TEXT NN | Testo dell'elemento |
| `votes` | INTEGER NN | Default 0 |
| `authorId` | TEXT | Nullable |

**Schema tabella `action_items`:**

| Colonna | Tipo | Note |
|---------|------|------|
| `id` | INTEGER PK | Auto-increment |
| `retroId` | INTEGER FK NN | Riferimento a retros(id) |
| `description` | TEXT NN | Descrizione action item |
| `assignee` | TEXT | Nullable |
| `dueDate` | TEXT | Nullable |
| `status` | TEXT NN | Default 'open' |
| `createdAt` | TEXT NN | datetime('now') |

La costante `FORMAT_CATEGORIES` mappa ogni formato alle sue categorie valide, usata
per la validazione in `addItem()`.

---

## Integrazione Event Bus

### Eventi pubblicati

| Evento | Payload | Emesso da |
|--------|---------|-----------|
| `retro:action-item-created` | `{ retroId, actionItemId, description, assignee }` | `generate-action-items` |

### Eventi sottoscritti

| Evento | Sorgente | Azione |
|--------|----------|--------|
| `scrum:sprint-completed` | scrum-board | Crea automaticamente una nuova retrospettiva per lo sprint appena completato |
| `cicd:build-failed` | cicd-monitor | Aggiunge automaticamente un item "build failed" nella categoria appropriata della retro attiva |

---

## Interazioni con altri Server

```
                scrum:sprint-completed
  scrum-board --------------------------> retrospective-manager
                                                |
                retro:action-item-created       |
  scrum-board <--------------------------       |
  (crea task                                    |
   nel backlog)                                 |
                                                |
                cicd:build-failed               |
  cicd-monitor --------------------------->     |
```

Il flusso bidirezionale con lo scrum-board e' uno dei cicli di feedback piu' importanti
della MCP Suite:

1. Lo sprint si completa --> scrum-board pubblica `scrum:sprint-completed`
2. Il retrospective-manager crea automaticamente una retro
3. Il team aggiunge item e vota
4. Le action item generate vengono pubblicate come `retro:action-item-created`
5. Lo scrum-board riceve l'evento e crea task nel backlog

---

## Esempi di Utilizzo

### Workflow completo di una retrospettiva

```json
// 1. Creare la retrospettiva
{ "tool": "create-retro", "arguments": { "format": "start-stop-continue", "sprintId": "sprint-14" } }

// 2. Raccogliere feedback
{ "tool": "add-retro-item", "arguments": { "retroId": 1, "category": "start", "content": "Pair programming settimanale" } }
{ "tool": "add-retro-item", "arguments": { "retroId": 1, "category": "stop", "content": "Deploy il venerdi'" } }
{ "tool": "add-retro-item", "arguments": { "retroId": 1, "category": "continue", "content": "Code review sistematiche" } }

// 3. Votare
{ "tool": "vote-retro-item", "arguments": { "itemId": 2 } }
{ "tool": "vote-retro-item", "arguments": { "itemId": 2 } }
{ "tool": "vote-retro-item", "arguments": { "itemId": 1 } }

// 4. Generare action items (top 2)
{ "tool": "generate-action-items", "arguments": { "retroId": 1, "topN": 2 } }

// 5. Visualizzare il risultato completo
{ "tool": "get-retro", "arguments": { "retroId": 1 } }
```

---

## Sviluppi Futuri

- **Formati personalizzabili:** definizione di formati custom con categorie arbitrarie
- **Anonimato garantito:** modalita' anonima senza tracciamento authorId
- **Timer per fasi:** timer configurabile per raccolta, voto e discussione
- **Storico retrospettive:** confrontare action item tra sprint diversi
- **Sentiment analysis:** analisi del tono dei feedback per trend emotivi del team
- **Integrazione standup:** action item aperte menzionate nei report di standup
- **Metriche:** tracciare quante action item vengono completate tra sprint
