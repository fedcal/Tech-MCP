# Log Analyzer Server

## Panoramica

Il server **log-analyzer** fornisce strumenti per l'analisi di file di log applicativi.
Il problema che risolve e' universale: i file di log crescono rapidamente, contengono
migliaia di righe, e individuare pattern di errore, anomalie o trend richiede tempo
e competenze specifiche.

Questo server automatizza l'analisi, supportando sia log in formato testo puro
che log strutturati in formato JSON (NDJSON). Ogni tool e' stateless e opera
direttamente sul filesystem.

```
+------------------------------------------------------------+
|               log-analyzer server                          |
|                                                            |
|  +-------------------------------------------------------+ |
|  |                  Tool Layer                           | |
|  |                                                       | |
|  |  analyze-log-file   find-error-patterns               | |
|  |  tail-log           generate-summary                  | |
|  +-------------------------------------------------------+ |
|                         |                                  |
|                         v                                  |
|  +-------------------------------------------------------+ |
|  |           fs/promises (readFile)                      | |
|  |                                                       | |
|  |  Formati supportati:                                  | |
|  |  - Plain text (syslog, Apache, custom)                | |
|  |  - JSON lines (NDJSON, structured logging)            | |
|  |  - Auto-detection basata su campionamento             | |
|  +-------------------------------------------------------+ |
+------------------------------------------------------------+
```

### Caratteristiche principali

- **Auto-detection formato**: campionamento delle prime 10 righe per decidere se JSON o plain text
- **Multi-formato timestamp**: ISO 8601, Common Log Format, Syslog, date-time generico
- **Normalizzazione pattern**: sostituzione di UUID, IP, numeri, URL per raggruppare errori simili
- **Nessun evento, nessuno store**: analisi puramente stateless e on-demand

---

## Tabella dei Tool

| Tool | Descrizione | Parametri |
|------|-------------|-----------|
| `analyze-log-file` | Analizza un file di log: conteggio per livello, estrazione errori, range temporale | `filePath` (string); `format?` (enum: auto, json, plain) |
| `find-error-patterns` | Trova pattern di errore ricorrenti raggruppando messaggi simili | `filePath` (string); `minCount?` (number, default: 2) |
| `tail-log` | Restituisce le ultime N righe di un file di log con filtro opzionale | `filePath` (string); `lines?` (number, default: 50); `filter?` (string) |
| `generate-summary` | Genera un sommario leggibile con conteggi, indicatori di salute e top errori | `filePath` (string) |

---

## Architettura

### Riconoscimento formato

```
  File di log
      |
      v
  Campiona prime 10 righe
      |
      v
  Ogni riga inizia con '{' e parsa come JSON?
      |
  +---+---+
  |       |
  v       v
 JSON   Plain text
  |       |
  v       v
  parseJsonLine()    extractLogLevel()
  - obj.level        - regex: ERROR|WARN|INFO|DEBUG|...
  - obj.message      extractTimestamp()
  - obj.timestamp    - ISO 8601
                     - Common Log Format
                     - Syslog
                     - Date-time generico
```

### Pattern di timestamp supportati

| Formato | Esempio | Pattern |
|---------|---------|---------|
| ISO 8601 | `2024-01-15T10:30:00.000Z` | `\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}` |
| Common Log | `15/Jan/2024:10:30:00 +0000` | `\d{2}/\w{3}/\d{4}:\d{2}:\d{2}:\d{2}` |
| Syslog | `Jan 15 10:30:00` | `\w{3}\s+\d{1,2}\s\d{2}:\d{2}:\d{2}` |
| Date-time | `2024-01-15 10:30:00` | `\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}` |

### Livelli di log riconosciuti

`ERROR`, `WARN` (WARNING), `INFO`, `DEBUG`, `TRACE`, `FATAL`, `CRITICAL`, `NOTICE`

### Normalizzazione errori (find-error-patterns)

Il tool `find-error-patterns` normalizza i messaggi di errore per raggruppare
occorrenze dello stesso problema con dati diversi:

| Elemento | Sostituzione | Esempio |
|----------|-------------|---------|
| Timestamp | `<TIMESTAMP>` | `2024-01-15T10:30:00Z` -> `<TIMESTAMP>` |
| UUID | `<UUID>` | `550e8400-e29b-41d4-a716-446655440000` -> `<UUID>` |
| Hash esadecimale | `<HEX>` | `a1b2c3d4e5f6` -> `<HEX>` |
| Indirizzo IP | `<IP>` | `192.168.1.1:3000` -> `<IP>` |
| URL | `<URL>` | `https://api.example.com/v1` -> `<URL>` |
| Path file | `<PATH>` | `/var/log/app/error.log` -> `<PATH>` |
| Numeri | `<NUM>` | `42`, `1024` -> `<NUM>` |
| Stringhe quotate | `"<STR>"` | `"user not found"` -> `"<STR>"` |

