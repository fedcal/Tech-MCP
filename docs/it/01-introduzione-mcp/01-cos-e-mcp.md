# Cos'e il Model Context Protocol (MCP)

## Introduzione

Il **Model Context Protocol (MCP)** e uno standard aperto sviluppato da Anthropic che definisce come le applicazioni AI (come Claude Desktop, Cursor, VS Code con Copilot) comunicano con strumenti esterni. MCP risolve un problema fondamentale: dare ai modelli linguistici la capacita di **agire** nel mondo reale, non solo di generare testo.

Prima di MCP, ogni integrazione tra un AI e un tool esterno richiedeva un'implementazione custom. MCP standardizza questa comunicazione, creando un ecosistema dove qualsiasi tool puo essere reso accessibile a qualsiasi AI compatibile.

---

## Il Problema che MCP Risolve

I Large Language Model (LLM) sono potenti nel ragionamento e nella generazione di testo, ma hanno limitazioni fondamentali:

- **Non possono accedere a dati in tempo reale** (il training ha una data di cutoff)
- **Non possono eseguire azioni** (creare file, chiamare API, interagire con database)
- **Non hanno contesto locale** (non conoscono il tuo progetto, i tuoi task, il tuo ambiente)

MCP colma questo gap fornendo un **protocollo di comunicazione bidirezionale** tra l'AI e il mondo esterno.

```
+-------------------+         MCP Protocol          +-------------------+
|                   |  <=========================>  |                   |
|   AI Application  |    Tool calls + Results       |     MCP Server    |
|  (Claude Desktop) |    Resources + Prompts        |   (il tuo tool)   |
|                   |                               |                   |
+-------------------+                               +-------------------+
      Host/Client                                        Server
```

---

## Concetti Fondamentali

### 1. Host

L'**Host** e l'applicazione AI che l'utente utilizza direttamente. Esempi:

- Claude Desktop
- Cursor IDE
- VS Code con estensioni MCP
- Applicazioni custom che usano l'SDK MCP

L'Host gestisce la sessione utente, connette i server MCP, e orchestra le chiamate ai tool.

### 2. Client

Il **Client** e il componente software nell'Host che implementa il lato client del protocollo MCP. Mantiene una connessione 1:1 con un server MCP e gestisce:

- La negoziazione delle capacita
- Il routing dei messaggi
- La gestione del ciclo di vita della connessione

### 3. Server

Il **Server** e il componente che espone funzionalità all'AI. Un server MCP puo offrire tre tipi di primitive:

| Primitiva | Descrizione | Esempio |
|-----------|-------------|---------|
| **Tools** | Funzioni che l'AI puo chiamare | `create-sprint`, `analyze-diff` |
| **Resources** | Dati che l'AI puo leggere | File, database, API response |
| **Prompts** | Template predefiniti | "Analizza questo codice per bug" |

### 4. Transport

Il **Transport** e il meccanismo di comunicazione tra Client e Server:

- **STDIO** (Standard Input/Output) - Il piu comune. Client e Server comunicano via stdin/stdout del processo. Ideale per processi locali.
- **HTTP + SSE** (Server-Sent Events) - Per server remoti. Il client invia richieste HTTP, il server risponde via SSE per streaming.

---

## Come Funziona una Chiamata Tool

```
Utente: "Crea uno sprint chiamato Sprint-15"
    |
    v
[1] Claude ragiona e decide di chiamare il tool "create-sprint"
    |
    v
[2] Il Client MCP serializza la richiesta in JSON-RPC
    { "method": "tools/call",
      "params": { "name": "create-sprint",
                  "arguments": { "name": "Sprint-15", ... } } }
    |
    v
[3] Il Server MCP riceve, esegue la logica, ritorna il risultato
    { "content": [{ "type": "text", "text": "Sprint creato con id 42" }] }
    |
    v
[4] Claude riceve il risultato e lo presenta all'utente
    "Ho creato lo sprint Sprint-15 (ID: 42)"
```

### Flusso Dettagliato

1. **Discovery**: All'avvio, il Client chiede al Server l'elenco di tool disponibili (`tools/list`)
2. **Schema**: Ogni tool dichiara i suoi parametri con uno schema JSON/Zod
3. **Invocazione**: L'AI decide autonomamente quando e quale tool chiamare
4. **Esecuzione**: Il Server esegue la logica e ritorna il risultato
5. **Composizione**: L'AI puo combinare piu chiamate tool per completare task complessi

---

## MCP vs REST API vs Plugin

| Caratteristica | REST API | Plugin AI | MCP |
|---------------|----------|-----------|-----|
| Standardizzato | Si (HTTP) | No (vendor-specific) | Si (protocollo aperto) |
| Discovery automatico | No | Parziale | Si |
| Tipizzazione parametri | OpenAPI | Varia | Zod/JSON Schema |
| Bidirezionale | No | No | Si |
| Supporto streaming | No nativo | Varia | Si (SSE) |
| Vendor lock-in | No | Si | No |
| Composabilita | Manuale | Limitata | Nativa |

---

## Perche MCP e Importante

1. **Interoperabilita**: Un server MCP funziona con Claude Desktop, Cursor, e qualsiasi altro client compatibile senza modifiche.

2. **Composabilita**: L'AI puo combinare tool di server diversi in un unico flusso di lavoro. Es: "Analizza il codice (code-review), genera i test (test-generator), e logga il tempo (time-tracking)".

3. **Sicurezza**: Il protocollo definisce chiaramente cosa un server puo fare. L'utente mantiene sempre il controllo sull'approvazione delle azioni.

4. **Ecosistema aperto**: Chiunque puo creare un server MCP. Non serve il permesso di nessun vendor.

5. **Contesto persistente**: A differenza delle API stateless, MCP supporta sessioni con stato, permettendo al server di mantenere contesto tra le chiamate.

---

## MCP Suite nel Contesto

MCP Suite implementa 22 server MCP che, insieme, coprono l'intero ciclo di vita dello sviluppo software:

```
  Pianificazione      Sviluppo           Testing           Deploy
  +-----------+     +-----------+     +-----------+     +-----------+
  | scrum-    |     | code-     |     | test-     |     | docker-   |
  | board     |---->| review    |---->| generator |---->| compose   |
  | agile-    |     | snippet-  |     | perf-     |     | cicd-     |
  | metrics   |     | manager   |     | profiler  |     | monitor   |
  +-----------+     +-----------+     +-----------+     +-----------+
       |                  |                 |                 |
       v                  v                 v                 v
  +-----------+     +-----------+     +-----------+     +-----------+
  | time-     |     | codebase- |     | db-schema |     | log-      |
  | tracking  |     | knowledge |     | explorer  |     | analyzer  |
  | project-  |     | api-docs  |     | data-mock |     | env-      |
  | economics |     | regex     |     | generator |     | manager   |
  +-----------+     +-----------+     +-----------+     +-----------+
```

Ogni server e progettato per essere:

- **Indipendente**: Funziona da solo senza le altre parti della suite
- **Collaborativo**: Quando collegato agli altri server, scambia eventi per automatizzare flussi
- **Estensibile**: Facile aggiungere nuovi tool o nuovi server seguendo il pattern stabilito
