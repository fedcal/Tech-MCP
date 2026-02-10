# Project Scaffolding Server

## Panoramica

Il server **project-scaffolding** automatizza la creazione di nuovi progetti e componenti
a partire da template predefiniti. Risolve il problema della configurazione iniziale:
ogni nuovo progetto richiede la creazione manuale di `package.json`, `tsconfig.json`,
struttura delle cartelle e file boilerplate. Questo processo e' ripetitivo e soggetto a errori.

Con questo server, un singolo comando genera un progetto completo, coerente con le
best practice del team, pronto per iniziare lo sviluppo.

```
+------------------------------------------------------------+
|              project-scaffolding server                    |
|                                                            |
|  +-------------------------------------------------------+ |
|  |                  Tool Layer                           | |
|  |                                                       | |
|  |  list-templates  scaffold-project  scaffold-component | |
|  +-------------------------------------------------------+ |
|                         |                                  |
|                         v                                  |
|  +-------------------------------------------------------+ |
|  |              services/templates.ts                    | |
|  |                                                       | |
|  |  TEMPLATES = {                                        | |
|  |    'node-typescript'  -> Node.js + TypeScript + ESM   | |
|  |    'express-api'      -> Express REST API + TS        | |
|  |    'react-app'        -> React + Vite + TypeScript    | |
|  |    'mcp-server'       -> MCP Server + TypeScript      | |
|  |  }                                                    | |
|  |                                                       | |
|  |  substitutePlaceholders(content, values)              | |
|  +-------------------------------------------------------+ |
|                         |                                  |
|                         v                                  |
|                Filesystem (mkdir + writeFile)              |
+------------------------------------------------------------+
```

### Caratteristiche principali

- **4 template built-in**: coprono i casi d'uso piu' comuni
- **Sostituzione placeholder**: `{{projectName}}`, `{{author}}`, `{{description}}`, `{{license}}`
- **Generazione componenti singoli**: component, service, controller, model
- **Supporto TypeScript e JavaScript**: scelta del linguaggio per i componenti
- **Nessun evento**: server puramente generativo, nessuna integrazione Event Bus

---

## Tabella dei Tool

| Tool | Descrizione | Parametri |
|------|-------------|-----------|
| `list-templates` | Elenca tutti i template disponibili con nome, descrizione e struttura file | Nessuno |
| `scaffold-project` | Genera un intero progetto da un template con sostituzione placeholder | `template` (string) - Nome template; `projectName` (string); `outputDir` (string); `options?` (object: author, description, license) |
| `scaffold-component` | Genera un singolo file component/service/controller/model | `type` (enum: component, service, controller, model); `name` (string); `outputDir` (string); `language` (enum: typescript, javascript) |

---

## Architettura

### Service Layer: templates.ts

Il cuore del server e' il file `services/templates.ts` che contiene:

- L'interfaccia `TemplateDefinition`: `{ name, description, files: Record<string, string> }`
- Le definizioni dei 4 template come costanti
- Il registro `TEMPLATES: Record<string, TemplateDefinition>`
- La funzione `substitutePlaceholders(content, values)` per la sostituzione dei placeholder

```
  TemplateDefinition
  +-------------------+
  | name: string      |
  | description: str  |
  | files: {          |
  |   "path": content |     substitutePlaceholders()
  |   "path": content | --> {{projectName}} -> "my-app"
  |   ...             |     {{author}}      -> "Mario Rossi"
  | }                 |     {{description}} -> "..."
  +-------------------+     {{license}}     -> "MIT"
```

### Template disponibili

| Template | Descrizione | File generati |
|----------|-------------|---------------|
| `node-typescript` | Node.js con TypeScript, ESM e Vitest | package.json, tsconfig.json, src/index.ts, .gitignore, README.md |
| `express-api` | Express REST API con TypeScript, routing e middleware | package.json, tsconfig.json, src/index.ts, src/app.ts, src/routes/health.ts, src/middleware/error-handler.ts, .gitignore, README.md |
| `react-app` | Applicazione React con TypeScript e Vite | package.json, tsconfig.json, vite.config.ts, index.html, src/main.tsx, src/App.tsx, src/App.css, .gitignore, README.md |
| `mcp-server` | Server Model Context Protocol con TypeScript | package.json, tsconfig.json, src/index.ts, src/tools.ts, .gitignore, README.md |

### Tipi di componente generabili

| Tipo | File generato | Contenuto |
|------|---------------|-----------|
| `component` | `Name.tsx` / `Name.jsx` | Componente React con props interface (TS) |
| `service` | `Name.service.ts` / `.js` | Classe con metodi CRUD: findAll, findById, create, update, delete |
| `controller` | `Name.controller.ts` / `.js` | Controller Express con handler getAll, getById, create, update, delete |
| `model` | `Name.model.ts` / `.js` | Interface + funzioni factory create/update (TS) o funzioni plain (JS) |

