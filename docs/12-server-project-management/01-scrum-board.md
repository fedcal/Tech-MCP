# Scrum Board Server -- HUB CENTRALE

## Panoramica

Il server **scrum-board** e' il **cuore operativo** dell'intera MCP Suite. Gestisce sprint,
user story e task secondo la metodologia Scrum, fungendo da hub centrale attraverso il
quale transitano la maggior parte dei flussi di lavoro collaborativi. Praticamente ogni
altro server di project management interagisce con scrum-board, direttamente o tramite
gli eventi che pubblica.

```
                        +---------------------------+
                        |     SCRUM-BOARD SERVER    |
                        |       HUB CENTRALE        |
                        +---------------------------+
                       /     |       |        |      \
                      /      |       |        |       \
                     v       v       v        v        v
              +-------+ +-------+ +------+ +-------+ +-------+
              |agile  | |time   | |retro | |standup| |project|
              |metrics| |track. | |mgr   | |notes  | |econ.  |
              +-------+ +-------+ +------+ +-------+ +-------+

  scrum:task-updated -----> [tutti i server sottoscritti]
  scrum:sprint-started ---> [agile-metrics, retro, standup]
  retro:action-item ------> [scrum-board riceve]
```

Il server e' il principale **produttore di eventi** della suite e uno dei pochi che
**sottoscrive** eventi da altri server (riceve action item dalle retrospettive).

**Versione:** 0.1.0
**Entry point:** `servers/scrum-board/src/index.ts`
**Dipendenze:** `@mcp-suite/core`, `@mcp-suite/event-bus`, `@mcp-suite/database`

---

## Tabella dei Tool

| Tool | Descrizione | Parametri |
|------|-------------|-----------|
| `create-sprint` | Crea un nuovo sprint | `name` (string): nome sprint; `startDate` (string): data inizio; `endDate` (string): data fine; `goals` (string[]): obiettivi dello sprint |
| `get-sprint` | Recupera i dettagli di uno sprint | `sprintId` (number): ID dello sprint |
| `create-story` | Crea una nuova user story | `title` (string); `description` (string); `acceptanceCriteria` (string[]); `storyPoints` (number); `priority` (string); `sprintId` (number, opzionale) |
| `create-task` | Crea un nuovo task associato a una story | `title` (string); `description` (string); `storyId` (number); `assignee` (string, opzionale) |
| `update-task-status` | Aggiorna lo stato di un task | `taskId` (number); `status` (enum: todo/in_progress/in_review/done/blocked) |
| `sprint-board` | Visualizzazione Kanban dello sprint corrente | `sprintId` (number, opzionale; default: sprint attivo) |
| `get-backlog` | Recupera tutte le story non assegnate a sprint | Nessun parametro |

---

## Dettaglio dei Tool

### create-sprint

Crea un nuovo sprint nel database con stato iniziale `planning`. I goals sono memorizzati
come array JSON.

```json
{
  "tool": "create-sprint",
  "arguments": {
    "name": "Sprint 14 - Autenticazione",
    "startDate": "2025-02-03",
    "endDate": "2025-02-14",
    "goals": [
      "Implementare login OAuth",
      "Aggiungere 2FA",
      "Test di sicurezza"
    ]
  }
}
```

### update-task-status

Aggiorna lo stato di un task attraverso il flusso Kanban:

```
  +-------+     +-------------+     +-----------+     +------+
  | todo  | --> | in_progress | --> | in_review | --> | done |
  +-------+     +-------------+     +-----------+     +------+
      |               |                   |
      +-------+-------+-------------------+
              |
              v
          +--------+
          | blocked|
          +--------+
```

Ogni cambio di stato pubblica l'evento `scrum:task-updated` che attiva reazioni a catena
negli altri server.

### sprint-board

Genera una vista Kanban completa dello sprint, organizzando i task in colonne:

