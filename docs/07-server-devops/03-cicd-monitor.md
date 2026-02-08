# CI/CD Monitor Server

## Panoramica

Il server **cicd-monitor** e' il ponte tra MCP Suite e le pipeline di Continuous Integration
e Continuous Deployment. Si integra nativamente con GitHub Actions tramite la CLI `gh`,
permettendo di monitorare workflow run, visualizzare log di build e identificare test instabili
(flaky) senza lasciare l'ambiente di sviluppo.

Il problema principale che risolve e' la frammentazione dell'informazione: gli sviluppatori
devono navigare all'interfaccia web di GitHub per controllare lo stato delle build, leggere
i log di errore e capire quali test falliscono in modo intermittente. Questo server porta
tutte queste informazioni direttamente nell'IDE.

```
+------------------------------------------------------------+
|               cicd-monitor server                          |
|                                                            |
|  +-------------------------------------------------------+ |
|  |                  Tool Layer                           | |
|  |                                                       | |
|  |  list-pipelines       get-pipeline-status             | |
|  |  get-build-logs       get-flaky-tests                 | |
|  +-------------------------------------------------------+ |
|                           |                                |
|                           v                                |
|  +-------------------------------------------------------+ |
|  |          child_process.execSync                       | |
|  |          Comandi: gh run list / gh run view           | |
|  +-------------------------------------------------------+ |
|                           |                                |
|                           v                                |
|  +-------------------------------------------------------+ |
|  |   Event Bus                                           | |
|  |   cicd:pipeline-completed                             | |
|  |   cicd:build-failed                                   | |
|  +-------------------------------------------------------+ |
+------------------------------------------------------------+
```

### Prerequisiti

- **GitHub CLI (`gh`)** installata e autenticata (`gh auth login`)
- Accesso al repository GitHub target (proprietario o collaboratore)

### Caratteristiche principali

- **Monitoraggio pipeline**: lista e dettaglio dei workflow run recenti
- **Visualizzazione log**: accesso diretto ai log di build fino a 10MB
- **Rilevamento flaky test**: analisi statistica dei risultati misti pass/fail
- **Pubblicazione eventi**: notifica automatica di pipeline completate e build fallite

---

## Tabella dei Tool

| Tool | Descrizione | Parametri |
|------|-------------|-----------|
| `list-pipelines` | Elenca i workflow run recenti di GitHub Actions | `repo?` (string, owner/repo); `limit` (number, default: 10) |
| `get-pipeline-status` | Dettaglio di un workflow run specifico con job e step | `runId` (string); `repo?` (string) |
| `get-build-logs` | Scarica le ultime N righe dei log di un workflow run | `runId` (string); `repo?` (string); `lines` (number, default: 100) |
| `get-flaky-tests` | Analizza i run recenti per trovare test che passano/falliscono in modo intermittente | `repo?` (string); `branch?` (string); `runs` (number, default: 20) |

---

## Architettura

### Comandi GitHub CLI utilizzati

| Tool | Comando | Timeout |
|------|---------|---------|
| `list-pipelines` | `gh run list --limit N --json fields` | 30s |
| `get-pipeline-status` | `gh run view <id> --json fields` + `gh run view <id> --json jobs` | 30s |
| `get-build-logs` | `gh run view <id> --log` | 60s |
| `get-flaky-tests` | `gh run list` + `gh run view <id> --json jobs` per ogni run | 30s per comando |

### Flusso di list-pipelines

```
  gh run list --json databaseId,displayTitle,headBranch,
                     event,status,conclusion,createdAt,
                     updatedAt,url,workflowName
        |
        v
  JSON.parse(output)
        |
        v
  Mappatura a formato semplificato:
  { id, title, branch, event, status, conclusion,
    workflow, createdAt, updatedAt, url }
```

### Flusso di get-pipeline-status

```
  gh run view <runId> --json (run fields)
        |
        v
  Run details: id, title, branch, sha, event, status,
               conclusion, workflow, createdAt, updatedAt

  gh run view <runId> --json jobs
        |
        v
  Jobs array:
    +-- Job 1: { name, status, conclusion, startedAt, completedAt }
    |     +-- Step 1: { name, status, conclusion, number }
    |     +-- Step 2: ...
    +-- Job 2: ...

  Se conclusion == 'failure':
    -> Pubblica cicd:pipeline-completed (status: 'failed')
    -> Pubblica cicd:build-failed con nome del job fallito

  Se conclusion == 'success':
    -> Pubblica cicd:pipeline-completed (status: 'success')
```

### Flusso di get-flaky-tests

L'algoritmo per identificare i test flaky e' il seguente:

