# Codebase Knowledge Server

## Panoramica

Il server **codebase-knowledge** e' lo strumento di esplorazione e comprensione della
codebase. Risolve il problema dell'onboarding e della navigazione: quando uno sviluppatore
si unisce a un progetto esistente, o quando si lavora su una codebase ampia, servono
strumenti per capire rapidamente la struttura, trovare codice specifico e visualizzare
le dipendenze tra moduli.

Questo server fornisce quattro prospettive complementari sulla codebase:
- **Ricerca**: trovare pattern nel codice
- **Spiegazione**: capire cosa fa un singolo modulo
- **Mappa**: visualizzare la struttura ad albero delle directory
- **Grafo**: comprendere le dipendenze tra file

```
+------------------------------------------------------------+
|            codebase-knowledge server                       |
|                                                            |
|  +-------------------------------------------------------+ |
|  |                  Tool Layer                           | |
|  |                                                       | |
|  |  search-code         explain-module                   | |
|  |  architecture-map    dependency-graph                 | |
|  +-------------------------------------------------------+ |
|                         |                                  |
|                         v                                  |
|  +-------------------------------------------------------+ |
|  |           fs (readdir, readFile, stat)                | |
|  |                                                       | |
|  |  Directory escluse automaticamente:                   | |
|  |  node_modules, .git, dist, .next,                     | |
|  |  .cache, coverage, __pycache__                        | |
|  +-------------------------------------------------------+ |
+------------------------------------------------------------+
```

### Caratteristiche principali

- **Ricerca regex**: supporto completo per espressioni regolari con fallback a ricerca letterale
- **Analisi strutturale**: estrazione automatica di import, export, funzioni, classi, interfacce
- **Visualizzazione albero**: mappa ASCII della directory con conteggio file per tipo
- **Grafo dipendenze**: lista di adiacenza + diagramma Mermaid `graph LR`
- **Nessun evento**: server puramente read-only e stateless

---

## Tabella dei Tool

| Tool | Descrizione | Parametri |
|------|-------------|-----------|
| `search-code` | Cerca un pattern (stringa o regex) nella codebase e restituisce corrispondenze con numeri di riga | `directory` (string); `pattern` (string); `fileExtensions?` (string[]); `maxResults` (number, default: 20) |
| `explain-module` | Analizza un file sorgente e fornisce un riepilogo della sua struttura | `filePath` (string) |
| `architecture-map` | Genera una mappa ad albero testuale di una directory con conteggio file per tipo | `directory` (string); `maxDepth` (number, default: 3) |
| `dependency-graph` | Costruisce un grafo di dipendenze interne analizzando gli statement import/require | `directory` (string) |

---

## Architettura

### Directory escluse

Tutti i tool escludono automaticamente le seguenti directory dalla scansione:

| Directory | Motivo |
|-----------|--------|
| `node_modules` | Dipendenze di terze parti, troppo voluminose |
| `.git` | Metadati del version control |
| `dist` | Output di build compilato |
| `.next` | Cache di Next.js |
| `.cache` | Cache generiche |
| `coverage` | Report di copertura test |
| `__pycache__` | Cache Python bytecode |

### search-code: Motore di ricerca

```
  directory + pattern + fileExtensions?
       |
       v
  walkDirectory(dir, extensions)
    -> Lista ricorsiva di tutti i file
       (filtrati per estensione se specificata)
       |
       v
  Pattern -> RegExp
    - Se e' una regex valida: usa direttamente
    - Se non e' valida: escape dei caratteri speciali -> letterale
       |
       v
  Per ogni file:
    Per ogni riga:
      regex.test(line)?
        -> Si: aggiungi { lineNumber, content: line.trim() }
        -> Stop quando totalMatches >= maxResults
       |
       v
  Output:
  {
    directory, pattern, fileExtensions,
    totalFilesScanned, totalMatches, matchingFiles,
    matches: [{
      file: absolutePath,
      relativePath: "src/utils/helpers.ts",
      lines: [{ lineNumber: 42, content: "..." }]
    }]
  }
```