### Flusso di scaffold-project

```
  1. Validazione template
         |
         v
  2. Preparazione valori placeholder
     { projectName, author, description, license }
         |
         v
  3. Per ogni file nel template:
     a. Calcolo percorso: outputDir/projectName/relativePath
     b. Creazione directory (mkdir recursive)
     c. Sostituzione placeholder nel contenuto
     d. Scrittura file su disco
         |
         v
  4. Restituzione lista file creati
```

---

## Integrazione Event Bus

Questo server **non pubblica ne' sottoscrive eventi**. E' un server puramente generativo
che opera su richiesta esplicita dell'utente.

---

## Interazioni con altri server

```
+----------------------+                          +---------------------+
| project-scaffolding  |  genera progetto    ---> | dependency-manager  |
|                      |  analizzabile            |  (check-vulnerab.)  |
+----------------------+                          +---------------------+
         |
         |  genera codice    ------>  +---------------------+
         +------------------------->  | code-review         |
                                      | (analyze/suggest)   |
                                      +---------------------+
         |
         |  genera struttura ------>  +---------------------+
         +------------------------->  | codebase-knowledge  |
                                      | (architecture-map)  |
                                      +---------------------+
```

| Server collegato | Direzione | Descrizione |
|------------------|-----------|-------------|
| `dependency-manager` | output -> input | I progetti generati possono essere analizzati per vulnerabilita'/licenze |
| `code-review` | output -> input | Il codice generato puo' essere sottoposto a revisione |
| `codebase-knowledge` | output -> input | La struttura generata puo' essere esplorata con architecture-map |
| `api-documentation` | output -> input | Le route Express generate possono essere estratte da extract-endpoints |

---

## Esempi di utilizzo

### Elenco template

**Richiesta:**
```json
{
  "tool": "list-templates",
  "arguments": {}
}
```

**Risposta:**
```json
[
  {
    "name": "node-typescript",
    "description": "Node.js project with TypeScript, ESM, and Vitest",
    "files": ["package.json", "tsconfig.json", "src/index.ts", ".gitignore", "README.md"]
  },
  {
    "name": "express-api",
    "description": "Express REST API with TypeScript, routing, and middleware",
    "files": ["package.json", "tsconfig.json", "src/index.ts", "src/app.ts", "..."]
  },
  {
    "name": "react-app",
    "description": "React application with TypeScript and Vite",
    "files": ["package.json", "tsconfig.json", "vite.config.ts", "index.html", "..."]
  },
  {
    "name": "mcp-server",
    "description": "Model Context Protocol server with TypeScript",
    "files": ["package.json", "tsconfig.json", "src/index.ts", "src/tools.ts", "..."]
  }
]
```

### Generazione progetto

**Richiesta:**
```json
{
  "tool": "scaffold-project",
  "arguments": {
    "template": "express-api",
    "projectName": "user-service",
    "outputDir": "/home/user/projects",
    "options": {
      "author": "Mario Rossi",
      "description": "Microservizio gestione utenti",
      "license": "MIT"
    }
  }
}
```

**Risposta:**
```json
{
  "template": "express-api",
  "projectName": "user-service",
  "outputDir": "/home/user/projects/user-service",
  "filesCreated": [
    "package.json", "tsconfig.json", "src/index.ts", "src/app.ts",
    "src/routes/health.ts", "src/middleware/error-handler.ts",
    ".gitignore", "README.md"
  ],
  "totalFiles": 8
}
```

### Generazione componente

**Richiesta:**
```json
{
  "tool": "scaffold-component",
  "arguments": {
    "type": "service",
    "name": "User",
    "outputDir": "/home/user/projects/user-service/src/services",
    "language": "typescript"
  }
}
```

**Risposta:**
```
Generated service file: /home/user/projects/user-service/src/services/User.service.ts

export class UserService {
  async findAll(): Promise<unknown[]> {
    throw new Error('Not implemented');
  }
  async findById(id: string): Promise<unknown | null> { ... }
  async create(data: unknown): Promise<unknown> { ... }
  async update(id: string, data: unknown): Promise<unknown> { ... }
  async delete(id: string): Promise<void> { ... }
}

export const userService = new UserService();
```

---

## Sviluppi futuri

- **Template personalizzati**: supporto per template definiti dall'utente in una directory configurabile
- **Variabili condizionali**: `{{#if useDatabase}}` per sezioni opzionali nei template
- **Post-scaffold hooks**: esecuzione automatica di `npm install`, `git init` dopo la generazione
- **Template compositi**: combinazione di piu' template (es. express-api + database + docker)
- **Generazione test**: scaffolding automatico di file di test per ogni componente generato
- **Integrazione Event Bus**: pubblicazione evento `project:created` per notificare altri server
- **Validazione nomi**: controllo PascalCase per componenti, kebab-case per progetti
