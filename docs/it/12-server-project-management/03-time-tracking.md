# Time Tracking Server

## Panoramica

Il server **time-tracking** gestisce il tracciamento del tempo lavorato sui task, con
supporto per timer live e registrazione manuale. Mantiene uno stato persistente tramite
SQLite con due tabelle: una per i time entry registrati e una per i timer attivi.

Il server implementa una protezione contro il doppio avvio dei timer: non e' possibile
avere piu' di un timer attivo contemporaneamente per lo stesso utente.

```
+-----------------------------------------------------------------------+
|                     time-tracking server                              |
|                                                                       |
|  +-------------+  +-----------+  +----------+  +-----------------+    |
|  | start-timer |  | stop-timer|  | log-time |  | get-timesheet   |    |
|  |             |  |           |  |          |  |                 |    |
|  | previene    |  | calcola   |  | manuale  |  | filtro per      |    |
|  | doppio      |  | durata    |  | minuti   |  | date range      |    |
|  | avvio       |  | salva     |  | + data   |  |                 |    |
|  +------+------+  +-----+-----+  +----+-----+  +--------+--------+    |
|         |               |             |                 |             |
|         v               v             v                 v             |
|  +-----------------------------------------------------------+        |
|  |                   TimeStore (SQLite)                      |        |
|  |                                                           |        |
|  |  +--------------------+    +-------------------------+    |        |
|  |  | active_timers      |    | time_entries            |    |        |
|  |  | id, taskId, userId |    | id, taskId, userId      |    |        |
|  |  | startTime, desc    |    | startTime, endTime      |    |        |
|  |  +--------------------+    | durationMinutes, desc   |    |        |
|  |                            | date, createdAt         |    |        |
|  |                            +-------------------------+    |        |
|  +-----------------------------------------------------------+        |
|                                                                       |
|  Pubblica: time:entry-logged                                          |
|  Sottoscrive: scrum:task-updated (futuro: auto-timer)                 |
+-----------------------------------------------------------------------+
```

**Versione:** 0.1.0
**Entry point:** `servers/time-tracking/src/index.ts`
**Dipendenze:** `@mcp-suite/core`, `@mcp-suite/event-bus`, `@mcp-suite/database`

---

## Tabella dei Tool

| Tool | Descrizione | Parametri |
|------|-------------|-----------|
| `start-timer` | Avvia un timer per un task (previene doppio avvio) | `taskId` (string): ID del task; `description` (string, opzionale): descrizione attivita'; `userId` (string, opzionale): ID utente |
| `stop-timer` | Ferma il timer attivo, calcola la durata e salva il time entry | `userId` (string, opzionale): ID utente |
| `log-time` | Registra manualmente tempo lavorato | `taskId` (string): ID del task; `durationMinutes` (number): durata in minuti; `description` (string, opzionale); `date` (string, opzionale): data ISO; `userId` (string, opzionale) |
| `get-timesheet` | Recupera il timesheet filtrato per intervallo di date | `userId` (string, opzionale); `startDate` (string, opzionale): data inizio; `endDate` (string, opzionale): data fine |

---

## Dettaglio dei Tool

### start-timer

Avvia un nuovo timer per un task specifico. Il server implementa una protezione:
se esiste gia' un timer attivo per l'utente, l'operazione fallisce con un messaggio
di errore che indica il task attualmente tracciato.

```
  Utente invoca start-timer(taskId: "TASK-42")
       |
       v
  Verifica: esiste un timer attivo?
       |
       +--[SI]--> Errore: "Timer attivo per TASK-15. Ferma prima quello."
       |
       +--[NO]--> Crea record in active_timers
                   startTime = new Date().toISOString()
                   Restituisce { id, taskId, userId, startTime }
```

### stop-timer

Ferma il timer attivo e crea un time entry con durata calcolata automaticamente:

```
  Utente invoca stop-timer()
       |
       v
  Cerca timer attivo per userId
       |
       +--[NON TROVATO]--> Errore: "No active timer found"
       |
       +--[TROVATO]
            |
            v
       endTime = new Date().toISOString()
       durationMinutes = Math.round((endMs - startMs) / 60000)
       date = startTime.split('T')[0]
            |
            v
       INSERT INTO time_entries (...)
       DELETE FROM active_timers WHERE id = ?
            |
            v
       Pubblica time:entry-logged
       Restituisce TimeEntry completo
```

### log-time

Registrazione manuale per quando il timer non e' stato usato. Utile per registrare
tempo a posteriori o per attivita' che non richiedono tracciamento in tempo reale.

```json
{
  "tool": "log-time",
  "arguments": {
    "taskId": "TASK-42",
    "durationMinutes": 90,
    "description": "Code review della PR #15",
    "date": "2025-02-07"
  }
}
```

### get-timesheet

Restituisce il timesheet con filtri opzionali per date e utente:

