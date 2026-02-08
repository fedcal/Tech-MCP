# HTTP Client Server

## Panoramica

Il server **http-client** e' un client HTTP completo integrato nella MCP Suite. Permette
di inviare richieste HTTP con qualsiasi metodo, confrontare risposte tra endpoint
diversi e generare comandi curl equivalenti. Utilizza l'API nativa `fetch()` di Node.js
con gestione di timeout tramite `AbortController` e serializzazione automatica JSON.

Il server e' **stateless**, non possiede database ne' store. Non pubblica ne' sottoscrive
eventi dall'Event Bus. Ogni richiesta e' indipendente e autocontenuta.

```
+-------------------------------------------------------------------+
|                      http-client server                           |
|                                                                   |
|  +----------------+   +-------------------+   +-----------------+ |
|  | send-request   |   | compare-responses |   | generate-curl   | |
|  |                |   |                   |   |                 | |
|  | - metodi HTTP  |   | - diff status     |   | - single-line   | |
|  | - headers      |   | - diff headers    |   | - multi-line    | |
|  | - body JSON    |   | - diff body       |   | - shell escape  | |
|  | - query params |   | - diff duration   |   |                 | |
|  | - timeout      |   |                   |   |                 | |
|  | - AbortCtrl    |   |                   |   |                 | |
|  +----------------+   +-------------------+   +-----------------+ |
|                                                                   |
|              Nessun evento -- Usa fetch nativo -- Stateless       |
+-------------------------------------------------------------------+
```

**Versione:** 0.1.0
**Entry point:** `servers/http-client/src/index.ts`
**Dipendenze:** `@mcp-suite/core`, `@mcp-suite/event-bus`

---

## Tabella dei Tool

| Tool | Descrizione | Parametri |
|------|-------------|-----------|
| `send-request` | Esegue una richiesta HTTP e restituisce status, header, body e durata | `method` (enum: GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS); `url` (string, URL valido); `headers` (Record, opzionale); `body` (string o object, opzionale); `queryParams` (Record, opzionale); `timeoutMs` (number, default: 30000) |
| `compare-responses` | Esegue due richieste e confronta status, header, body e durata | Parametri delle due richieste da confrontare |
| `generate-curl` | Genera un comando curl equivalente alla richiesta specificata | Parametri della richiesta; opzioni di formato (single-line, multi-line) |

---

## Dettaglio dei Tool

### send-request

Il tool principale del server. Costruisce ed esegue una richiesta HTTP completa con le
seguenti caratteristiche:

**Flusso di esecuzione:**

```
  Input parametri
       |
       v
  Costruzione URL con query params
       |
       v
  Preparazione headers
  (auto Content-Type: application/json se body e' object)
       |
       v
  Creazione AbortController con timeout
       |
       v
  fetch() con misurazione performance.now()
       |
       v
  Estrazione response headers
       |
       v
  Parse body (auto-detect JSON)
       |
       v
  Output strutturato: { status, statusText, headers, body, durationMs }
```

**Gestione automatica del body:**
- Se `body` e' un oggetto JavaScript, viene serializzato con `JSON.stringify()`
- Il header `Content-Type: application/json` viene aggiunto automaticamente se non presente
- Per metodi `GET` e `HEAD`, il body viene ignorato

**Gestione timeout:**
- Utilizza `AbortController` nativo
- Default: 30000ms (30 secondi)
- In caso di timeout, restituisce errore strutturato con `AbortError`

**Risposta strutturata:**

```json
{
  "status": 200,
  "statusText": "OK",
  "headers": {
    "content-type": "application/json",
    "x-request-id": "abc123"
  },
  "body": { "data": "..." },
  "durationMs": 145.23
}
```

### compare-responses

Esegue due richieste HTTP e produce un confronto dettagliato che include:

- **Status:** confronto codici di stato HTTP
- **Headers:** differenze tra gli header di risposta
- **Body:** differenze strutturali nel body (dimensione, chiavi JSON)
- **Duration:** confronto dei tempi di risposta in millisecondi

