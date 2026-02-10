# Matrice di Collaborazione

## Panoramica

Questa sezione documenta tutti i flussi di eventi tra i 22 server MCP Suite. La matrice mostra chi pubblica, chi sottoscrive, e i flussi end-to-end che emergono dalla composizione degli eventi.

---

## Matrice Publisher/Subscriber

### Chi Pubblica Cosa

| Server | Evento | Trigger (Tool) |
|--------|--------|-----------------|
| **scrum-board** | `scrum:sprint-started` | `create-sprint` |
| **scrum-board** | `scrum:sprint-completed` | `close-sprint` |
| **scrum-board** | `scrum:task-updated` | `update-task-status` |
| **scrum-board** | `scrum:story-completed` | `close-sprint` (storie completate) |
| **time-tracking** | `time:entry-logged` | `log-time`, `stop-timer` |
| **cicd-monitor** | `cicd:pipeline-completed` | `get-pipeline-status` |
| **cicd-monitor** | `cicd:build-failed` | `get-pipeline-status` |
| **code-review** | `code:commit-analyzed` | `analyze-diff` |
| **code-review** | `code:review-completed` | `suggest-improvements` |
| **dependency-manager** | `code:dependency-alert` | `check-vulnerabilities` |
| **db-schema-explorer** | `db:index-suggestion` | `suggest-indexes` |
| **test-generator** | `test:generated` | `generate-unit-tests` |
| **test-generator** | `test:coverage-report` | `analyze-coverage` |
| **api-documentation** | `docs:api-updated` | `extract-endpoints` |
| **api-documentation** | `docs:stale-detected` | `find-undocumented` |
| **performance-profiler** | `perf:bottleneck-found` | `find-bottlenecks` |
| **performance-profiler** | `perf:profile-completed` | `benchmark-compare` |
| **project-economics** | `economics:budget-alert` | `get-budget-status` (>80%) |
| **project-economics** | `economics:cost-updated` | `log-cost` |
| **retrospective-manager** | `retro:action-item-created` | `generate-action-items` |
| **standup-notes** | `standup:report-generated` | `log-standup` |

### Chi Sottoscrive Cosa

| Server | Evento Sottoscritto | Reazione |
|--------|---------------------|----------|
| **agile-metrics** | `scrum:sprint-completed` | Cache dati velocity |
| **agile-metrics** | `scrum:task-updated` | Tracking transizioni per cycle time |
| **agile-metrics** | `scrum:story-completed` | Aggiornamento throughput |
| **time-tracking** | `scrum:task-updated` | Auto-start/stop timer (futuro) |
| **project-economics** | `time:entry-logged` | Conversione tempo in costo |
| **project-economics** | `scrum:sprint-completed` | Snapshot costo sprint |
| **scrum-board** | `retro:action-item-created` | Auto-creazione task (futuro) |
| **retrospective-manager** | `scrum:sprint-completed` | Auto-creazione retro pendente (futuro) |
| **retrospective-manager** | `cicd:build-failed` | Aggiunta item discussione (futuro) |
| **standup-notes** | `scrum:task-updated` | Contesto progress per standup (futuro) |
| **standup-notes** | `cicd:build-failed` | Aggiunta blocker potenziale (futuro) |

---

## Classificazione dei Server

### Server con Collaborazione Completa (Pubblicano + Sottoscrivono)

Questi server partecipano attivamente alla rete di eventi in entrambe le direzioni:

```
+------------------+         +------------------+
| scrum-board      |-------->| agile-metrics    |
| (4 eventi out)   |         | (3 eventi in)    |
| (1 evento in)    |<--------| retrospective    |
+------------------+         +------------------+

+------------------+         +------------------+
| time-tracking    |-------->| project-economics|
| (1 evento out)   |         | (2 eventi in)    |
| (1 evento in)    |         | (2 eventi out)   |
+------------------+         +------------------+
```

| Server | Pubblica | Sottoscrive | File collaboration.ts |
|--------|----------|-------------|----------------------|
| scrum-board | 4 eventi | 1 evento | Si |
| time-tracking | 1 evento | 1 evento | Si |
| project-economics | 2 eventi | 2 eventi | Si |
| retrospective-manager | 1 evento | 2 eventi | Si |
| standup-notes | 1 evento | 2 eventi | Si |

### Server Solo Publisher (Pubblicano, non sottoscrivono)

Questi server generano eventi ma non reagiscono a eventi esterni:

| Server | Pubblica | Note |
|--------|----------|------|
| cicd-monitor | 2 eventi | Hub per eventi DevOps |
| code-review | 2 eventi | Notifiche analisi codice |
| dependency-manager | 1 evento | Alert vulnerabilita |
| db-schema-explorer | 1 evento | Suggerimenti indici |
| test-generator | 2 eventi | Notifiche generazione test |
| api-documentation | 2 eventi | Aggiornamenti docs |
| performance-profiler | 2 eventi | Report performance |

### Server Solo Subscriber (Sottoscrivono, non pubblicano direttamente da tool)

| Server | Sottoscrive | Note |
|--------|-------------|------|
| agile-metrics | 3 eventi | Calcola metriche da eventi scrum |

### Server Pass-Through (Predisposti per il futuro)

Questi 9 server accettano l'EventBus nel factory ma attualmente non pubblicano ne sottoscrivono:

