# Agile Metrics Server

## Panoramica

Il server **agile-metrics** fornisce strumenti analitici per misurare e prevedere le
prestazioni di un team agile. Calcola velocity, genera dati di burndown, analizza cycle
time e produce previsioni di completamento basate su simulazioni Monte Carlo.

Il server e' **stateless**: non possiede database ne' store interno. Riceve dati come
input dai tool (tipicamente provenienti dallo scrum-board) e restituisce calcoli puri.
Sottoscrive eventi per reagire a cambiamenti nello sprint in corso.

```
+------------------------------------------------------------------------+
|                     agile-metrics server                               |
|                                                                        |
|  +-------------------+ +------------------+ +------------------------+ |
|  |calculate-velocity | |generate-burndown | |calculate-cycle-time    | |
|  |                   | |                  | |                        | |
|  | - media punti     | | - ideale vs      | | - average, median      | |
|  | - trend analysis  | |   attuale        | | - p95, min, max        | |
|  | - per sprint      | | - stato sprint   | |                        | |
|  +-------------------+ +------------------+ +------------------------+ |
|                                                                        |
|  +-------------------------------------------------------------------+ |
|  |                  forecast-completion                              | |
|  |  1000 simulazioni Monte Carlo --> p50, p85, p95                   | |
|  +-------------------------------------------------------------------+ |
|                                                                        |
|  Sottoscrive: scrum:sprint-completed, scrum:task-updated,              |
|               scrum:story-completed                                    |
+------------------------------------------------------------------------+
```

**Versione:** 0.1.0
**Entry point:** `servers/agile-metrics/src/index.ts`
**Dipendenze:** `@mcp-suite/core`, `@mcp-suite/event-bus`

---

## Tabella dei Tool

| Tool | Descrizione | Parametri |
|------|-------------|-----------|
| `calculate-velocity` | Calcola la velocity media del team con analisi del trend | `sprints` (array): lista di sprint con `{ name, completedPoints, totalPoints }` |
| `generate-burndown` | Genera dati per grafico burndown (ideale vs attuale) | `totalPoints` (number): punti totali dello sprint; `sprintDays` (number): durata in giorni; `dailyCompleted` (number[]): punti completati per giorno |
| `calculate-cycle-time` | Calcola statistiche sul cycle time dei task | `tasks` (array): lista di `{ taskId, startDate, endDate }` |
| `forecast-completion` | Prevede la data di completamento tramite simulazione Monte Carlo | `remainingPoints` (number): punti rimanenti; `velocityHistory` (number[]): storico velocity degli ultimi sprint; `sprintLengthDays` (number): durata sprint in giorni |

---

## Dettaglio dei Tool

### calculate-velocity

Calcola la velocity media (punti completati per sprint) e analizza il trend:

```
  Sprint 10: 21 punti     ______
  Sprint 11: 25 punti    /      \
  Sprint 12: 23 punti   /   TREND \   Media: 23.8
  Sprint 13: 27 punti  /   +2.0    \  Trend: crescente (+2.0/sprint)
  Sprint 14: 23 punti /     punti   \
                      \_____________/
```

**Output:**
```json
{
  "averageVelocity": 23.8,
  "velocities": [21, 25, 23, 27, 23],
  "trend": {
    "direction": "increasing",
    "changePerSprint": 2.0
  },
  "sprintCount": 5
}
```

### generate-burndown

Genera i dati per un grafico burndown confrontando la linea ideale con l'avanzamento
reale:

```
  Punti
  40 |*
     | *  .
  30 |  *   .
     |   *     .    * <-- attuale (in ritardo)
  20 |    *       .
     |     *         .    *
  10 |      *           .     *
     |       *              .    *
   0 |--------*------------------.--*-----> Giorni
     1  2  3  4  5  6  7  8  9 10

     * = linea ideale     . = avanzamento reale
```

**Output:** array di oggetti `{ day, ideal, actual, status }` dove status e'
`on-track`, `behind` o `ahead`.

### calculate-cycle-time

Analizza i tempi di completamento dei task e produce statistiche dettagliate:

| Metrica | Descrizione |
|---------|-------------|
| `average` | Media aritmetica del cycle time |
| `median` | Valore mediano (p50) |
| `p95` | 95-esimo percentile |
| `min` | Tempo minimo di completamento |
| `max` | Tempo massimo di completamento |

```json
{
  "tool": "calculate-cycle-time",
  "arguments": {
    "tasks": [
      { "taskId": "T-1", "startDate": "2025-02-03", "endDate": "2025-02-05" },
      { "taskId": "T-2", "startDate": "2025-02-03", "endDate": "2025-02-07" },
      { "taskId": "T-3", "startDate": "2025-02-04", "endDate": "2025-02-06" },
      { "taskId": "T-4", "startDate": "2025-02-05", "endDate": "2025-02-12" }
    ]
  }
}
```

