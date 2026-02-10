# Standup Notes Server

## Panoramica

Il server **standup-notes** gestisce la registrazione e l'aggregazione dei daily standup
meeting. Segue il formato classico Scrum con tre domande fondamentali: cosa hai fatto
ieri, cosa farai oggi, ci sono blocchi? Oltre alla semplice registrazione, offre la
generazione automatica di status report strutturati che aggregano le informazioni degli
standup in un periodo configurabile.

```
+------------------------------------------------------------------------+
|                      standup-notes server                              |
|                                                                        |
|  +--------------+   +-------------------+   +------------------------+ |
|  | log-standup  |   | get-standup-      |   | generate-status-report | |
|  |              |   | history           |   |                        | |
|  | yesterday    |   | ultimi N giorni   |   | accomplishments        | |
|  | today        |   |                   |   | current work           | |
|  | blockers     |   |                   |   | blockers               | |
|  +------+-------+   +--------+----------+   +-----------+------------+ |
|         |                    |                           |             |
|         v                    v                           v             |
|  +------------------------------------------------------------+        |
|  |                  StandupStore (SQLite)                     |        |
|  |                                                            |        |
|  |  +------------------------------------------------------+  |        |
|  |  | standups                                             |  |        |
|  |  | id | userId | date | yesterday | today | blockers    |  |        |
|  |  | createdAt                                            |  |        |
|  |  +------------------------------------------------------+  |        |
|  +------------------------------------------------------------+        |
|                                                                        |
|  Pubblica: standup:report-generated                                    |
|  Sottoscrive: scrum:task-updated, cicd:build-failed                    |
+------------------------------------------------------------------------+
```

**Versione:** 0.1.0
**Entry point:** `servers/standup-notes/src/index.ts`
**Dipendenze:** `@mcp-suite/core`, `@mcp-suite/event-bus`, `@mcp-suite/database`

---

## Tabella dei Tool

| Tool | Descrizione | Parametri |
|------|-------------|-----------|
| `log-standup` | Registra lo standup giornaliero | `yesterday` (string): cosa e' stato fatto ieri; `today` (string): cosa si fara' oggi; `blockers` (string, opzionale): blocchi correnti |
| `get-standup-history` | Recupera lo storico degli standup | `days` (number, default: 7): numero di giorni da recuperare |
| `generate-status-report` | Genera un report strutturato aggregando gli standup | `days` (number, default: 7): periodo del report in giorni |

---

## Dettaglio dei Tool

### log-standup

Registra un nuovo standup con data automatica (giorno corrente). L'userId e' impostato
a `'default'` per la versione attuale (single-user).

```json
{
  "tool": "log-standup",
  "arguments": {
    "yesterday": "Completata implementazione API login OAuth, code review PR #42",
    "today": "Iniziare integrazione 2FA, fix bug sessione scaduta",
    "blockers": "In attesa di credenziali OAuth dal team infrastruttura"
  }
}
```

Il tool pubblica l'evento `standup:report-generated` dopo la registrazione per notificare
gli altri server.

### get-standup-history

Recupera gli standup degli ultimi N giorni, ordinati per data decrescente. La query
filtra per `date >= cutoffDate` dove la data di cutoff e' calcolata come
`oggi - N giorni`.

```json
{
  "tool": "get-standup-history",
  "arguments": { "days": 5 }
}
```

**Output:**
```json
[
  {
    "id": 5,
    "userId": "default",
    "date": "2025-02-07",
    "yesterday": "Fix bug sessione",
    "today": "Test integrazione 2FA",
    "blockers": null,
    "createdAt": "2025-02-07T09:00:00Z"
  },
  {
    "id": 4,
    "userId": "default",
    "date": "2025-02-06",
    "yesterday": "Implementazione 2FA",
    "today": "Fix bug sessione scaduta",
    "blockers": "Credenziali OAuth in attesa"
  }
]
```

### generate-status-report

Aggrega tutti gli standup di un periodo e genera un report strutturato con tre sezioni:

```
=== Status Report ===
Period: 2025-02-03 to 2025-02-07 (7 days)
Total standups: 5

--- Accomplishments ---
  - [2025-02-07] Test integrazione 2FA completato
  - [2025-02-06] Fix bug sessione scaduta
  - [2025-02-05] Implementazione 2FA
  - [2025-02-04] Code review PR #42
  - [2025-02-03] Implementazione API login OAuth

--- Current Work ---
  - [2025-02-07] Preparazione deploy staging

--- Blockers ---
  - [2025-02-06] Credenziali OAuth in attesa
```

**Struttura output programmatica:**