### explain-module: Analisi strutturale

Il tool estrae 6 categorie di informazioni da un file sorgente:

```
  filePath
    |
    v
  +---------------------------------------------------+
  | extractImports(content)                           |
  |   - import { X } from 'module'                    |
  |   - import X from 'module'                        |
  |   - import * as X from 'module'                   |
  +---------------------------------------------------+
    |
  +---------------------------------------------------+
  | extractExports(content)                           |
  |   - export function/const/class/interface/type    |
  |   - export { X, Y }                               |
  |   - export default                                |
  +---------------------------------------------------+
    |
  +---------------------------------------------------+
  | extractFunctions(content)                         |
  |   - function name()                               |
  |   - const name = () =>                            |
  |   - const name = async () =>                      |
  +---------------------------------------------------+
    |
  +---------------------------------------------------+
  | extractClasses(content)                           |
  |   - class Name / abstract class Name              |
  +---------------------------------------------------+
    |
  +---------------------------------------------------+
  | extractInterfaces(content)                        |
  |   - interface Name { }                            |
  +---------------------------------------------------+
    |
  +---------------------------------------------------+
  | extractTypeAliases(content)                       |
  |   - type Name =                                   |
  +---------------------------------------------------+
    |
    v
  ModuleSummary {
    filePath, fileName, extension, lineCount,
    imports, exports, functions, classes,
    interfaces, typeAliases
  }
```

### architecture-map: Generatore albero

```
  directory
    |
    v
  buildTree(dir, depth=0, maxDepth=3)
    |
    +-- readdirSync(dir, { withFileTypes: true })
    |
    +-- Ordina: directory prima, poi file
    |
    +-- Per ogni directory: ricorsione (se depth < maxDepth)
    |     Se depth == maxDepth: conta file senza entrare
    |
    +-- Per ogni file: nodo foglia con estensione
    |
    v
  renderTree(node, prefix, isLast)
    |
    v
  Output ASCII:

  └── src
      ├── index.ts
      ├── server.ts
      ├── tools/
      │   ├── analyze-diff.ts
      │   ├── check-complexity.ts
      │   └── suggest-improvements.ts
      └── services/
          └── templates.ts

  File Type Summary:
    .ts: 15
    .json: 3
    .md: 2
```

### dependency-graph: Grafo import

```
  directory
    |
    v
  collectSourceFiles(dir)
    -> .ts, .tsx, .js, .jsx, .mjs, .mts
    |
    v
  Per ogni file:
    parseImports(content):
      - import ... from 'source'
      - import 'source'
      - require('source')
    |
    +-- Solo import RELATIVI (iniziano con '.')
    |
    v
  resolveImportPath(source, fromFile, allFiles):
    1. path.resolve(fromDir, source)
    2. Prova estensioni: .ts, .tsx, .js, .jsx, .mjs, .mts
    3. Prova /index + estensioni
    4. Risoluzione .js -> .ts/.tsx
    |
    v
  adjacencyList: {
    "src/index.ts": ["src/server.ts"],
    "src/server.ts": ["src/tools/analyze-diff.ts", "src/tools/check-complexity.ts"]
  }
    |
    v
  generateMermaid(graph, baseDir):

  graph LR
    N0["src/index.ts"] --> N1["src/server.ts"]
    N1["src/server.ts"] --> N2["src/tools/analyze-diff.ts"]
    N1["src/server.ts"] --> N3["src/tools/check-complexity.ts"]
```

---

## Integrazione Event Bus

Questo server **non pubblica ne' sottoscrive eventi**. E' un server puramente
di analisi read-only.

---

## Interazioni con altri server

| Server collegato | Direzione | Descrizione |
|------------------|-----------|-------------|
| `api-documentation` | complementare | `search-code` trova file route; `explain-module` li analizza prima di `extract-endpoints` |
| `code-review` | complementare | Fornisce contesto sui moduli prima della review |
| `dependency-manager` | complementare | Il grafo delle dipendenze interne complementa l'analisi delle dipendenze npm |
| `test-generator` | complementare | `explain-module` identifica funzioni per cui generare test |
| `project-scaffolding` | complementare | L'architettura map valida la struttura dei progetti generati |