```
  1. Recupera gli ultimi N run (default 20)
         |
         v
  2. Raggruppa per branch + workflow
         |
         v
  3. Per ogni gruppo con risultati MISTI (success + failure):
     a. Campiona fino a 5 run
     b. Per ogni run, recupera jobs e steps
     c. Per ogni step, traccia passaggi/fallimenti
         |
         v
  4. Identifica step con ENTRAMBI passCount > 0 E failCount > 0
         |
         v
  5. Calcolo flakiness rate:
     rate = min(passCount, failCount) / totalRuns * 100
         |
         v
  6. Ordina per flakiness rate decrescente
```

---

## Integrazione Event Bus

### Eventi pubblicati

| Evento | Emesso da | Payload | Condizione |
|--------|-----------|---------|------------|
| `cicd:pipeline-completed` | `get-pipeline-status` | `{ pipelineId, status, branch, duration }` | Sempre, dopo recupero dettagli run |
| `cicd:build-failed` | `get-pipeline-status` | `{ pipelineId, error, stage, branch }` | Solo se `conclusion == 'failure'` |

### Eventi sottoscritti

Nessuno.

### Calcolo durata pipeline

La durata viene calcolata come differenza tra `updatedAt` e `createdAt` in millisecondi.

---

## Interazioni con altri server

```
+------------------+   cicd:pipeline-completed   +-----------------+
|  cicd-monitor    | --------------------------> | standup-notes   |
|                  |   cicd:build-failed         | agile-metrics   |
+------------------+ --------------------------> +-----------------+

+------------------+                             +-----------------+
|  log-analyzer    | <--- (analisi log build)    | cicd-monitor    |
+------------------+                             +-----------------+
```

| Server collegato | Direzione | Descrizione |
|------------------|-----------|-------------|
| `standup-notes` | -> (via evento) | Riceve notifica di build completate/fallite per i report giornalieri |
| `agile-metrics` | -> (via evento) | Aggrega metriche di velocita' pipeline e tasso di fallimento |
| `log-analyzer` | complementare | I log di build scaricati possono essere analizzati in dettaglio |
| `code-review` | complementare | Problemi nel codice possono essere correlati con fallimenti build |
| `docker-compose` | complementare | Build Docker possono essere monitorate come parte della pipeline |

---

## Esempi di utilizzo

### Lista pipeline recenti

**Richiesta:**
```json
{
  "tool": "list-pipelines",
  "arguments": {
    "repo": "my-org/my-project",
    "limit": 5
  }
}
```

**Risposta:**
```json
{
  "total": 5,
  "runs": [
    {
      "id": 12345678,
      "title": "feat: add user authentication",
      "branch": "feature/auth",
      "event": "push",
      "status": "completed",
      "conclusion": "success",
      "workflow": "CI",
      "createdAt": "2024-06-15T10:00:00Z",
      "url": "https://github.com/my-org/my-project/actions/runs/12345678"
    }
  ]
}
```

### Stato dettagliato pipeline

**Richiesta:**
```json
{
  "tool": "get-pipeline-status",
  "arguments": {
    "runId": "12345678",
    "repo": "my-org/my-project"
  }
}
```

**Risposta (semplificata):**
```json
{
  "id": 12345678,
  "title": "feat: add user authentication",
  "branch": "feature/auth",
  "sha": "abc123def456",
  "conclusion": "failure",
  "jobs": [
    {
      "name": "build",
      "conclusion": "success",
      "steps": [
        { "name": "Checkout", "conclusion": "success", "number": 1 },
        { "name": "Install", "conclusion": "success", "number": 2 },
        { "name": "Build", "conclusion": "success", "number": 3 }
      ]
    },
    {
      "name": "test",
      "conclusion": "failure",
      "steps": [
        { "name": "Run tests", "conclusion": "failure", "number": 1 }
      ]
    }
  ]
}
```

### Rilevamento test flaky

**Richiesta:**
```json
{
  "tool": "get-flaky-tests",
  "arguments": {
    "repo": "my-org/my-project",
    "branch": "main",
    "runs": 20
  }
}
```

**Risposta:**
```json
{
  "analyzedRuns": 20,
  "branchesAnalyzed": 1,
  "flakyStepsFound": 2,
  "flaky": [
    {
      "branch": "main",
      "workflow": "CI",
      "job": "test",
      "step": "Run integration tests",
      "passCount": 3,
      "failCount": 2,
      "totalRuns": 5,
      "flakinessRate": 40.0
    }
  ]
}
```

---

## Sviluppi futuri

- **Supporto multi-piattaforma**: GitLab CI, Bitbucket Pipelines, Jenkins
- **Caching intelligente**: evitare chiamate API ripetute per run gia' analizzati
- **Alert in tempo reale**: polling periodico con notifica immediata di fallimenti
- **Analisi trend**: tracciamento storico del tasso di successo nel tempo
- **Retry automatico**: possibilita' di ri-eseguire un workflow run fallito
- **Correlazione con commit**: collegamento automatico tra fallimento e commit specifico
- **Dashboard metriche**: lead time, cycle time, deployment frequency (DORA metrics)
- **Integrazione Slack/Teams**: notifiche push verso canali di comunicazione
