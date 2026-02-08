# Performance Profiler Server

## Panoramica

Il server **performance-profiler** fornisce strumenti di analisi statica delle prestazioni
per codice JavaScript e TypeScript. A differenza di un profiler runtime, questo server
analizza il codice sorgente senza eseguirlo, identificando anti-pattern di performance
noti, dipendenze pesanti e generando template di benchmark eseguibili.

Un principio fondamentale di questo server e' la **sicurezza by design**: non viene mai
eseguito `eval()` ne' codice arbitrario. Lo strumento `benchmark-compare` genera un
template Node.js che l'utente puo' eseguire separatamente nel proprio ambiente.

```
+-----------------------------------------------------------------------+
|                   performance-profiler server                         |
|                                                                       |
|  +----------------+   +------------------+   +--------------------+   |
|  | analyze-bundle |   | find-bottlenecks |   | benchmark-compare  |   |
|  |                |   |                  |   |                    |   |
|  | - legge file   |   | - nested loops   |   | - genera template  |   |
|  | - trova import |   | - sync I/O       |   | - warmup phase     |   |
|  | - heavy deps   |   | - await in loop  |   | - statistiche      |   |
|  +-------+--------+   +--------+---------+   +---------+----------+   |
|          |                      |                       |             |
|          v                      v                       v             |
|     (nessun evento)    perf:bottleneck-found   perf:profile-completed |
+-----------------------------------------------------------------------+
```

**Versione:** 0.1.0
**Entry point:** `servers/performance-profiler/src/index.ts`
**Dipendenze:** `@mcp-suite/core`, `@mcp-suite/event-bus`, `node:fs`, `node:path`

---

## Tabella dei Tool

| Tool | Descrizione | Parametri |
|------|-------------|-----------|
| `analyze-bundle` | Analizza file JS/TS per problemi di bundle size, import pesanti e conteggio dipendenze | `filePath` (string, obbligatorio): percorso a un file o directory da analizzare |
| `find-bottlenecks` | Analisi statica del codice per anti-pattern di performance | `code` (string, obbligatorio): codice da analizzare; `language` (string, default: `typescript`): linguaggio (`typescript`, `javascript`, `jsx`, `tsx`) |
| `benchmark-compare` | Genera un template di benchmark eseguibile per confrontare due snippet di codice | `codeA` (string, obbligatorio): primo snippet; `codeB` (string, obbligatorio): secondo snippet; `iterations` (number, default: 1000): numero di iterazioni |

---

## Dettaglio dei Tool

### analyze-bundle

Legge file JavaScript/TypeScript (singoli o intere directory, escludendo `node_modules` e
`dist`) e analizza gli import cercando dipendenze pesanti note.

**Pacchetti pesanti riconosciuti:**

| Pacchetto | Dimensione stimata | Alternativa suggerita |
|-----------|-------------------|----------------------|
| `moment` | ~300KB con locales | `date-fns` (~20KB) o `dayjs` (~2KB) |
| `lodash` | ~70KB minificato | `lodash-es` con tree shaking |
| `rxjs` | ~50KB+ (import completo) | Import specifici: `rxjs/operators` |
| `aws-sdk` | >100MB | `@aws-sdk/client-*` v3 modulare |
| `@material-ui` / `@mui` | 300KB+ senza tree shaking | Import nominati: `@mui/material/Button` |
| `chart.js` | ~200KB | Registrare solo chart type necessari |
| `three` | ~600KB+ | Import da `three/examples/jsm/` |
| `jquery` | ~85KB minificato | API DOM native |
| `underscore` | ~20KB | Metodi nativi Array/Object |

**Formato di output:**
```
{
  filePath, fileSize, imports[], totalImports,
  heavyDependencies: [{ name, reason, suggestion }],
  summary: { totalFiles, totalSize, heavyDependencyCount, estimatedBundleImpact }
}
```

L'impatto stimato e' classificato come:
- **Low:** nessuna dipendenza pesante
- **Medium:** 1-2 dipendenze pesanti
- **High:** 3+ dipendenze pesanti

### find-bottlenecks

Esegue analisi statica riga per riga del codice, rilevando i seguenti anti-pattern:

| Tipo | Severita' | Pattern rilevato |
|------|-----------|-----------------|
| `nested-loop` | critical | Loop `for/while` annidati (O(n^2)) |
| `sync-io` | warning | `readFileSync`, `writeFileSync`, `execSync`, `existsSync`, `readdirSync` |
| `linear-search-in-loop` | warning | `.indexOf()`, `.includes()`, `.find()` dentro un loop |
| `missing-pagination` | warning | `.find({})`, `.findAll()`, `SELECT * FROM` senza LIMIT |
| `dom-query-in-loop` | critical | `document.querySelector/getElementById` dentro un loop |
| `object-creation-in-render` | warning | `new Array/Object/Map/Set/RegExp` in contesto render React |
| `string-concat-in-loop` | info | Concatenazione stringa `+=` dentro un loop |
| `json-in-loop` | warning | `JSON.parse/stringify` dentro un loop |
| `recursion` | info | Funzione che chiama se stessa senza memoizzazione visibile |
| `sequential-await` | warning | `await` dentro un loop `for/while/forEach` |