- docker-compose
- log-analyzer
- data-mock-generator
- codebase-knowledge
- regex-builder
- http-client
- snippet-manager
- project-scaffolding
- environment-manager

---

## Flussi End-to-End

### Flusso 1: Ciclo di Vita Sprint

```
[Creazione Sprint]
scrum-board:create-sprint
    |
    +-- scrum:sprint-started -----> (informativo, espansione futura)

[Lavoro durante lo Sprint]
scrum-board:update-task-status
    |
    +-- scrum:task-updated -------> agile-metrics  (cycle time)
    |                           +-> time-tracking  (auto-timer futuro)
    |                           +-> standup-notes  (contesto standup)

[Chiusura Sprint]
scrum-board:close-sprint
    |
    +-- scrum:sprint-completed ---> agile-metrics       (velocity)
    |                           +-> project-economics   (snapshot costo)
    |                           +-> retrospective-mgr   (auto-crea retro)
    |
    +-- scrum:story-completed ----> agile-metrics       (throughput)
```

### Flusso 2: Tracking Tempo e Costi

```
[Registrazione Tempo]
time-tracking:log-time / stop-timer
    |
    +-- time:entry-logged --------> project-economics  (conversione costo)

[Registrazione Costo Diretto]
project-economics:log-cost
    |
    +-- economics:cost-updated ---> (informativo)

[Verifica Budget]
project-economics:get-budget-status
    |
    +-- economics:budget-alert ---> (notifica se >80%)
```

### Flusso 3: Ciclo DevOps

```
[Monitoraggio Pipeline]
cicd-monitor:get-pipeline-status
    |
    +-- cicd:pipeline-completed --> (informativo)
    |
    +-- cicd:build-failed -------> retrospective-mgr  (item discussione)
                                +-> standup-notes      (blocker)
```

### Flusso 4: Quality & Review

```
[Analisi Codice]
code-review:analyze-diff
    |
    +-- code:commit-analyzed -----> (informativo)

code-review:suggest-improvements
    |
    +-- code:review-completed ----> (informativo, codebase-knowledge futuro)

[Vulnerabilita]
dependency-manager:check-vulnerabilities
    |
    +-- code:dependency-alert ----> (informativo)
```

### Flusso 5: Retrospettiva e Miglioramento

```
[Sprint Completato]
scrum:sprint-completed -----------> retrospective-mgr (auto-crea retro)

[Generazione Action Items]
retrospective-mgr:generate-action-items
    |
    +-- retro:action-item-created -> scrum-board (auto-crea task futuro)
```

---

## Diagramma Completo

```
                            +----------------+
                            | cicd-monitor   |
                            | (2 pub, 0 sub) |
                            +-------+--------+
                                    |
                     cicd:build-failed
                     cicd:pipeline-completed
                                    |
                    +---------------+---------------+
                    v                               v
           +--------+--------+            +---------+---------+
           | retrospective   |            | standup-notes     |
           | (1 pub, 2 sub)  |            | (1 pub, 2 sub)    |
           +--------+--------+            +-------------------+
                    |
      retro:action-item-created
                    |
                    v
           +--------+---------+
           | scrum-board      |
           | (4 pub, 1 sub)   |
           +--------+---------+
                    |
     scrum:sprint-completed
     scrum:task-updated
     scrum:story-completed
                    |
     +--------------+--------------+
     v              v              v
+----+------+ +-----+------+ +----+----------+
| agile-    | | time-      | | project-      |
| metrics   | | tracking   | | economics     |
| (0p, 3s)  | | (1p, 1s)   | | (2p, 2s)      |
+-----------+ +-----+------+ +---------------+
                    |
             time:entry-logged
                    |
                    v
              +-----+----------+
              | project-       |
              | economics      |
              +----------------+
```

---

## Sviluppi Futuri della Collaborazione

### Implementazioni Pending nei Collaboration Handler

Molti handler attualmente contengono placeholder (`void payload`) in attesa di implementazione completa:

| Server | Evento | Azione Futura |
|--------|--------|---------------|
| scrum-board | `retro:action-item-created` | Auto-creazione task dalla retro |
| time-tracking | `scrum:task-updated` | Auto-start timer su status "in_progress" |
| agile-metrics | `scrum:sprint-completed` | Cache dati velocity |
| agile-metrics | `scrum:task-updated` | Record timestamp transizioni |
| project-economics | `time:entry-logged` | Conversione automatica tempo->costo |
| retrospective-manager | `scrum:sprint-completed` | Auto-creazione retro pendente |
| standup-notes | `scrum:task-updated` | Popolamento contesto standup |

### Redis EventBus

Per deployment multi-processo, l'implementazione `RedisEventBus` permettera la collaborazione tra server in processi separati:

```
Processo A              Redis             Processo B
  |                       |                   |
  |-- PUBLISH evento ---->|                   |
  |                       |-- SUBSCRIBE ----->|
  |                       |    (delivery)     |
```

### Nuovi Eventi Pianificati

- `scrum:backlog-prioritized` - Quando il backlog viene riordinato
- `time:timer-started` / `time:timer-stopped` - Notifiche timer real-time
- `deploy:release-created` - Integrazione con deploy pipeline
- `docs:readme-updated` - Tracking modifiche documentazione
