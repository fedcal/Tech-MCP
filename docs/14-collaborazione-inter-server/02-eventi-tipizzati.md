# I 29 Eventi Tipizzati

## Panoramica

MCP Suite definisce 29 eventi tipizzati organizzati in 11 domini. Ogni evento ha un nome nel formato `dominio:azione` e un payload TypeScript fortemente tipizzato.

```
EventMap
  |
  +-- code:*          (3 eventi) - Codice e Git
  +-- cicd:*          (2 eventi) - CI/CD
  +-- scrum:*         (4 eventi) - Project Management
  +-- time:*          (2 eventi) - Time Tracking
  +-- db:*            (2 eventi) - Database
  +-- test:*          (2 eventi) - Testing
  +-- docs:*          (2 eventi) - Documentazione
  +-- perf:*          (2 eventi) - Performance
  +-- retro:*         (2 eventi) - Retrospettive
  +-- economics:*     (2 eventi) - Economia di Progetto
  +-- standup:*       (1 evento) - Standup
                     --------
                     29 totali
```

---

## Riferimento Completo

### Dominio: Code & Git (3 eventi)

#### `code:commit-analyzed`

Pubblicato da **code-review** dopo l'analisi di un diff/commit.

```typescript
{
  commitHash: string;    // Hash del commit analizzato
  files: string[];       // File coinvolti nel commit
  stats: Record<string, number>;  // Statistiche (righe aggiunte, rimosse, ecc.)
}
```

#### `code:review-completed`

Pubblicato da **code-review** al termine di una review completa.

```typescript
{
  files: string[];       // File revisionati
  issues: number;        // Numero di problemi trovati
  suggestions: string[]; // Suggerimenti di miglioramento
}
```

#### `code:dependency-alert`

Pubblicato da **dependency-manager** quando trova una vulnerabilita.

```typescript
{
  package: string;                              // Nome del pacchetto
  severity: 'critical' | 'high' | 'medium' | 'low';  // Livello di gravita
  advisory: string;                             // Descrizione dell'advisory
}
```

---

### Dominio: CI/CD (2 eventi)

#### `cicd:pipeline-completed`

Pubblicato da **cicd-monitor** quando una pipeline termina.

```typescript
{
  pipelineId: string;              // ID della pipeline
  status: 'success' | 'failed';   // Esito
  branch: string;                  // Branch coinvolto
  duration: number;                // Durata in secondi
}
```

#### `cicd:build-failed`

Pubblicato da **cicd-monitor** quando una build fallisce.

```typescript
{
  pipelineId: string;   // ID della pipeline
  error: string;        // Messaggio di errore
  stage: string;        // Stage in cui e fallita
  branch: string;       // Branch coinvolto
}
```

---

### Dominio: Scrum/Project Management (4 eventi)

#### `scrum:sprint-started`

Pubblicato da **scrum-board** alla creazione di un nuovo sprint.

```typescript
{
  sprintId: string;   // ID dello sprint
  name: string;       // Nome dello sprint
  startDate: string;  // Data di inizio (ISO 8601)
  endDate: string;    // Data di fine (ISO 8601)
}
```

#### `scrum:sprint-completed`

Pubblicato da **scrum-board** alla chiusura di uno sprint.

```typescript
{
  sprintId: string;          // ID dello sprint
  name: string;              // Nome dello sprint
  velocity: number;          // Story point completati
  completedStories: number;  // Storie completate
  incompleteStories: number; // Storie non completate
}
```

#### `scrum:task-updated`

Pubblicato da **scrum-board** quando un task cambia stato.

```typescript
{
  taskId: string;          // ID del task
  previousStatus: string;  // Stato precedente
  newStatus: string;       // Nuovo stato
  assignee?: string;       // Assegnatario (opzionale)
  sprintId?: string;       // Sprint di appartenenza (opzionale)
}
```

#### `scrum:story-completed`

Pubblicato da **scrum-board** quando una user story viene completata.

```typescript
{
  storyId: string;      // ID della storia
  title: string;        // Titolo della storia
  storyPoints: number;  // Punti storia
  sprintId: string;     // Sprint di appartenenza
}
```

---

### Dominio: Time Tracking (2 eventi)

#### `time:entry-logged`

Pubblicato da **time-tracking** quando viene registrato del tempo.

```typescript
{
  taskId: string;   // ID del task
  userId: string;   // ID dell'utente
  minutes: number;  // Minuti registrati
  date: string;     // Data (ISO 8601)
}
```

#### `time:timesheet-generated`

Pubblicato da **time-tracking** quando viene generato un timesheet.

```typescript
{
  userId: string;     // ID dell'utente
  period: string;     // Periodo coperto
  totalHours: number; // Ore totali
}
```

---

### Dominio: Database (2 eventi)

#### `db:schema-changed`

Pubblicato da **db-schema-explorer** quando rileva una modifica allo schema.

