# Project Economics Server

## Panoramica

Il server **project-economics** gestisce il budget e i costi di progetto, fornendo
visibilita' sulla spesa, breakdown per categoria e previsioni di esaurimento budget.
Include un sistema di alert automatico che pubblica un evento quando il budget utilizzato
raggiunge o supera l'80%.

```
+------------------------------------------------------------------------+
|                   project-economics server                             |
|                                                                        |
|  +-----------+  +----------+  +-----------------+  +-----------------+ |
|  |set-budget |  |log-cost  |  |get-budget-status|  |forecast-budget  | |
|  |           |  |          |  |                 |  |                 | |
|  | nome,     |  | categoria|  | totale/speso/   |  | burn rate       | |
|  | totale,   |  | importo  |  | rimanente/%     |  | giorni riman.   | |
|  | valuta EUR|  | descriz. |  | breakdown       |  | data esaurim.   | |
|  +-----+-----+  +----+-----+  +--------+--------+  +--------+--------+ |
|        |             |                 |                    |          |
|        v             v                 v                    v          |
|  +-----------------------------------------------------------+         |
|  |                 EconomicsStore (SQLite)                   |         |
|  |                                                           |         |
|  |  +-------------------+    +---------------------------+   |         |
|  |  | budgets           |    | costs                     |   |         |
|  |  | id, projectName   |    | id, budgetId (FK)         |   |         |
|  |  | totalBudget       |    | category, amount          |   |         |
|  |  | currency (EUR)    |    | description, date, taskId |   |         |
|  |  | createdAt         |    | createdAt                 |   |         |
|  |  +-------------------+    +---------------------------+   |         |
|  +-----------------------------------------------------------+         |
|                                                                        |
|  Pubblica: economics:cost-updated, economics:budget-alert (>=80%)      |
|  Sottoscrive: time:entry-logged, scrum:sprint-completed                |
+------------------------------------------------------------------------+
```

**Versione:** 0.1.0
**Entry point:** `servers/project-economics/src/index.ts`
**Dipendenze:** `@mcp-suite/core`, `@mcp-suite/event-bus`, `@mcp-suite/database`

---

## Tabella dei Tool

| Tool | Descrizione | Parametri |
|------|-------------|-----------|
| `set-budget` | Definisce o aggiorna il budget di un progetto | `projectName` (string): nome progetto; `totalBudget` (number): budget totale; `currency` (string, default: 'EUR'): valuta |
| `log-cost` | Registra un costo nel progetto | `projectName` (string): nome progetto; `category` (string): categoria spesa; `amount` (number): importo; `description` (string): descrizione; `date` (string, opzionale); `taskId` (string, opzionale) |
| `get-budget-status` | Mostra stato completo del budget con breakdown | `projectName` (string): nome progetto |
| `forecast-budget` | Previsione di esaurimento budget basata sul burn rate | `projectName` (string): nome progetto |

---

## Dettaglio dei Tool

### set-budget

Crea o aggiorna il budget per un progetto. Se il progetto esiste gia', aggiorna il
budget totale e la valuta tramite `ON CONFLICT ... DO UPDATE`.

```json
{
  "tool": "set-budget",
  "arguments": {
    "projectName": "MCP Suite v2",
    "totalBudget": 50000,
    "currency": "EUR"
  }
}
```

La valuta di default e' EUR (Euro). Il progetto e' identificato univocamente dal nome
(`projectName UNIQUE`).

### log-cost

Registra un costo associato a un progetto. Richiede che il budget sia stato
precedentemente creato con `set-budget`.

```json
{
  "tool": "log-cost",
  "arguments": {
    "projectName": "MCP Suite v2",
    "category": "sviluppo",
    "amount": 2500,
    "description": "Sprint 14 - 40h sviluppo frontend",
    "date": "2025-02-14",
    "taskId": "TASK-42"
  }
}
```

Dopo la registrazione, il tool verifica automaticamente la percentuale di budget
utilizzata. Se raggiunge o supera l'80%, pubblica l'evento `economics:budget-alert`.

### get-budget-status

Restituisce una vista completa dello stato del budget:

```
  Budget: MCP Suite v2
  +--------------------------------------------+
  | Totale: 50,000 EUR | Speso: 38,500 EUR     |
  | Rimanente: 11,500 EUR | Utilizzato: 77%    |
  +--------------------------------------------+
  | Breakdown: sviluppo 25K | infra 8.5K       |
  |            testing 3K   | design 2K        |
  +--------------------------------------------+
```

**Output strutturato:**
```json
{
  "projectName": "MCP Suite v2",
  "totalBudget": 50000,
  "currency": "EUR",
  "totalSpent": 38500,
  "remaining": 11500,
  "percentageUsed": 77.0,
  "breakdown": [{ "category": "sviluppo", "total": 25000 }, ...]
}
```

### forecast-budget

Calcola il burn rate giornaliero e stima quando il budget si esaurira':

```
  Algoritmo di previsione:
  +---------------------------------------------------+
  | 1. Trova prima e ultima data di costo             |
  | 2. daysTracked = (lastDate - firstDate) + 1       |
  | 3. dailyBurnRate = totalSpent / daysTracked       |
  | 4. estimatedDaysRemaining = remaining / burnRate  |
  | 5. runOutDate = today + daysRemaining             |
  +---------------------------------------------------+
```