### Flusso di generate-summary

```
  File di log
      |
      v
  Parse tutte le righe (JSON o plain)
      |
      +-- Conteggio per livello
      |
      +-- Estrazione range temporale (first/last timestamp)
      |
      +-- Raccolta messaggi di errore
      |
      +-- Calcolo indicatori:
      |     - Error rate = errors / total * 100
      |     - Warning rate = warnings / total * 100
      |
      +-- Top 5 errori per frequenza
      |
      v
  Output testo formattato:

  Log File Summary: /path/to/file.log
  ==================================================

  Total lines: 15234

  Log Level Breakdown:
    ERROR: 42 (0.3%)
    WARN: 156 (1.0%)
    INFO: 14836 (97.4%)
    DEBUG: 200 (1.3%)

  Time Range:
    Earliest: 2024-01-15T00:00:01Z
    Latest:   2024-01-15T23:59:58Z

  Health Indicators:
    Error rate: 0.3%
    Warning rate: 1.0%

  Top Error Messages:
    1. [15x] Connection timeout to database
    2. [12x] Failed to parse request body
    3. [8x]  Authentication token expired
```

---

## Integrazione Event Bus

Questo server **non pubblica ne' sottoscrive eventi**. Opera in modalita'
puramente on-demand analizzando file dal filesystem locale.

---

## Interazioni con altri server

| Server collegato | Direzione | Descrizione |
|------------------|-----------|-------------|
| `cicd-monitor` | complementare | I log delle build possono essere analizzati dopo il download |
| `docker-compose` | complementare | Log dei container Docker possono essere analizzati |
| `environment-manager` | complementare | Variabili d'ambiente influenzano il livello di logging |
| `performance-profiler` | complementare | Log di performance possono essere correlati con profiling |

---

## Esempi di utilizzo

### Analisi file di log

**Richiesta:**
```json
{
  "tool": "analyze-log-file",
  "arguments": {
    "filePath": "/var/log/app/application.log",
    "format": "auto"
  }
}
```

**Risposta:**
```json
{
  "totalLines": 5420,
  "levels": { "INFO": 5100, "WARN": 250, "ERROR": 65, "DEBUG": 5 },
  "topErrors": [
    { "message": "Connection refused to redis:6379", "count": 30 },
    { "message": "Request timeout after 30000ms", "count": 20 }
  ],
  "timeRange": {
    "earliest": "2024-06-15T08:00:01.234Z",
    "latest": "2024-06-15T18:45:30.567Z"
  }
}
```

### Ricerca pattern di errore

**Richiesta:**
```json
{
  "tool": "find-error-patterns",
  "arguments": {
    "filePath": "/var/log/app/application.log",
    "minCount": 3
  }
}
```

**Risposta:**
```json
{
  "totalPatternsFound": 4,
  "minCount": 3,
  "patterns": [
    {
      "pattern": "Connection refused to <IP>",
      "count": 30,
      "examples": [
        "Connection refused to 10.0.0.5:6379",
        "Connection refused to 10.0.0.5:6380"
      ]
    },
    {
      "pattern": "Request timeout after <NUM>ms for <URL>",
      "count": 20,
      "examples": [
        "Request timeout after 30000ms for https://api.external.com/v1/users"
      ]
    }
  ]
}
```

### Tail con filtro

**Richiesta:**
```json
{
  "tool": "tail-log",
  "arguments": {
    "filePath": "/var/log/app/application.log",
    "lines": 20,
    "filter": "ERROR"
  }
}
```

**Risposta:**
```
2024-06-15T18:30:00Z ERROR Connection refused to redis:6379
2024-06-15T18:35:12Z ERROR Request timeout after 30000ms
...
```

---

## Sviluppi futuri

- **Streaming / watch mode**: monitoraggio in tempo reale di file di log con `fs.watch`
- **Correlazione multi-file**: analisi incrociata di log da servizi diversi
- **Anomaly detection**: identificazione automatica di spike negli errori
- **Supporto formati aggiuntivi**: Apache access log, nginx, systemd journal
- **Compressione**: supporto per file `.gz` e `.bz2`
- **Integrazione Event Bus**: pubblicazione `log:anomaly-detected` per alert automatici
- **Filtri avanzati**: range temporali, espressioni regolari, livelli multipli
- **Output grafici**: istogrammi ASCII della distribuzione errori nel tempo