```typescript
{
  database: string;                              // Nome del database
  table: string;                                 // Tabella coinvolta
  changeType: 'created' | 'altered' | 'dropped'; // Tipo di modifica
}
```

#### `db:index-suggestion`

Pubblicato da **db-schema-explorer** quando suggerisce un indice.

```typescript
{
  database: string;    // Nome del database
  table: string;       // Tabella coinvolta
  columns: string[];   // Colonne suggerite per l'indice
  reason: string;      // Motivazione del suggerimento
}
```

---

### Dominio: Testing (2 eventi)

#### `test:generated`

Pubblicato da **test-generator** dopo la generazione di test.

```typescript
{
  filePath: string;    // Percorso del file di test generato
  testCount: number;   // Numero di test generati
  framework: string;   // Framework usato (jest, vitest, mocha)
}
```

#### `test:coverage-report`

Pubblicato da **test-generator** dopo un'analisi di coverage.

```typescript
{
  filePath: string;         // File analizzato
  coverage: number;         // Percentuale di coverage
  uncoveredLines: number[]; // Righe non coperte
}
```

---

### Dominio: Documentazione (2 eventi)

#### `docs:api-updated`

Pubblicato da **api-documentation** quando aggiorna la documentazione di un endpoint.

```typescript
{
  endpoint: string;    // Path dell'endpoint
  method: string;      // Metodo HTTP (GET, POST, ecc.)
  changes: string[];   // Modifiche rilevate
}
```

#### `docs:stale-detected`

Pubblicato da **api-documentation** quando rileva documentazione obsoleta.

```typescript
{
  filePath: string;     // File con documentazione obsoleta
  lastUpdated: string;  // Data ultimo aggiornamento
  reason: string;       // Motivo per cui e considerata stale
}
```

---

### Dominio: Performance (2 eventi)

#### `perf:bottleneck-found`

Pubblicato da **performance-profiler** quando trova un collo di bottiglia.

```typescript
{
  location: string;    // Posizione nel codice
  metric: string;      // Metrica misurata
  value: number;       // Valore misurato
  threshold: number;   // Soglia superata
}
```

#### `perf:profile-completed`

Pubblicato da **performance-profiler** al termine di un profiling.

```typescript
{
  target: string;                   // Target profilato
  durationMs: number;               // Durata del profiling in ms
  results: Record<string, number>;  // Risultati
}
```

---

### Dominio: Retrospettive (2 eventi)

#### `retro:action-item-created`

Pubblicato da **retrospective-manager** quando crea un action item.

```typescript
{
  retroId: string;    // ID della retrospettiva
  item: string;       // Descrizione dell'action item
  assignee: string;   // Assegnatario
  dueDate?: string;   // Scadenza (opzionale)
}
```

#### `retro:completed`

Pubblicato da **retrospective-manager** al termine di una retrospettiva.

```typescript
{
  sprintId: string;      // Sprint associato
  retroId: string;       // ID della retrospettiva
  actionItems: number;   // Numero di action item generati
  participants: number;  // Numero di partecipanti
}
```

---

### Dominio: Economics (2 eventi)

#### `economics:budget-alert`

Pubblicato da **project-economics** quando il budget supera una soglia.

```typescript
{
  project: string;      // Nome del progetto
  percentUsed: number;  // Percentuale di budget utilizzata
  threshold: number;    // Soglia che ha scatenato l'alert (es. 80)
  remaining: number;    // Budget residuo
}
```

#### `economics:cost-updated`

Pubblicato da **project-economics** dopo la registrazione di un costo.

```typescript
{
  category: string;    // Categoria del costo
  amount: number;      // Importo del costo
  totalSpent: number;  // Totale speso finora
}
```

---

### Dominio: Standup (1 evento)

#### `standup:report-generated`

Pubblicato da **standup-notes** dopo la generazione di un report standup.

```typescript
{
  userId: string;          // ID dell'utente
  date: string;            // Data dello standup
  tasksDone: number;       // Task completati
  tasksInProgress: number; // Task in corso
  blockers: number;        // Numero di blocker
}
```

---

## Convenzioni di Naming

| Regola | Esempio |
|--------|---------|
| Formato | `dominio:azione-in-kebab-case` |
| Dominio | Corrisponde al server o area funzionale |
| Azione passata | `sprint-completed`, `entry-logged` |
| Azione presente | `budget-alert`, `dependency-alert` |
| Prefisso consistente | Tutti gli eventi scrum usano `scrum:*` |

## Pattern Matching

Il pattern matching via `subscribePattern` permette di sottoscrivere a gruppi di eventi:

```typescript
// Tutti gli eventi del dominio scrum
eventBus.subscribePattern('scrum:*', (event, payload) => {
  console.log(`Scrum event: ${event}`, payload);
});

// Tutti gli eventi di completamento
eventBus.subscribePattern('*:*-completed', (event, payload) => {
  console.log(`Completed: ${event}`, payload);
});
```
