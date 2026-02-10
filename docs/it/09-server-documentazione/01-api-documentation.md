# API Documentation Server

## Panoramica

Il server **api-documentation** automatizza l'estrazione, la generazione e l'analisi
della documentazione API. Il problema che risolve e' ben noto: la documentazione API
tende a diventare obsoleta rapidamente, gli sviluppatori dimenticano di aggiornare
i commenti JSDoc, e la specifica OpenAPI non riflette le route effettive nel codice.

Questo server scansiona il codice sorgente per trovare le definizioni di endpoint
(Express.js e NestJS), genera scheletri OpenAPI 3.0.3, e identifica gli export
privi di documentazione JSDoc/TSDoc.

```
+------------------------------------------------------------+
|                 api-documentation server                   |
|                                                            |
|  +-------------------------------------------------------+ |
|  |                    Tool Layer                         | |
|  |                                                       | |
|  |  extract-endpoints    generate-openapi                | |
|  |  find-undocumented                                    | |
|  +-------------------------------------------------------+ |
|                         |                                  |
|                         v                                  |
|  +-------------------------------------------------------+ |
|  |                fs (readFileSync)                      | |
|  |                                                       | |
|  |  Pattern riconosciuti:                                | |
|  |  - Express: app.get('/path', handler)                 | |
|  |  - Express: router.post('/path', middleware, handler) | |
|  |  - NestJS:  @Get('/path'), @Post('/path')             | |
|  |  - NestJS:  @Controller('/prefix')                    | |
|  +-------------------------------------------------------+ |
|                         |                                  |
|                         v                                  |
|  +-------------------------------------------------------+ |
|  |                   Event Bus                           | |
|  |   docs:api-updated                                    | |
|  |   docs:stale-detected                                 | |
|  +-------------------------------------------------------+ |
+------------------------------------------------------------+
```

### Caratteristiche principali

- **Dual-framework**: supporto per Express.js (route-based) e NestJS (decorator-based)
- **Generazione OpenAPI**: scheletro 3.0.3 con path parameters, request body e tags
- **Copertura documentazione**: percentuale di export con JSDoc/TSDoc
- **Analisi stateless**: nessuno store, lettura diretta dei file sorgente

---

## Tabella dei Tool

| Tool | Descrizione | Parametri |
|------|-------------|-----------|
| `extract-endpoints` | Scansiona un file sorgente per estrarre definizioni di endpoint API | `filePath` (string) - Percorso al file sorgente |
| `generate-openapi` | Genera una specifica OpenAPI 3.0.3 da un array di definizioni di endpoint | `endpoints` (array di {method, path, description?}); `title` (string); `version` (string) |
| `find-undocumented` | Trova funzioni ed export privi di commenti JSDoc/TSDoc | `filePath` (string) - Percorso al file sorgente |

---

## Architettura

### extract-endpoints: Riconoscimento pattern

Il tool usa due strategie di parsing in parallelo:

```
  File sorgente
       |
       +--------+--------+
       |                  |
       v                  v
  Express Routes     Decorator Routes
  (regex-based)      (regex-based)
       |                  |
       v                  v
  app.get('/x',h)    @Get('/x')
  router.post(..)    @Post('/x')
  inline handlers    @Controller('/prefix')
       |                  |
       +--------+---------+
                |
                v
          Merge + apply controller prefix
                |
                v
          Endpoint[] { method, path, handlerName, lineNumber }
```

**Pattern Express riconosciuti:**
- `app.get('/path', handler)` - con handler nominato
- `router.post('/path', middleware, handler)` - con middleware
- `app.get('/path', (req, res) => {...})` - handler inline

**Pattern Decorator riconosciuti:**
- `@Get('/path')`, `@Post('/path')`, `@Put`, `@Patch`, `@Delete`
- `@Controller('/prefix')` - prefisso applicato a tutti gli endpoint del file
- Lookahead per il nome del metodo (fino a 5 righe dopo il decorator)

### generate-openapi: Generazione specifica

```
  endpoints[] + title + version
       |
       v
  OpenAPI 3.0.3 skeleton
  {
    openapi: "3.0.3",
    info: { title, version, description },
    paths: {
      "/users/{id}": {             <-- :id -> {id} conversione automatica
        "get": {
          summary: "GET /users/:id",
          operationId: "getUsersById",
          tags: ["users"],          <-- estratto dal primo segmento del path
          parameters: [{            <-- parametri path automatici
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" }
          }],
          responses: {
            "200": { description: "Successful operation" },
            "400": { description: "Bad request" },
            "404": { description: "Not found" },
            "500": { description: "Internal server error" }
          }
        }
      }
    }
  }
```

Per metodi POST/PUT/PATCH viene aggiunto automaticamente un `requestBody` placeholder
con content type `application/json`.

### find-undocumented: Analisi copertura

```
  File sorgente
       |
       v
  Cerca pattern di export:
    export function name
    export default function name
    export class name
    export interface name
    export type name =
    export const name
    export enum name
    export { name1, name2 }  <-- traccia alla dichiarazione
       |
       v
  Per ogni export trovato:
    Guarda indietro (righe precedenti)
    Cerca /** ... */ (JSDoc/TSDoc)
       |
       +-- Trovato: isDocumented = true
       +-- Non trovato: isDocumented = false
            -> Pubblica docs:stale-detected
       |
       v
  Risultato:
  {
    totalExports: 10,
    documentedCount: 7,
    undocumentedCount: 3,
    coveragePercent: 70,
    documented: [...],
    undocumented: [...]
  }
```