```json
{
  "entries": [
    {
      "id": 1,
      "taskId": "TASK-42",
      "durationMinutes": 45,
      "description": "Implementazione API",
      "date": "2025-02-07"
    },
    {
      "id": 2,
      "taskId": "TASK-43",
      "durationMinutes": 90,
      "description": "Code review",
      "date": "2025-02-07"
    }
  ],
  "totalMinutes": 135
}
```

---

## Architettura

```
index.ts
  |
  +-- server.ts (createTimeTrackingServer)
  |     |
  |     +-- crea TimeStore
  |     +-- registra 4 tool
  |     +-- setupCollaborationHandlers(eventBus, store)
  |
  +-- services/
  |     +-- time-store.ts  --> TimeStore
  |
  +-- tools/
  |     +-- start-timer.ts
  |     +-- stop-timer.ts
  |     +-- log-time.ts
  |     +-- get-timesheet.ts
  |
  +-- collaboration.ts  --> gestori eventi
```

### TimeStore

**Schema della tabella `time_entries`:**

| Colonna | Tipo | Note |
|---------|------|------|
| `id` | INTEGER PK | Auto-increment |
| `taskId` | TEXT NN | ID del task |
| `userId` | TEXT | Default 'default' |
| `startTime` | TEXT | Nullable (null per log manuali) |
| `endTime` | TEXT | Nullable (null per log manuali) |
| `durationMinutes` | INTEGER NN | Durata in minuti |
| `description` | TEXT | Nullable |
| `date` | TEXT NN | Data ISO (YYYY-MM-DD) |
| `createdAt` | TEXT NN | datetime('now') |

**Schema della tabella `active_timers`:**

| Colonna | Tipo | Note |
|---------|------|------|
| `id` | INTEGER PK | Auto-increment |
| `taskId` | TEXT NN | ID del task |
| `userId` | TEXT | Default 'default' |
| `startTime` | TEXT NN | Timestamp ISO di avvio |
| `description` | TEXT | Nullable |

Il TimeStore offre anche metodi aggiuntivi non esposti come tool:
- `getTaskTime(taskId)` - tempo totale per un task specifico
- `editEntry(id, updates)` - modifica un time entry esistente
- `deleteEntry(id)` - elimina un time entry

---

## Integrazione Event Bus

### Eventi pubblicati

| Evento | Payload | Emesso da |
|--------|---------|-----------|
| `time:entry-logged` | `{ taskId, userId, durationMinutes, date }` | `stop-timer`, `log-time` |

### Eventi sottoscritti

| Evento | Sorgente | Azione |
|--------|----------|--------|
| `scrum:task-updated` | scrum-board | (Futuro) Avvio/stop automatico del timer al cambio stato task |

---

## Interazioni con altri Server

```
+------------------+     scrum:task-updated       +------------------+
| scrum-board      | ---------------------------> | time-tracking    |
+------------------+                              |                  |
                                                  |  time:entry-     |
+------------------+     time:entry-logged        |  logged          |
| project-economics| <--------------------------- |                  |
+------------------+                              +------------------+
```

- **scrum-board (input):** il cambio stato di un task potrebbe in futuro avviare/fermare
  automaticamente il timer
- **project-economics (output):** i time entry alimentano il calcolo dei costi del progetto
  quando il server economics sottoscrive `time:entry-logged`

---

## Esempi di Utilizzo

### Flusso completo con timer

```json
// 1. Avviare il timer
{ "tool": "start-timer", "arguments": { "taskId": "TASK-42", "description": "Sviluppo feature login" } }

// 2. ... lavorare sul task ...

// 3. Fermare il timer
{ "tool": "stop-timer", "arguments": {} }

// 4. Consultare il timesheet della settimana
{ "tool": "get-timesheet", "arguments": { "startDate": "2025-02-03", "endDate": "2025-02-07" } }
```

### Registrazione manuale

```json
{
  "tool": "log-time",
  "arguments": {
    "taskId": "TASK-50",
    "durationMinutes": 120,
    "description": "Meeting di pianificazione sprint",
    "date": "2025-02-03"
  }
}
```

---

## Sviluppi Futuri

- **Auto-timer su task status:** avviare automaticamente il timer quando un task passa
  a `in_progress` e fermarlo quando passa a `in_review` o `done`
- **Report settimanali automatici:** generare report aggregati per utente e progetto
- **Integrazione con project-economics:** convertire minuti in costi basati sulla tariffa
  oraria definita nel budget
- **Pomodoro mode:** supporto per timer Pomodoro con pause programmate
- **Notifiche overtime:** avvisare quando il tempo su un task supera la stima
- **Analisi produttivita':** grafici di distribuzione del tempo per categoria di attivita'
- **Multi-utente:** supporto completo per team con report comparativi
- **Export timesheet:** esportare in formato CSV o compatibile con tool di fatturazione