```
+--------------------------------------------------------------------+
|                   Sprint Board: Sprint 14                          |
+--------------------------------------------------------------------+
| TODO          | IN PROGRESS   | IN REVIEW     | DONE    | BLOCKED  |
|---------------|---------------|---------------|---------|----------|
| Task: Setup   | Task: Login   | Task: Test    | Task:   | Task:    |
|   OAuth       |   form UI     |   OAuth flow  |  DB     |  Deploy  |
|               |               |               | schema  |  (needs  |
| Task: 2FA     | Task: Token   |               |         |  infra)  |
|   research    |   refresh     |               |         |          |
+--------------------------------------------------------------------+
```

Se non viene specificato `sprintId`, recupera automaticamente lo sprint con stato `active`.

### get-backlog

Restituisce tutte le story con `sprintId IS NULL`, ordinate per priorita' e data di
creazione. Rappresenta il product backlog non ancora pianificato.

---

## Architettura

```
index.ts
  |
  +-- server.ts (createScrumBoardServer)
  |     |
  |     +-- crea ScrumStore
  |     +-- registra 7 tool
  |     +-- setupCollaborationHandlers(eventBus, store)
  |
  +-- services/
  |     +-- scrum-store.ts  --> ScrumStore (gestisce sprints, stories, tasks)
  |
  +-- tools/
  |     +-- create-sprint.ts
  |     +-- get-sprint.ts
  |     +-- create-story.ts
  |     +-- create-task.ts
  |     +-- update-task-status.ts
  |     +-- sprint-board.ts
  |     +-- get-backlog.ts
  |
  +-- collaboration.ts  --> gestori eventi cross-server
```

### ScrumStore

Lo store gestisce tre tabelle SQLite interconnesse tramite foreign key:

```
+------------------+       +-------------------+       +------------------+
|     sprints      |       |      stories      |       |      tasks       |
+------------------+       +-------------------+       +------------------+
| id (PK)          |<------| sprintId (FK)     |       | id (PK)          |
| name             |       | id (PK)           |<------| storyId (FK, NN) |
| startDate        |       | title             |       | sprintId (FK)    |
| endDate          |       | description       |       | title            |
| goals (JSON)     |       | acceptanceCriteria|       | description      |
| status           |       | storyPoints       |       | status           |
| createdAt        |       | priority          |       | assignee         |
+------------------+       | status            |       | createdAt        |
                           | createdAt         |       | updatedAt        |
                           | updatedAt         |       +------------------+
                           +-------------------+
```

**Schema delle tabelle:**

| Tabella | Colonna | Tipo | Note |
|---------|---------|------|------|
| sprints | id | INTEGER PK | Auto-increment |
| sprints | name | TEXT NN | Nome sprint |
| sprints | startDate | TEXT NN | Data inizio ISO |
| sprints | endDate | TEXT NN | Data fine ISO |
| sprints | goals | TEXT NN | JSON array, default '[]' |
| sprints | status | TEXT NN | Default 'planning' |
| sprints | createdAt | TEXT NN | datetime('now') |
| stories | id | INTEGER PK | Auto-increment |
| stories | title | TEXT NN | Titolo story |
| stories | description | TEXT NN | Default '' |
| stories | acceptanceCriteria | TEXT NN | JSON array |
| stories | storyPoints | INTEGER NN | Default 0 |
| stories | priority | TEXT NN | Default 'medium' |
| stories | status | TEXT NN | Default 'todo' |
| stories | sprintId | INTEGER FK | Riferimento a sprints(id), nullable |
| tasks | id | INTEGER PK | Auto-increment |
| tasks | title | TEXT NN | Titolo task |
| tasks | description | TEXT NN | Default '' |
| tasks | status | TEXT NN | Default 'todo' |
| tasks | assignee | TEXT | Nullable |
| tasks | storyId | INTEGER FK NN | Riferimento a stories(id) |
| tasks | sprintId | INTEGER FK | Derivato dalla story, nullable |