---

## Integrazione Event Bus

### Eventi pubblicati

| Evento | Emesso da | Payload | Condizione |
|--------|-----------|---------|------------|
| `docs:api-updated` | `extract-endpoints` | `{ endpoint, method, changes }` | Quando vengono trovati endpoint |
| `docs:stale-detected` | `find-undocumented` | `{ filePath, lastUpdated, reason }` | Per ogni export senza JSDoc |

### Eventi sottoscritti

Nessuno.

---

## Interazioni con altri server

```
+---------------------+    docs:api-updated       +-------------------+
| api-documentation   | ----------------------->  | standup-notes     |
|                     |    docs:stale-detected    | agile-metrics     |
+---------------------+ ----------------------->  +-------------------+

+---------------------+                           +-------------------+
| codebase-knowledge  | ---- (esplorazione) ----> | api-documentation |
|                     |                           | (input: filePath) |
+---------------------+                           +-------------------+
```

| Server collegato | Direzione | Descrizione |
|------------------|-----------|-------------|
| `codebase-knowledge` | -> input | `search-code` puo' trovare file con route da passare a `extract-endpoints` |
| `code-review` | complementare | La mancanza di documentazione e' un problema di qualita' del codice |
| `project-scaffolding` | complementare | I template Express generano route analizzabili |
| `http-client` | complementare | Gli endpoint estratti possono essere testati direttamente |
| `standup-notes` | -> (via evento) | Riceve notifica di documentazione obsoleta |

---

## Esempi di utilizzo

### Estrazione endpoint

**Richiesta:**
```json
{
  "tool": "extract-endpoints",
  "arguments": {
    "filePath": "/home/user/project/src/routes/users.ts"
  }
}
```

**Risposta:**
```json
{
  "filePath": "/home/user/project/src/routes/users.ts",
  "fileName": "users.ts",
  "totalEndpoints": 4,
  "endpoints": [
    { "method": "GET", "path": "/users", "handlerName": "getAllUsers", "lineNumber": 8 },
    { "method": "GET", "path": "/users/:id", "handlerName": "getUserById", "lineNumber": 15 },
    { "method": "POST", "path": "/users", "handlerName": "createUser", "lineNumber": 22 },
    { "method": "DELETE", "path": "/users/:id", "handlerName": "deleteUser", "lineNumber": 30 }
  ],
  "controllerPrefix": null
}
```

### Generazione OpenAPI

**Richiesta:**
```json
{
  "tool": "generate-openapi",
  "arguments": {
    "endpoints": [
      { "method": "GET", "path": "/users", "description": "Lista tutti gli utenti" },
      { "method": "POST", "path": "/users", "description": "Crea un nuovo utente" },
      { "method": "GET", "path": "/users/:id", "description": "Ottieni utente per ID" }
    ],
    "title": "User Service API",
    "version": "1.0.0"
  }
}
```

**Risposta (semplificata):**
```json
{
  "openapi": "3.0.3",
  "info": { "title": "User Service API", "version": "1.0.0" },
  "paths": {
    "/users": {
      "get": {
        "summary": "Lista tutti gli utenti",
        "operationId": "getUsers",
        "tags": ["users"],
        "responses": { "200": {}, "400": {}, "404": {}, "500": {} }
      },
      "post": {
        "summary": "Crea un nuovo utente",
        "operationId": "postUsers",
        "requestBody": { "content": { "application/json": {} } }
      }
    },
    "/users/{id}": {
      "get": {
        "summary": "Ottieni utente per ID",
        "operationId": "getUsersById",
        "parameters": [{ "name": "id", "in": "path", "required": true }]
      }
    }
  }
}
```

### Ricerca codice non documentato

**Richiesta:**
```json
{
  "tool": "find-undocumented",
  "arguments": {
    "filePath": "/home/user/project/src/services/user.service.ts"
  }
}
```

**Risposta:**
```json
{
  "fileName": "user.service.ts",
  "totalExports": 5,
  "documentedCount": 3,
  "undocumentedCount": 2,
  "coveragePercent": 60,
  "documented": [
    { "name": "UserService", "type": "class", "lineNumber": 10, "isDocumented": true }
  ],
  "undocumented": [
    { "name": "createUser", "type": "function", "lineNumber": 45, "isDocumented": false },
    { "name": "UserInput", "type": "interface", "lineNumber": 5, "isDocumented": false }
  ]
}
```

---

## Sviluppi futuri

- **Scansione directory**: analisi ricorsiva di tutti i file route in un progetto
- **Supporto Fastify/Koa/Hono**: estensione a framework alternativi a Express
- **Validazione OpenAPI**: verifica che una specifica esistente sia conforme allo standard
- **Generazione Swagger UI**: output HTML interattivo per la documentazione
- **Diff documentazione**: confronto tra specifica OpenAPI e endpoint effettivi nel codice
- **Generazione automatica JSDoc**: creazione di commenti template per export non documentati
- **Integrazione con `test-generator`**: generazione test per ogni endpoint documentato