```json
{
  "period": { "from": "2025-02-03", "to": "2025-02-07", "days": 7 },
  "totalStandups": 5,
  "accomplishments": ["[2025-02-07] Test integrazione...", "..."],
  "currentWork": ["[2025-02-07] Preparazione deploy..."],
  "blockers": ["[2025-02-06] Credenziali OAuth..."],
  "report": "=== Status Report ===\n..."
}
```

L'output include sia i dati strutturati (array per ogni sezione) sia il report
formattato come stringa leggibile.

---

## Architettura

```
index.ts
  |
  +-- server.ts (createStandupNotesServer)
  |     |
  |     +-- crea StandupStore
  |     +-- registra 3 tool
  |     +-- setupCollaborationHandlers(eventBus, store)
  |
  +-- services/
  |     +-- standup-store.ts  --> StandupStore
  |
  +-- tools/
  |     +-- log-standup.ts
  |     +-- get-standup-history.ts
  |     +-- generate-status-report.ts
  |
  +-- collaboration.ts  --> gestori eventi cross-server
```

### StandupStore

**Schema della tabella `standups`:**

| Colonna | Tipo | Note |
|---------|------|------|
| `id` | INTEGER PK | Auto-increment |
| `userId` | TEXT NN | Default 'default' |
| `date` | TEXT NN | Data ISO (YYYY-MM-DD), generata automaticamente |
| `yesterday` | TEXT NN | Cosa e' stato fatto ieri |
| `today` | TEXT NN | Cosa si fara' oggi |
| `blockers` | TEXT | Nullable |
| `createdAt` | TEXT NN | datetime('now') |

I metodi principali dello store sono:
- `logStandup(yesterday, today, blockers?)` - registra e restituisce lo standup
- `getStandupHistory(days)` - recupera standup recenti
- `generateStatusReport(days)` - aggrega e produce il report

---

## Integrazione Event Bus

### Eventi pubblicati

| Evento | Payload | Emesso da |
|--------|---------|-----------|
| `standup:report-generated` | `{ period, totalStandups, hasBlockers }` | `log-standup` |

### Eventi sottoscritti

| Evento | Sorgente | Azione |
|--------|----------|--------|
| `scrum:task-updated` | scrum-board | Annota automaticamente il cambio di stato del task come attivita' nel prossimo standup |
| `cicd:build-failed` | cicd-monitor | Registra il fallimento della build come blocker potenziale |

### Flusso collaborativo

```
  scrum-board                          standup-notes
  -----------                          -------------

  update-task-status(TASK-42, "done")
       |
       +---> scrum:task-updated ------> [registra come accomplishment]
                                         "TASK-42 completato"

  cicd-monitor
  ------------

  build #15 fallita
       |
       +---> cicd:build-failed -------> [registra come potenziale blocker]
                                         "Build #15 fallita su main"
```

---

## Interazioni con altri Server

```
+------------------+     scrum:task-updated       +------------------+
| scrum-board      | ---------------------------> | standup-notes    |
+------------------+                              |                  |
                                                  |                  |
+------------------+     cicd:build-failed        |                  |
| cicd-monitor     | ---------------------------> |                  |
+------------------+                              |                  |
                                                  | standup:report-  |
                                                  | generated        |
                                                  +--------+---------+
                                                           |
                                                           v
                                                  (consumatori futuri)
```

- **scrum-board:** i cambi di stato dei task arricchiscono automaticamente i dati
  degli standup
- **cicd-monitor:** build fallite vengono segnalate come blocchi potenziali
- **retrospective-manager:** i blocker ricorrenti potrebbero alimentare automaticamente
  le retrospettive

---

## Esempi di Utilizzo

### Standup giornaliero

```json
{
  "tool": "log-standup",
  "arguments": {
    "yesterday": "Completata feature OAuth login (#42), review PR di Luigi (#45)",
    "today": "Iniziare 2FA implementation, meeting con team design alle 11",
    "blockers": "Server staging non raggiungibile da ieri sera"
  }
}
```

### Consultare la settimana

```json
{
  "tool": "get-standup-history",
  "arguments": { "days": 7 }
}
```

### Generare report per il manager

```json
{
  "tool": "generate-status-report",
  "arguments": { "days": 14 }
}
```

Questo genera un report delle ultime due settimane (uno sprint completo), perfetto
per aggiornamenti al management o al product owner.

---

## Sviluppi Futuri

- **Multi-utente:** supporto per team con report aggregati per persona
- **Template personalizzabili:** campi custom oltre a yesterday/today/blockers
- **Notifiche blocker:** notifica automatica allo scrum master
- **Trend analysis:** identificare blocker ricorrenti e suggerire azioni correttive
- **Standup asincroni:** supporto per team remoti in timezone diversi
- **AI summary:** riassunto automatico dei temi della settimana
- **Export per stakeholder:** report PDF o email-ready per comunicazione esterna