**Nota:** quando viene creato un task, lo `sprintId` viene automaticamente derivato
dalla story padre.

---

## Integrazione Event Bus

### Eventi pubblicati

| Evento | Payload | Emesso da |
|--------|---------|-----------|
| `scrum:sprint-started` | `{ sprintId, name, startDate, endDate }` | `create-sprint` |
| `scrum:task-updated` | `{ taskId, status, previousStatus, storyId, sprintId }` | `update-task-status` |

### Eventi sottoscritti

| Evento | Sorgente | Azione |
|--------|----------|--------|
| `retro:action-item-created` | retrospective-manager | Crea automaticamente un task nel backlog dalla action item della retrospettiva |

### Flusso degli eventi

```
  scrum-board                    altri server
  -----------                    ------------

  create-sprint
       |
       +---> scrum:sprint-started ---> agile-metrics (nuova velocity)
                                  ---> retrospective-manager (trigger retro)
                                  ---> standup-notes (contestualizza report)

  update-task-status
       |
       +---> scrum:task-updated -----> agile-metrics (ricalcola burndown)
                                  ---> time-tracking (futuro: auto-timer)
                                  ---> standup-notes (auto-log attivita')
                                  ---> project-economics (traccia costi)

  [riceve] retro:action-item-created
       |
       +---> crea task nel backlog automaticamente
```

---

## Interazioni con altri Server

Lo scrum-board e' il server con il maggior numero di interazioni:

| Server | Tipo | Descrizione |
|--------|------|-------------|
| agile-metrics | Pubblica verso | Fornisce dati per velocity, burndown, cycle time |
| time-tracking | Pubblica verso | Trigger per auto-timer su cambio stato task |
| retrospective-manager | Bidirezionale | Riceve action item, pubblica completamento sprint |
| standup-notes | Pubblica verso | Aggiornamenti task alimentano standup automatici |
| project-economics | Pubblica verso | Completamento sprint trigger analisi costi |

---

## Esempi di Utilizzo

### Workflow completo di uno sprint

```json
// 1. Creare lo sprint
{ "tool": "create-sprint", "arguments": { "name": "Sprint 14", "startDate": "2025-02-03", "endDate": "2025-02-14", "goals": ["Feature login"] } }

// 2. Creare una story
{ "tool": "create-story", "arguments": { "title": "Login OAuth Google", "description": "Come utente voglio...", "acceptanceCriteria": ["Redirect a Google", "Token salvato", "Sessione attiva"], "storyPoints": 8, "priority": "high", "sprintId": 1 } }

// 3. Creare task per la story
{ "tool": "create-task", "arguments": { "title": "Configurare OAuth credentials", "description": "Setup su Google Cloud Console", "storyId": 1, "assignee": "mario" } }

// 4. Aggiornare lo stato
{ "tool": "update-task-status", "arguments": { "taskId": 1, "status": "in_progress" } }

// 5. Visualizzare la board
{ "tool": "sprint-board", "arguments": { "sprintId": 1 } }

// 6. Consultare il backlog
{ "tool": "get-backlog", "arguments": {} }
```

---

## Sviluppi Futuri

- **Sprint planning automatico:** suggerire story dal backlog basandosi sulla velocity
  storica calcolata da agile-metrics
- **Notifiche di blocco:** quando un task passa a `blocked`, notificare automaticamente
  il team tramite standup-notes
- **Velocity tracking integrato:** calcolare automaticamente la velocity di ogni sprint
  al momento della chiusura
- **Dipendenze tra task:** supportare relazioni `blocks/blocked-by` tra task
- **Assegnazione intelligente:** suggerire l'assignee basandosi sul carico di lavoro
  corrente tracciato da time-tracking
- **Burndown automatico:** generare dati di burndown in tempo reale ad ogni cambio
  stato task
- **Integrazione GitHub/GitLab:** collegare task a pull request e branch