---

## Esempi di utilizzo

### Ricerca nel codice

**Richiesta:**
```json
{
  "tool": "search-code",
  "arguments": {
    "directory": "/home/user/project",
    "pattern": "TODO|FIXME",
    "fileExtensions": [".ts", ".js"],
    "maxResults": 10
  }
}
```

**Risposta:**
```json
{
  "directory": "/home/user/project",
  "pattern": "TODO|FIXME",
  "totalFilesScanned": 47,
  "totalMatches": 5,
  "matchingFiles": 3,
  "matches": [
    {
      "file": "/home/user/project/src/auth.ts",
      "relativePath": "src/auth.ts",
      "lines": [
        { "lineNumber": 42, "content": "// TODO: implement token refresh" },
        { "lineNumber": 78, "content": "// FIXME: race condition on concurrent login" }
      ]
    }
  ]
}
```

### Spiegazione modulo

**Richiesta:**
```json
{
  "tool": "explain-module",
  "arguments": {
    "filePath": "/home/user/project/src/services/auth.service.ts"
  }
}
```

**Risposta:**
```json
{
  "filePath": "/home/user/project/src/services/auth.service.ts",
  "fileName": "auth.service.ts",
  "extension": ".ts",
  "lineCount": 120,
  "imports": [
    { "source": "jsonwebtoken", "specifiers": ["sign", "verify"] },
    { "source": "./user.repository.js", "specifiers": ["UserRepository"] }
  ],
  "exports": ["AuthService", "authService"],
  "functions": ["validateToken", "refreshToken"],
  "classes": ["AuthService"],
  "interfaces": ["TokenPayload", "AuthConfig"],
  "typeAliases": ["AuthResult"]
}
```

### Mappa architettura

**Richiesta:**
```json
{
  "tool": "architecture-map",
  "arguments": {
    "directory": "/home/user/project/src",
    "maxDepth": 2
  }
}
```

**Risposta:**
```
Architecture Map: /home/user/project/src
Max Depth: 2

└── src
    ├── controllers/
    │   ├── auth.controller.ts
    │   └── user.controller.ts
    ├── services/
    │   ├── auth.service.ts
    │   └── user.service.ts
    ├── models/
    │   └── user.model.ts
    ├── app.ts
    └── index.ts

File Type Summary:
  .ts: 7
```

### Grafo dipendenze

**Richiesta:**
```json
{
  "tool": "dependency-graph",
  "arguments": {
    "directory": "/home/user/project/src"
  }
}
```

**Risposta (semplificata):**
```json
{
  "directory": "/home/user/project/src",
  "totalFiles": 7,
  "totalDependencyEdges": 10,
  "adjacencyList": {
    "index.ts": ["app.ts"],
    "app.ts": ["controllers/auth.controller.ts", "controllers/user.controller.ts"],
    "controllers/auth.controller.ts": ["services/auth.service.ts"],
    "controllers/user.controller.ts": ["services/user.service.ts"],
    "services/user.service.ts": ["models/user.model.ts"]
  },
  "mermaidDiagram": "graph LR\n  N0[\"index.ts\"] --> N1[\"app.ts\"]\n  N1 --> N2[\"controllers/auth.controller.ts\"]\n  ..."
}
```

---

## Sviluppi futuri

- **Ricerca semantica**: ricerca basata su significato oltre che su pattern testuale
- **Call graph**: tracciamento delle chiamate di funzione tra moduli
- **Metriche complessita' modulo**: LOC, numero export, fan-in/fan-out per ogni file
- **Rilevamento codice morto**: file che non sono importati da nessun altro file
- **Supporto multi-linguaggio**: analisi di Python, Go, Rust oltre a TypeScript/JavaScript
- **Visualizzazione interattiva**: output HTML con grafo navigabile
- **Cache incrementale**: scansione solo dei file modificati dall'ultima analisi
- **Integrazione con `code-review`**: metrica di accoppiamento tra moduli come indicatore di qualita'