**Risultato:** `{ average: 3.75 days, median: 3.0, p95: 7.0, min: 2, max: 7 }`

### forecast-completion

Esegue **1000 simulazioni Monte Carlo** per prevedere quando il lavoro rimanente sara'
completato, considerando la variabilita' storica della velocity.

```
  Algoritmo Monte Carlo:
  +-------------------------------------------------------+
  | Per ogni simulazione (1..1000):                       |
  |   remainingWork = remainingPoints                     |
  |   sprints = 0                                         |
  |   while remainingWork > 0:                            |
  |     velocity = random(velocityHistory)                |
  |     remainingWork -= velocity                         |
  |     sprints++                                         |
  |   record(sprints * sprintLengthDays)                  |
  +-------------------------------------------------------+
  | Ordina risultati                                      |
  | p50 = risultato al 50-esimo percentile                |
  | p85 = risultato all'85-esimo percentile               |
  | p95 = risultato al 95-esimo percentile                |
  +-------------------------------------------------------+
```

**Output:**
```json
{
  "remainingPoints": 50,
  "simulations": 1000,
  "forecast": {
    "p50": { "sprints": 2, "days": 28, "date": "2025-03-14" },
    "p85": { "sprints": 3, "days": 42, "date": "2025-03-28" },
    "p95": { "sprints": 3, "days": 42, "date": "2025-03-28" }
  },
  "confidence": "Con l'85% di probabilita', completamento entro 42 giorni"
}
```

---

## Architettura

```
index.ts
  |
  +-- server.ts (createAgileMetricsServer)
  |     |
  |     +-- registra 4 tool
  |     +-- setupCollaborationHandlers(eventBus)
  |
  +-- tools/
  |     +-- calculate-velocity.ts
  |     +-- generate-burndown.ts
  |     +-- calculate-cycle-time.ts
  |     +-- forecast-completion.ts
  |
  +-- collaboration.ts  --> gestori eventi sottoscritti
```

Il server non possiede store. Tutti i calcoli sono funzioni pure che ricevono dati
in input e restituiscono risultati. I dati provengono tipicamente dal client MCP che
li ottiene dallo scrum-board.

---

## Integrazione Event Bus

### Eventi pubblicati

Nessuno. Il server e' un puro consumatore di dati.

### Eventi sottoscritti

| Evento | Sorgente | Azione |
|--------|----------|--------|
| `scrum:sprint-completed` | scrum-board | Trigger per ricalcolo velocity e generazione report di fine sprint |
| `scrum:task-updated` | scrum-board | Aggiornamento dati burndown in tempo reale |
| `scrum:story-completed` | scrum-board | Aggiornamento punti completati per velocity tracking |

---

## Interazioni con altri Server

```
+------------------+     scrum:sprint-completed     +------------------+
| scrum-board      | -----------------------------> | agile-metrics    |
|                  |     scrum:task-updated         |                  |
|                  | -----------------------------> |                  |
|                  |     scrum:story-completed      |                  |
|                  | -----------------------------> |                  |
+------------------+                                +------------------+
                                                           |
                                                           v
                                                    Calcoli puri
                                                    (velocity, burndown,
                                                     cycle time, forecast)
```

- **scrum-board (input principale):** fornisce tutti i dati su sprint, story e task
- **project-economics (output futuro):** le previsioni di completamento potrebbero
  alimentare le proiezioni di budget

---

## Esempi di Utilizzo

### Calcolare la velocity degli ultimi sprint

```json
{
  "tool": "calculate-velocity",
  "arguments": {
    "sprints": [
      { "name": "Sprint 10", "completedPoints": 21, "totalPoints": 25 },
      { "name": "Sprint 11", "completedPoints": 25, "totalPoints": 28 },
      { "name": "Sprint 12", "completedPoints": 23, "totalPoints": 26 },
      { "name": "Sprint 13", "completedPoints": 27, "totalPoints": 30 }
    ]
  }
}
```

### Previsione Monte Carlo

```json
{
  "tool": "forecast-completion",
  "arguments": {
    "remainingPoints": 50,
    "velocityHistory": [21, 25, 23, 27, 23],
    "sprintLengthDays": 14
  }
}
```

---

## Sviluppi Futuri

- **Dashboard real-time:** aggiornamento automatico delle metriche ad ogni evento ricevuto
- **Throughput analysis:** metriche di throughput (item completati per settimana)
- **Lead time vs cycle time:** distinzione tra tempo totale e tempo di lavorazione
- **Cumulative flow diagram:** dati per generare un CFD interattivo
- **Confronto tra sprint:** visualizzare l'evoluzione delle metriche tra sprint
- **Alert automatici:** notificare quando la velocity cala sotto la media storica
- **Export dati:** esportare metriche in formato CSV per analisi esterne