**Output:**
```json
{
  "projectName": "MCP Suite v2",
  "totalBudget": 50000,
  "currency": "EUR",
  "totalSpent": 38500,
  "remaining": 11500,
  "dailyBurnRate": 550.0,
  "daysTracked": 70,
  "estimatedDaysRemaining": 21,
  "estimatedRunOutDate": "2025-03-07"
}
```

Casi speciali:
- Se non ci sono costi registrati: `dailyBurnRate: 0`, `estimatedDaysRemaining: null`
- Se il budget e' gia' esaurito: `estimatedDaysRemaining: 0`, `runOutDate: oggi`

---

## Architettura

```
index.ts
  |
  +-- server.ts (createProjectEconomicsServer)
  |     |
  |     +-- crea EconomicsStore
  |     +-- registra 4 tool
  |     +-- setupCollaborationHandlers(eventBus, store)
  |
  +-- services/
  |     +-- economics-store.ts  --> EconomicsStore
  |
  +-- tools/
  |     +-- set-budget.ts
  |     +-- log-cost.ts
  |     +-- get-budget-status.ts
  |     +-- forecast-budget.ts
  |
  +-- collaboration.ts  --> gestori eventi cross-server
```

### EconomicsStore

**Schema della tabella `budgets`:**

| Colonna | Tipo | Note |
|---------|------|------|
| `id` | INTEGER PK | Auto-increment |
| `projectName` | TEXT NN UNIQUE | Identificativo univoco progetto |
| `totalBudget` | REAL NN | Budget totale |
| `currency` | TEXT NN | Default 'EUR' |
| `createdAt` | TEXT NN | datetime('now') |

**Schema della tabella `costs`:**

| Colonna | Tipo | Note |
|---------|------|------|
| `id` | INTEGER PK | Auto-increment |
| `budgetId` | INTEGER FK NN | Riferimento a budgets(id) |
| `category` | TEXT NN | Categoria di spesa |
| `amount` | REAL NN | Importo |
| `description` | TEXT NN | Descrizione costo |
| `date` | TEXT NN | Data ISO |
| `taskId` | TEXT | Nullable, collegamento a task |
| `createdAt` | TEXT NN | datetime('now') |

La clausola `ON CONFLICT(projectName) DO UPDATE` in `set-budget` permette di aggiornare
un budget esistente senza errori.

---

## Integrazione Event Bus

### Eventi pubblicati

| Evento | Payload | Emesso da | Condizione |
|--------|---------|-----------|------------|
| `economics:cost-updated` | `{ projectName, category, amount, totalSpent }` | `log-cost` | Sempre |
| `economics:budget-alert` | `{ projectName, percentageUsed, remaining, totalBudget }` | `get-budget-status` | Quando `percentageUsed >= 80%` |

### Eventi sottoscritti

| Evento | Sorgente | Azione |
|--------|----------|--------|
| `time:entry-logged` | time-tracking | Converte il tempo registrato in costo e lo aggiunge al progetto |
| `scrum:sprint-completed` | scrum-board | Trigger per report di fine sprint con analisi costi |

### Flusso degli alert

```
  log-cost("MCP Suite v2", "sviluppo", 5000, ...)
       |
       v
  get-budget-status("MCP Suite v2")
       |
       v
  percentageUsed = 82%  --> >= 80%?
       |
       +--[SI]--> Pubblica economics:budget-alert
       |           { projectName: "MCP Suite v2",
       |             percentageUsed: 82,
       |             remaining: 9000,
       |             totalBudget: 50000 }
       |
       +--[NO]--> Nessun alert
```

---

## Interazioni con altri Server

```
+------------------+     time:entry-logged        +-------------------+
| time-tracking    | ---------------------------> | project-economics |
+------------------+                              |                   |
                                                  |                   |
+------------------+     scrum:sprint-completed   |                   |
| scrum-board      | ---------------------------> |                   |
+------------------+                              +--------+----------+
                                                           |
                                    economics:budget-alert |
                                    economics:cost-updated |
                                                           v
                                                  +------------------+
                                                  | standup-notes    |
                                                  | (futuro: alert   |
                                                  |  nei report)     |
                                                  +------------------+
```

---

## Esempi di Utilizzo

### Setup iniziale progetto

```json
// 1. Definire il budget
{ "tool": "set-budget", "arguments": { "projectName": "MCP Suite v2", "totalBudget": 50000, "currency": "EUR" } }

// 2. Registrare costi
{ "tool": "log-cost", "arguments": { "projectName": "MCP Suite v2", "category": "sviluppo", "amount": 2500, "description": "Sprint 14 - backend" } }
{ "tool": "log-cost", "arguments": { "projectName": "MCP Suite v2", "category": "infrastruttura", "amount": 500, "description": "Server staging Febbraio" } }

// 3. Verificare lo stato
{ "tool": "get-budget-status", "arguments": { "projectName": "MCP Suite v2" } }

// 4. Previsione
{ "tool": "forecast-budget", "arguments": { "projectName": "MCP Suite v2" } }
```

---

## Sviluppi Futuri

- **Conversione automatica tempo-costo:** tariffa oraria per ruolo, conversione automatica
  dei time entry in costi
- **Budget per sprint:** suddividere il budget in allocazioni per sprint
- **Multi-valuta:** supporto per conversione tra valute
- **Soglie configurabili:** soglie di alert personalizzate (non solo 80%)
- **ROI analysis:** ritorno sull'investimento basato su business value delle story
- **Integrazione fatturazione:** export dati per sistemi di fatturazione esterni