Per ogni bottleneck trovato, l'output include:

```
{
  type: "nested-loop",
  severity: "critical",
  line: 42,
  description: "Nested loop detected - potential O(n^2)...",
  suggestion: "Consider using a Map/Set for lookups...",
  pattern: "for (const item of items) {"
}
```

### benchmark-compare

Genera un file Node.js completo con:

1. **Fase di warmup:** `min(100, iterations/10)` iterazioni di riscaldamento
2. **Fase di misurazione:** ogni iterazione e' cronometrata con `performance.now()`
3. **Calcolo statistiche:** mean, median, min, max, p95, p99, stdDev, ops/sec
4. **Confronto finale:** indica quale snippet e' piu' veloce e di quanto

```
+---------------------------------------------------+
|            Template di Benchmark                  |
|                                                   |
|  1. Definizione snippetA() e snippetB()           |
|  2. Warmup (10% iterazioni)                       |
|  3. Misurazione (N iterazioni con performance.now)|
|  4. Calcolo statistiche                           |
|     - mean, median, min, max                      |
|     - p95, p99, stdDev                            |
|     - ops/second                                  |
|  5. Confronto: "Snippet X is ~Yx faster"          |
+---------------------------------------------------+
```

---

## Architettura

```
index.ts
  |
  +-- server.ts (createPerformanceProfilerServer)
        |
        +-- tools/analyze-bundle.ts     --> parseImports() + getHeavyDependencyInfo()
        |                                   analyzeFile() + collectFiles()
        +-- tools/find-bottlenecks.ts   --> findBottlenecks() + isInsideLoop()
        |                                   isInsideRenderContext()
        +-- tools/benchmark-compare.ts  --> generateBenchmarkTemplate()
```

Il server e' stateless. Non possiede store ne' servizi persistenti. Ogni analisi e'
completamente indipendente dalle precedenti.

**Sicurezza:** Il tool `benchmark-compare` genera codice ma NON lo esegue. Non viene mai
usato `eval()`, `Function()`, `vm.runInNewContext()` o qualsiasi meccanismo di esecuzione
dinamica. L'utente deve copiare il template generato ed eseguirlo manualmente.

---

## Integrazione Event Bus

### Eventi pubblicati

| Evento | Payload | Emesso da |
|--------|---------|-----------|
| `perf:bottleneck-found` | `{ location: string, metric: string, value: number, threshold: number }` | `find-bottlenecks` (solo per bottleneck `critical`) |
| `perf:profile-completed` | `{ target: string, durationMs: number, results: object }` | `benchmark-compare` |

### Eventi sottoscritti

Nessuno. Il server e' un puro produttore di eventi.

---

## Interazioni con altri Server

```
+----------------------+     perf:bottleneck-found     +-----------------------+
| performance-profiler | ----------------------------> | standup-notes         |
|                      |                               | (futuro: segnalazione)|
|                      |     perf:profile-completed    +-----------------------+
|                      | ----------------------------> | agile-metrics         |
+----------------------+                               | (futuro: dashboard)   |
                                                       +-----------------------+
```

- **agile-metrics:** potrebbe includere contatori di bottleneck rilevati nelle metriche
  di qualita' dello sprint
- **standup-notes:** potrebbe registrare automaticamente problemi di performance come
  blocker

---

## Esempi di Utilizzo

### Analizzare una directory per dipendenze pesanti

```json
{
  "tool": "analyze-bundle",
  "arguments": {
    "filePath": "./src"
  }
}
```

### Trovare bottleneck in una funzione

```json
{
  "tool": "find-bottlenecks",
  "arguments": {
    "code": "async function processItems(items) {\n  for (const item of items) {\n    const result = await fetch(`/api/${item.id}`);\n    await result.json();\n  }\n}",
    "language": "typescript"
  }
}
```

Risultato atteso: `sequential-await` (warning) alla riga del `await` nel loop.

### Generare un benchmark di confronto

```json
{
  "tool": "benchmark-compare",
  "arguments": {
    "codeA": "const result = arr.filter(x => x > 0).map(x => x * 2);",
    "codeB": "const result = []; for (const x of arr) { if (x > 0) result.push(x * 2); }",
    "iterations": 5000
  }
}
```

Output: template Node.js completo pronto per l'esecuzione con `node benchmark.js`.

---

## Sviluppi Futuri

- **Integrazione con bundler reali:** analizzare output di webpack/vite/esbuild per
  dimensioni effettive del bundle
- **Profiling runtime:** opzione per eseguire benchmark in sandbox sicura con `vm` module
- **Cache dei risultati:** memorizzare analisi precedenti per confronto nel tempo
- **Supporto per metriche Web Vitals:** analizzare codice frontend per pattern che
  impattano LCP, FID, CLS
- **Integrazione CI/CD:** pubblicare risultati come commenti su pull request tramite
  l'event bus e il server `cicd-monitor`
- **Suggerimenti di refactoring automatici:** per ogni bottleneck trovato, generare
  il codice corretto alternativo
