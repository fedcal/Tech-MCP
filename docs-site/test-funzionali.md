# Test Funzionali - MCP Suite

> Documento di riferimento per la suite di test funzionali del progetto MCP Suite.
> Ultimo aggiornamento: 2026-02-20

## Indice

- [1. Package Condivisi](#1-package-condivisi)
- [2. Tool Funzionali per Server](#2-tool-funzionali-per-server)
- [3. Flussi Cross-Server End-to-End](#3-flussi-cross-server-end-to-end)
- [4. Eventi e Collaborazione](#4-eventi-e-collaborazione)
- [5. Resilienza e Gestione Errori](#5-resilienza-e-gestione-errori)
- [6. Persistenza Dati](#6-persistenza-dati)
- [Riepilogo](#riepilogo)

---

## 1. Package Condivisi

### 1.1 Core - Server Factory

| ID | Test | Descrizione |
|----|------|-------------|
| CORE-01 | Creazione server con configurazione minima | Verifica che `createMcpServer()` crei un server funzionante con solo `name` e `version` |
| CORE-02 | Creazione server con EventBus | Verifica che il server accetti e propaghi un EventBus opzionale |
| CORE-03 | Caricamento config da env vars | Verifica che `loadConfig()` legga correttamente `MCP_SUITE_<SERVER>_<FIELD>` |
| CORE-04 | Config defaults | Verifica i valori di default (transport: stdio, logLevel: info) |
| CORE-05 | Validazione config con Zod | Verifica che config invalide vengano rifiutate con errore chiaro |

### 1.2 Core - HTTP Transport

| ID | Test | Descrizione |
|----|------|-------------|
| HTTP-01 | Avvio server HTTP | Verifica che `startHttpServer()` avvii Express sulla porta configurata |
| HTTP-02 | Endpoint /health | Verifica che `/health` risponda 200 con stato server |
| HTTP-03 | Endpoint /mcp | Verifica che `/mcp` accetti connessioni MCP stateful |
| HTTP-04 | Sessioni multiple | Verifica che più client si connettano in parallelo con sessionId diversi |
| HTTP-05 | Porta già in uso | Verifica gestione errore quando la porta è occupata |

### 1.3 Event Bus

| ID | Test | Descrizione |
|----|------|-------------|
| EVT-01 | Publish/Subscribe tipizzato | Pubblica evento → subscriber lo riceve con payload corretto |
| EVT-02 | Subscribe pattern con wildcard | `subscribePattern("scrum:*")` riceve tutti gli eventi scrum |
| EVT-03 | Unsubscribe | La funzione di unsubscribe rimuove effettivamente il listener |
| EVT-04 | Multipli subscriber | Un evento viene ricevuto da tutti i subscriber registrati |
| EVT-05 | Errore in subscriber non blocca publisher | Un subscriber che lancia errore non impedisce la consegna agli altri |
| EVT-06 | Clear rimuove tutti i listener | Dopo `clear()`, nessun evento viene ricevuto |

### 1.4 Client Manager

| ID | Test | Descrizione |
|----|------|-------------|
| CM-01 | Registrazione server | `register()` aggiunge server al registry |
| CM-02 | callTool cross-server | Chiama tool su server remoto e riceve risposta |
| CM-03 | readResource cross-server | Legge risorsa da server remoto |
| CM-04 | Connessione lazy | Il client si connette solo al primo utilizzo |
| CM-05 | Disconnect e riconnessione | Dopo `disconnect()`, una nuova chiamata riconnette automaticamente |
| CM-06 | Server non registrato | `callTool()` su server non registrato lancia errore gestito |
| CM-07 | Transport in-memory | `createInMemoryPair()` crea coppia funzionante |
| CM-08 | Transport HTTP | Connessione a server via HTTP funziona |

### 1.5 Database

| ID | Test | Descrizione |
|----|------|-------------|
| DB-01 | Creazione database SQLite | `createDatabase()` crea il file .db nella directory corretta |
| DB-02 | Modalità in-memory | `inMemory: true` non crea file su disco |
| DB-03 | WAL mode attivo | Verifica che il pragma `journal_mode = WAL` sia attivo |
| DB-04 | Foreign keys attive | Verifica che il pragma `foreign_keys = ON` sia attivo |
| DB-05 | Migrazione applicata | `runMigrations()` esegue SQL e registra la versione |
| DB-06 | Migrazione idempotente | Rieseguire migrazioni già applicate non causa errori |
| DB-07 | Ordine migrazioni | Le migrazioni vengono applicate in ordine di versione |

---

## 2. Tool Funzionali per Server

### 2.1 Scrum Board

| ID | Test | Descrizione |
|----|------|-------------|
| SCRUM-01 | Creare sprint | `create-sprint` crea uno sprint con date e capacity, pubblica evento `scrum:sprint-started` |
| SCRUM-02 | Ottenere sprint | `get-sprint` ritorna i dati completi dello sprint creato |
| SCRUM-03 | Creare user story | `create-story` associa una story allo sprint con punti e priorità |
| SCRUM-04 | Creare task | `create-task` associa un task alla story con assegnatario |
| SCRUM-05 | Aggiornare stato task | `update-task-status` cambia stato (todo→in-progress→done), pubblica `scrum:task-updated` |
| SCRUM-06 | Sprint board completo | `sprint-board` ritorna la board con colonne e card corrette |
| SCRUM-07 | Backlog | `get-backlog` ritorna story non assegnate a sprint |
| SCRUM-08 | Story completata | Quando tutti i task sono "done", la story è completata, pubblica `scrum:story-completed` |

### 2.2 Time Tracking

| ID | Test | Descrizione |
|----|------|-------------|
| TIME-01 | Avviare timer | `start-timer` crea un timer attivo per un task |
| TIME-02 | Fermare timer | `stop-timer` calcola la durata e logga il tempo, pubblica `time:entry-logged` |
| TIME-03 | Loggare tempo manualmente | `log-time` con taskId + durationMinutes, pubblica `time:entry-logged` |
| TIME-04 | Ottenere timesheet | `get-timesheet` ritorna le entry raggruppate per data/task |
| TIME-05 | Rilevare anomalie | `detect-anomalies` identifica entry anomale (durata eccessiva, fuori orario) |
| TIME-06 | Stima vs attuale | `estimate-vs-actual` confronta tempo stimato vs reale |
| TIME-07 | Timer doppio | Avviare un secondo timer mentre uno è attivo viene gestito correttamente |

### 2.3 Code Review

| ID | Test | Descrizione |
|----|------|-------------|
| CR-01 | Analizzare diff | `analyze-diff` analizza un diff e ritorna osservazioni, pubblica `code:commit-analyzed` |
| CR-02 | Controllare complessità | `check-complexity` misura complessità ciclomatica del codice |
| CR-03 | Suggerire miglioramenti | `suggest-improvements` genera suggerimenti, pubblica `code:review-completed` |

### 2.4 Agile Metrics

| ID | Test | Descrizione |
|----|------|-------------|
| AM-01 | Calcolare velocity | `calculate-velocity` calcola punti completati per sprint |
| AM-02 | Generare burndown | `generate-burndown` genera dati per grafico burndown |
| AM-03 | Calcolare cycle time | `calculate-cycle-time` misura tempo medio da start a done |
| AM-04 | Previsione completamento | `forecast-completion` stima date di completamento basate su velocity |
| AM-05 | Predire rischi | `predict-risk` identifica rischi progettuali, pubblica `metrics:risk-predicted` |
| AM-06 | Correlare fattori | `correlate-factors` correla metriche diverse per trovare pattern |

### 2.5 Decision Log

| ID | Test | Descrizione |
|----|------|-------------|
| DL-01 | Registrare decisione | `record-decision` crea un ADR, pubblica `decision:created` |
| DL-02 | Listare decisioni | `list-decisions` ritorna tutte le decisioni con filtri |
| DL-03 | Ottenere decisione | `get-decision` ritorna una decisione specifica per ID |
| DL-04 | Sostituire decisione | `supersede-decision` marca una decisione come superata, pubblica `decision:superseded` |
| DL-05 | Collegare decisioni | `link-decision` crea link tra due decisioni correlate |

### 2.6 Incident Manager

| ID | Test | Descrizione |
|----|------|-------------|
| INC-01 | Aprire incidente | `open-incident` crea incidente con severity, pubblica `incident:opened` |
| INC-02 | Aggiornare incidente | `update-incident` cambia stato/severity, pubblica eventi appropriati |
| INC-03 | Aggiungere timeline | `add-timeline-entry` aggiunge evento alla timeline dell'incidente |
| INC-04 | Risolvere incidente | `resolve-incident` chiude l'incidente, pubblica `incident:resolved` |
| INC-05 | Generare postmortem | `generate-postmortem` crea report strutturato dell'incidente |
| INC-06 | Listare incidenti | `list-incidents` ritorna incidenti con filtri per stato/severity |
| INC-07 | Escalation | Incidente aggiornato a severity critica pubblica `incident:escalated` |

### 2.7 Project Economics

| ID | Test | Descrizione |
|----|------|-------------|
| PE-01 | Impostare budget | `set-budget` definisce budget per progetto con categorie |
| PE-02 | Loggare costo | `log-cost` registra spesa, pubblica `economics:cost-updated` |
| PE-03 | Stato budget | `get-budget-status` mostra percentuale utilizzata, pubblica `economics:budget-alert` se >80% |
| PE-04 | Previsione budget | `forecast-budget` stima spesa futura basata su trend |
| PE-05 | Costo per feature | `cost-per-feature` calcola costo associato a una feature, pubblica `economics:feature-costed` |

### 2.8 Retrospective Manager

| ID | Test | Descrizione |
|----|------|-------------|
| RETRO-01 | Creare retrospettiva | `create-retro` crea una retro con formato (start-stop-continue, 4L, etc.) |
| RETRO-02 | Aggiungere item | `add-item` aggiunge osservazione alla retro nella categoria corretta |
| RETRO-03 | Votare item | `vote-item` incrementa voti di un item |
| RETRO-04 | Generare action items | `generate-action-items` crea azioni dai top-voted items, pubblica `retro:action-item-created` |
| RETRO-05 | Ottenere retrospettiva | `get-retro` ritorna retro completa con items e voti |
| RETRO-06 | Rilevare pattern | `detect-patterns` trova temi ricorrenti tra retro multiple, pubblica `retro:pattern-detected` |
| RETRO-07 | Suggerire items | `suggest-items` propone items basati su dati di altri server |

### 2.9 Quality Gate

| ID | Test | Descrizione |
|----|------|-------------|
| QG-01 | Definire gate | `define-gate` crea gate con checks (coverage >80%, ecc.), pubblica evento |
| QG-02 | Valutare gate - PASS | `evaluate-gate` con metriche che soddisfano i checks → pubblica `quality:gate-passed` |
| QG-03 | Valutare gate - FAIL | `evaluate-gate` con metriche insufficienti → pubblica `quality:gate-failed` |
| QG-04 | Listare gates | `list-gates` ritorna tutti i gates definiti |
| QG-05 | Storico valutazioni | `get-gate-history` ritorna la cronologia di pass/fail per un gate |

### 2.10 Workflow Orchestrator

| ID | Test | Descrizione |
|----|------|-------------|
| WF-01 | Creare workflow | `create-workflow` definisce workflow con trigger, steps e condizioni |
| WF-02 | Listare workflows | `list-workflows` ritorna tutti i workflow con stato attivo/inattivo |
| WF-03 | Trigger manuale | `trigger-workflow` avvia esecuzione di un workflow |
| WF-04 | Ottenere esecuzione | `get-workflow-run` ritorna stato e log di un'esecuzione |
| WF-05 | Toggle workflow | `toggle-workflow` attiva/disattiva un workflow |
| WF-06 | Risoluzione template | Steps con `{{payload.field}}` risolvono variabili dal payload del trigger |
| WF-07 | Condizioni di step | Steps con condizioni vengono eseguiti solo se la condizione è vera |
| WF-08 | Workflow fallito | Step che fallisce marca il workflow come failed, pubblica `workflow:failed` |

### 2.11 Insight Engine

| ID | Test | Descrizione |
|----|------|-------------|
| IE-01 | Query insight | `query-insight` ritorna insight aggregati dal CorrelationEngine |
| IE-02 | Correlare metriche | `correlate-metrics` correla dati da più server via clientManager |
| IE-03 | Spiegare trend | `explain-trend` analizza e spiega un trend osservato |
| IE-04 | Health dashboard | `health-dashboard` aggrega stato salute da più server |

### 2.12 Dashboard API

| ID | Test | Descrizione |
|----|------|-------------|
| DASH-01 | Overview sistema | `get-overview` aggrega dati da più server via clientManager |
| DASH-02 | Stato server | `get-server-status` verifica stato di server specifici dal registry |
| DASH-03 | Attività recenti | `get-recent-activity` raccoglie eventi recenti cross-server |
| DASH-04 | Sommario progetto | `get-project-summary` genera report aggregato del progetto |

### 2.13 MCP Registry

| ID | Test | Descrizione |
|----|------|-------------|
| REG-01 | Registrare server | `register-server` aggiunge server al registry, pubblica `registry:server-registered` |
| REG-02 | Scoprire server | `discover-servers` ritorna lista server registrati con filtri |
| REG-03 | Health check | `health-check` verifica disponibilità server, pubblica `registry:server-unhealthy` se offline |
| REG-04 | Capabilities | `get-capabilities` ritorna tool e risorse di un server registrato |

### 2.14 Access Policy

| ID | Test | Descrizione |
|----|------|-------------|
| AP-01 | Creare policy | `create-policy` definisce regola RBAC/ABAC |
| AP-02 | Verificare accesso - consentito | `check-access` con utente autorizzato → accesso consentito |
| AP-03 | Verificare accesso - negato | `check-access` con utente non autorizzato → `access:denied` pubblicato |
| AP-04 | Listare policies | `list-policies` ritorna tutte le policy attive |
| AP-05 | Assegnare ruolo | `assign-role` associa ruolo a utente |
| AP-06 | Audit accessi | `audit-access` ritorna log degli accessi verificati |

### 2.15 CI/CD Monitor

| ID | Test | Descrizione |
|----|------|-------------|
| CICD-01 | Listare pipeline | `list-pipelines` ritorna le pipeline configurate |
| CICD-02 | Stato pipeline | `get-pipeline-status` ritorna stato corrente, pubblica `cicd:pipeline-completed` |
| CICD-03 | Log build | `get-build-logs` ritorna log di una specifica build |
| CICD-04 | Test flaky | `get-flaky-tests` identifica test con risultati instabili |

### 2.16 Codebase Knowledge

| ID | Test | Descrizione |
|----|------|-------------|
| CK-01 | Ricerca codice | `search-code` trova occorrenze di pattern nel codice |
| CK-02 | Spiegare modulo | `explain-module` genera descrizione di un modulo |
| CK-03 | Mappa architettura | `architecture-map` genera mappa delle dipendenze del progetto |
| CK-04 | Grafo dipendenze | `dependency-graph` genera grafo dei moduli |
| CK-05 | Tracciare cambiamenti | `track-changes` monitora modifiche, pubblica `knowledge:index-updated` |

### 2.17 API Documentation

| ID | Test | Descrizione |
|----|------|-------------|
| APIDOC-01 | Estrarre endpoint | `extract-endpoints` trova endpoint da codice sorgente |
| APIDOC-02 | Generare OpenAPI | `generate-openapi` crea spec OpenAPI dal codice |
| APIDOC-03 | Trovare non documentati | `find-undocumented` identifica endpoint senza documentazione |

### 2.18 Dependency Manager

| ID | Test | Descrizione |
|----|------|-------------|
| DEP-01 | Vulnerabilità | `check-vulnerabilities` trova CVE note, pubblica `code:dependency-alert` |
| DEP-02 | Dipendenze inutilizzate | `find-unused` identifica dipendenze non referenziate |
| DEP-03 | Audit licenze | `license-audit` verifica compatibilità licenze |

### 2.19 DB Schema Explorer

| ID | Test | Descrizione |
|----|------|-------------|
| DBEX-01 | Esplorare schema | `explore-schema` ritorna struttura completa del DB |
| DBEX-02 | Descrivere tabella | `describe-table` ritorna colonne, tipi, vincoli |
| DBEX-03 | Suggerire indici | `suggest-indexes` analizza query e suggerisce indici, pubblica `db:index-suggestion` |
| DBEX-04 | Generare ERD | `generate-erd` genera diagramma ER testuale |

### 2.20 Performance Profiler

| ID | Test | Descrizione |
|----|------|-------------|
| PERF-01 | Analisi bundle | `analyze-bundle` misura dimensioni del bundle |
| PERF-02 | Trovare bottleneck | `find-bottlenecks` identifica colli di bottiglia, pubblica `perf:bottleneck-found` |
| PERF-03 | Confronto benchmark | `benchmark-compare` confronta due benchmark, pubblica `perf:profile-completed` |

### 2.21 Standup Notes

| ID | Test | Descrizione |
|----|------|-------------|
| SU-01 | Loggare standup | `log-standup` registra note giornaliere, pubblica `standup:report-generated` |
| SU-02 | Storico standup | `get-standup-history` ritorna standup passati con filtri per data |
| SU-03 | Report di stato | `generate-status-report` aggrega dati da sprint/task via clientManager |

### 2.22 Test Generator

| ID | Test | Descrizione |
|----|------|-------------|
| TG-01 | Generare unit test | `generate-unit-tests` crea scheletri di test, pubblica `test:generated` |
| TG-02 | Trovare edge case | `find-edge-cases` identifica casi limite nel codice |
| TG-03 | Analizzare coverage | `analyze-coverage` analizza copertura, pubblica `test:coverage-report` |

### 2.23 Data Mock Generator

| ID | Test | Descrizione |
|----|------|-------------|
| MOCK-01 | Generare mock da schema | `generate-mock-data` crea dati realistici da schema fornito |
| MOCK-02 | Generare JSON | `generate-json` produce output in formato JSON |
| MOCK-03 | Generare CSV | `generate-csv` produce output in formato CSV |
| MOCK-04 | Listare generatori | `list-generators` ritorna generatori disponibili (nomi, email, date, ecc.) |

### 2.24 Docker Compose

| ID | Test | Descrizione |
|----|------|-------------|
| DOCK-01 | Parse compose | `parse-compose` interpreta correttamente un docker-compose.yml |
| DOCK-02 | Analisi Dockerfile | `analyze-dockerfile` identifica best practice e problemi |
| DOCK-03 | Lista servizi | `list-services` elenca i servizi definiti nello stack |
| DOCK-04 | Generare compose | `generate-compose` crea un docker-compose.yml valido |

### 2.25 Environment Manager

| ID | Test | Descrizione |
|----|------|-------------|
| ENV-01 | Lista ambienti | `list-environments` ritorna configurazioni ambienti |
| ENV-02 | Confronto ambienti | `compare-environments` mostra differenze tra ambienti |
| ENV-03 | Validazione env | `validate-env` verifica che variabili richieste siano presenti |
| ENV-04 | Template env | `generate-env-template` genera file .env di esempio |

### 2.26 HTTP Client

| ID | Test | Descrizione |
|----|------|-------------|
| HTTPC-01 | Inviare richiesta | `send-request` esegue chiamata HTTP e ritorna risposta |
| HTTPC-02 | Confronto risposte | `compare-responses` mostra differenze tra due risposte |
| HTTPC-03 | Generare curl | `generate-curl` converte richiesta in comando curl |

### 2.27 Log Analyzer

| ID | Test | Descrizione |
|----|------|-------------|
| LOG-01 | Analizzare log | `analyze-log-file` estrae statistiche da file di log |
| LOG-02 | Pattern errori | `find-error-patterns` identifica pattern ricorrenti negli errori |
| LOG-03 | Tail log | `tail-log` ritorna le ultime N righe di un log |
| LOG-04 | Sommario log | `generate-summary` produce riassunto del file di log |

### 2.28 Regex Builder

| ID | Test | Descrizione |
|----|------|-------------|
| RGX-01 | Testare regex | `test-regex` verifica regex contro stringa di input |
| RGX-02 | Spiegare regex | `explain-regex` descrive cosa fa una regex in linguaggio naturale |
| RGX-03 | Costruire regex | `build-regex` genera regex da descrizione testuale |
| RGX-04 | Ottimizzare regex | `optimize-regex` migliora performance di una regex |
| RGX-05 | Convertire regex | `convert-regex` converte tra formati (JS, Python, ecc.) |

### 2.29 Project Scaffolding

| ID | Test | Descrizione |
|----|------|-------------|
| SCAF-01 | Lista template | `list-templates` ritorna template disponibili |
| SCAF-02 | Scaffold progetto | `scaffold-project` genera struttura progetto completa |
| SCAF-03 | Scaffold componente | `scaffold-component` genera singolo componente |

### 2.30 Snippet Manager

| ID | Test | Descrizione |
|----|------|-------------|
| SNIP-01 | Salvare snippet | `save-snippet` memorizza snippet con tag e linguaggio |
| SNIP-02 | Cercare snippet | `search-snippets` trova snippet per query/tag |
| SNIP-03 | Ottenere snippet | `get-snippet` ritorna snippet per ID |
| SNIP-04 | Eliminare snippet | `delete-snippet` rimuove snippet |
| SNIP-05 | Lista tag | `list-tags` ritorna tutti i tag usati |

---

## 3. Flussi Cross-Server End-to-End

### 3.1 Flusso Sprint Completo

| ID | Test | Descrizione |
|----|------|-------------|
| E2E-01 | Sprint → Time → Metrics | Creare sprint (scrum-board) → loggare tempo (time-tracking) → calcolare velocity (agile-metrics). Verifica propagazione eventi e dati coerenti |
| E2E-02 | Sprint → Standup → Report | Creare task (scrum-board) → loggare standup (standup-notes) → generare status report che include dati sprint |
| E2E-03 | Sprint → Economics | Creare sprint → loggare costi → forecast budget include dati timesheet da time-tracking |

### 3.2 Flusso Incidente

| ID | Test | Descrizione |
|----|------|-------------|
| E2E-04 | Incidente → Workflow | Aprire incidente (incident-manager) → workflow-orchestrator triggered da `incident:opened` → esegue steps automatici |
| E2E-05 | Incidente → Decision → Retro | Gestire incidente → registrare decisione (decision-log) → creare retro con action items |

### 3.3 Flusso Quality

| ID | Test | Descrizione |
|----|------|-------------|
| E2E-06 | Code Review → Quality Gate | Analizzare diff (code-review) → valutare gate (quality-gate) → gate-passed/failed trigger workflow |
| E2E-07 | Test → Coverage → Gate | Generare test (test-generator) → analizzare coverage → valutare quality gate su coverage |

### 3.4 Flusso Dashboard

| ID | Test | Descrizione |
|----|------|-------------|
| E2E-08 | Registry → Dashboard | Registrare server → health check → dashboard-api aggrega stato da tutti i server |
| E2E-09 | Multi-server → Insight | Generare dati in 3+ server → insight-engine correla metriche e produce analisi |

### 3.5 Flusso Workflow Orchestrato

| ID | Test | Descrizione |
|----|------|-------------|
| E2E-10 | Evento → Workflow → Multi-step | Pubblicare evento → workflow con 3+ step cross-server → verifica esecuzione sequenziale e risoluzione template |
| E2E-11 | Workflow con condizioni | Workflow con step condizionali → verifica che steps vengano saltati/eseguiti in base alle condizioni |

---

## 4. Eventi e Collaborazione

### 4.1 Catene di Eventi

| ID | Test | Descrizione |
|----|------|-------------|
| EVT-CHAIN-01 | Cascata scrum → time | `scrum:task-updated` → time-tracking collaboration handler aggiorna i propri dati |
| EVT-CHAIN-02 | Cascata economics → budget | `economics:cost-updated` → project-economics ricalcola stato budget → pubblica `economics:budget-alert` se necessario |
| EVT-CHAIN-03 | Cascata quality → workflow | `quality:gate-failed` → workflow-orchestrator triggera workflow di remediation |
| EVT-CHAIN-04 | Pattern subscription | Un subscriber con pattern `"*:*"` riceve tutti gli eventi pubblicati |

### 4.2 Collaboration Handlers

| ID | Test | Descrizione |
|----|------|-------------|
| COLLAB-01 | time-tracking ascolta scrum | Quando `scrum:task-updated` viene pubblicato, time-tracking aggiorna le entry correlate |
| COLLAB-02 | scrum-board ascolta eventi | Verifica che scrum-board reagisca correttamente agli eventi esterni |
| COLLAB-03 | project-economics ascolta time | Economics aggiorna costi quando time-tracking pubblica entry |
| COLLAB-04 | decision-log ascolta incidenti | Decision log reagisce a `incident:resolved` |
| COLLAB-05 | quality-gate ascolta code review | Quality gate si aggiorna dopo `code:review-completed` |
| COLLAB-06 | retrospective ascolta sprint | Retrospective raccoglie dati da `scrum:sprint-completed` |
| COLLAB-07 | workflow ascolta tutti | Workflow orchestrator valuta regole su ogni evento ricevuto |
| COLLAB-08 | codebase-knowledge ascolta commit | Knowledge base si aggiorna dopo `code:commit-analyzed` |
| COLLAB-09 | incident-manager ascolta pipeline | Incident reagisce a `cicd:build-failed` |
| COLLAB-10 | standup ascolta scrum | Standup notes raccoglie update da scrum per il report |

---

## 5. Resilienza e Gestione Errori

| ID | Test | Descrizione |
|----|------|-------------|
| ERR-01 | Tool con input invalido | Ogni tool rifiuta input mancanti/malformati con messaggio chiaro |
| ERR-02 | Entità non trovata | Get/update su ID inesistente ritorna errore NotFoundError |
| ERR-03 | Server target non disponibile | ClientManager gestisce gracefully server irraggiungibile |
| ERR-04 | EventBus subscriber crash | Un subscriber che crasha non blocca gli altri |
| ERR-05 | Database corrotto | Server gestisce DB inaccessibile con errore chiaro |
| ERR-06 | Workflow step fallito | Step fallito marca il run come failed senza bloccare il sistema |
| ERR-07 | Timeout su cross-server call | Chiamata cross-server che va in timeout viene gestita |
| ERR-08 | Doppia registrazione server | Registrare due volte lo stesso server nel registry viene gestito |
| ERR-09 | Budget superato | Loggare costo oltre il budget pubblica alert e non blocca |
| ERR-10 | Concurrent timer | Due timer sullo stesso task vengono gestiti correttamente |

---

## 6. Persistenza Dati

| ID | Test | Descrizione |
|----|------|-------------|
| PERS-01 | Dati sopravvivono a restart | Creare dati → ricreare store dallo stesso DB → dati presenti |
| PERS-02 | Migrazione su DB esistente | DB con schema v1 → nuove migrazioni v2/v3 vengono applicate |
| PERS-03 | Integrità referenziale | Foreign keys impediscono cancellazione di entità referenziate |
| PERS-04 | Concurrent writes | Due write simultanee su WAL mode non causano lock |

---

## Riepilogo

| Categoria | Numero Test |
|-----------|-------------|
| Package condivisi | 25 |
| Tool funzionali (30 server) | ~130 |
| Flussi E2E cross-server | 11 |
| Catene eventi e collaborazione | 14 |
| Resilienza e gestione errori | 10 |
| Persistenza dati | 4 |
| **TOTALE** | **~194** |