Utile per:
- Verificare che due ambienti (staging vs production) rispondano allo stesso modo
- Confrontare versioni diverse di un'API
- A/B testing su endpoint diversi

### generate-curl

Genera un comando `curl` equivalente alla richiesta specificata, disponibile in due formati:

**Single-line:**
```bash
curl -X POST 'https://api.example.com/users' -H 'Content-Type: application/json' -d '{"name":"Mario"}'
```

**Multi-line (leggibile):**
```bash
curl -X POST \
  'https://api.example.com/users' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Mario"
  }'
```

Include shell escaping corretto per valori che contengono caratteri speciali.

---

## Architettura

```
index.ts
  |
  +-- server.ts (createHttpClientServer)
        |
        +-- tools/send-request.ts       --> URL building + fetch() + timing
        +-- tools/compare-responses.ts  --> dual fetch + diff computation
        +-- tools/generate-curl.ts      --> curl command generation + escaping
```

Il server non ha servizi interni. Utilizza esclusivamente l'API `fetch()` nativa di
Node.js 18+ senza dipendenze esterne come `axios` o `got`.

---

## Integrazione Event Bus

Il server **non pubblica** e **non sottoscrive** alcun evento. Ogni richiesta e'
completamente isolata e non produce side effect nel sistema.

---

## Interazioni con altri Server

```
+------------------+                         +------------------+
| api-documentation| ---- (manuale) ------>  | http-client      |
| (genera docs API)|                         | (testa endpoint) |
+------------------+                         +------------------+
                                                    ^
+------------------+                                |
| environment-mgr  | ---- (manuale) ----------------+
| (fornisce URL e  |
|  variabili env)  |
+------------------+
```

- **api-documentation:** dopo aver documentato un'API, usare `http-client` per verificare
  che gli endpoint rispondano come documentato
- **environment-manager:** ottenere URL e token dagli ambienti per usarli nelle richieste

---

## Esempi di Utilizzo

### Richiesta GET con query params

```json
{
  "tool": "send-request",
  "arguments": {
    "method": "GET",
    "url": "https://api.example.com/users",
    "queryParams": { "page": "1", "limit": "10" },
    "headers": { "Authorization": "Bearer token123" },
    "timeoutMs": 5000
  }
}
```

### Richiesta POST con body JSON

```json
{
  "tool": "send-request",
  "arguments": {
    "method": "POST",
    "url": "https://api.example.com/users",
    "body": { "name": "Mario Rossi", "email": "mario@example.com" },
    "headers": { "Authorization": "Bearer token123" }
  }
}
```

Il `Content-Type: application/json` viene aggiunto automaticamente.

### Confrontare due ambienti

```json
{
  "tool": "compare-responses",
  "arguments": {
    "requestA": {
      "method": "GET",
      "url": "https://staging.api.com/health"
    },
    "requestB": {
      "method": "GET",
      "url": "https://production.api.com/health"
    }
  }
}
```

### Generare un comando curl

```json
{
  "tool": "generate-curl",
  "arguments": {
    "method": "POST",
    "url": "https://api.example.com/data",
    "headers": { "Content-Type": "application/json", "X-API-Key": "key123" },
    "body": { "query": "SELECT * FROM users" }
  }
}
```

---

## Sviluppi Futuri

- **Collezioni di richieste:** salvare insiemi di richieste come "collezioni" riusabili
  (simile a Postman)
- **Variabili di ambiente:** integrazione nativa con `environment-manager` per sostituire
  placeholder nelle URL e negli header
- **Chain di richieste:** eseguire sequenze di richieste dove l'output di una alimenta
  l'input della successiva (es. login -> usa token -> chiama API)
- **Mock server:** generare un mock server locale basato sulle risposte catturate
- **Retry con backoff:** supporto per retry automatici con exponential backoff
- **Metriche aggregate:** raccogliere statistiche su latenza e error rate per serie
  di richieste ripetute
- **Supporto GraphQL:** tool dedicato per query/mutation GraphQL con auto-completamento
  dello schema
- **WebSocket:** supporto per connessioni WebSocket bidirezionali
