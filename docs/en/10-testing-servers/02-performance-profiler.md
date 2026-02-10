# Performance Profiler Server

## Overview

The **performance-profiler** server provides static performance analysis tools
for JavaScript and TypeScript code. Unlike a runtime profiler, this server
analyzes source code without executing it, identifying known performance
anti-patterns, heavy dependencies, and generating executable benchmark templates.

A fundamental principle of this server is **security by design**: `eval()` or
arbitrary code is never executed. The `benchmark-compare` tool generates a
Node.js template that the user can execute separately in their own environment.

```
+-----------------------------------------------------------------------+
|                   performance-profiler server                         |
|                                                                       |
|  +----------------+   +------------------+   +--------------------+   |
|  | analyze-bundle |   | find-bottlenecks |   | benchmark-compare  |   |
|  |                |   |                  |   |                    |   |
|  | - reads files  |   | - nested loops   |   | - generates templ. |   |
|  | - finds imports|   | - sync I/O       |   | - warmup phase     |   |
|  | - heavy deps   |   | - await in loop  |   | - statistics       |   |
|  +-------+--------+   +--------+---------+   +---------+----------+   |
|          |                      |                       |             |
|          v                      v                       v             |
|     (no event)         perf:bottleneck-found   perf:profile-completed |
+-----------------------------------------------------------------------+
```

**Version:** 0.1.0
**Entry point:** `servers/performance-profiler/src/index.ts`
**Dependencies:** `@mcp-suite/core`, `@mcp-suite/event-bus`, `node:fs`, `node:path`

---

## Tool Table

| Tool | Description | Parameters |
|------|-------------|-----------|
| `analyze-bundle` | Analyzes JS/TS files for bundle size issues, heavy imports, and dependency count | `filePath` (string, required): path to a file or directory to analyze |
| `find-bottlenecks` | Static code analysis for performance anti-patterns | `code` (string, required): code to analyze; `language` (string, default: `typescript`): language (`typescript`, `javascript`, `jsx`, `tsx`) |
| `benchmark-compare` | Generates an executable benchmark template to compare two code snippets | `codeA` (string, required): first snippet; `codeB` (string, required): second snippet; `iterations` (number, default: 1000): number of iterations |

---

## Tool Details

### analyze-bundle

Reads JavaScript/TypeScript files (single files or entire directories, excluding `node_modules` and
`dist`) and analyzes imports looking for known heavy dependencies.

**Recognized Heavy Packages:**

| Package | Estimated Size | Suggested Alternative |
|---------|---------------|----------------------|
| `moment` | ~300KB with locales | `date-fns` (~20KB) or `dayjs` (~2KB) |
| `lodash` | ~70KB minified | `lodash-es` with tree shaking |
| `rxjs` | ~50KB+ (full import) | Specific imports: `rxjs/operators` |
| `aws-sdk` | >100MB | `@aws-sdk/client-*` v3 modular |
| `@material-ui` / `@mui` | 300KB+ without tree shaking | Named imports: `@mui/material/Button` |
| `chart.js` | ~200KB | Register only required chart types |
| `three` | ~600KB+ | Import from `three/examples/jsm/` |
| `jquery` | ~85KB minified | Native DOM APIs |
| `underscore` | ~20KB | Native Array/Object methods |

**Output Format:**
```
{
  filePath, fileSize, imports[], totalImports,
  heavyDependencies: [{ name, reason, suggestion }],
  summary: { totalFiles, totalSize, heavyDependencyCount, estimatedBundleImpact }
}
```

The estimated impact is classified as:
- **Low:** no heavy dependencies
- **Medium:** 1-2 heavy dependencies
- **High:** 3+ heavy dependencies

### find-bottlenecks

Performs line-by-line static analysis of the code, detecting the following anti-patterns:

| Type | Severity | Detected Pattern |
|------|----------|-----------------|
| `nested-loop` | critical | Nested `for/while` loops (O(n^2)) |
| `sync-io` | warning | `readFileSync`, `writeFileSync`, `execSync`, `existsSync`, `readdirSync` |
| `linear-search-in-loop` | warning | `.indexOf()`, `.includes()`, `.find()` inside a loop |
| `missing-pagination` | warning | `.find({})`, `.findAll()`, `SELECT * FROM` without LIMIT |
| `dom-query-in-loop` | critical | `document.querySelector/getElementById` inside a loop |
| `object-creation-in-render` | warning | `new Array/Object/Map/Set/RegExp` in React render context |
| `string-concat-in-loop` | info | String concatenation `+=` inside a loop |
| `json-in-loop` | warning | `JSON.parse/stringify` inside a loop |
| `recursion` | info | Function calling itself without visible memoization |
| `sequential-await` | warning | `await` inside a `for/while/forEach` loop |

For each bottleneck found, the output includes:

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

Generates a complete Node.js file with:

1. **Warmup phase:** `min(100, iterations/10)` warmup iterations
2. **Measurement phase:** each iteration is timed with `performance.now()`
3. **Statistics calculation:** mean, median, min, max, p95, p99, stdDev, ops/sec
4. **Final comparison:** indicates which snippet is faster and by how much

```
+---------------------------------------------------+
|            Benchmark Template                     |
|                                                   |
|  1. Definition of snippetA() and snippetB()       |
|  2. Warmup (10% of iterations)                    |
|  3. Measurement (N iterations with performance.now)|
|  4. Statistics calculation                        |
|     - mean, median, min, max                      |
|     - p95, p99, stdDev                            |
|     - ops/second                                  |
|  5. Comparison: "Snippet X is ~Yx faster"         |
+---------------------------------------------------+
```

---

## Architecture

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

The server is stateless. It has no store or persistent services. Each analysis is
completely independent from previous ones.

**Security:** The `benchmark-compare` tool generates code but DOES NOT execute it. `eval()`,
`Function()`, `vm.runInNewContext()`, or any dynamic execution mechanism is never used.
The user must copy the generated template and execute it manually.

---

## Event Bus Integration

### Published Events

| Event | Payload | Emitted by |
|-------|---------|-----------|
| `perf:bottleneck-found` | `{ location: string, metric: string, value: number, threshold: number }` | `find-bottlenecks` (only for `critical` bottlenecks) |
| `perf:profile-completed` | `{ target: string, durationMs: number, results: object }` | `benchmark-compare` |

### Subscribed Events

None. The server is a pure event producer.

---

## Interactions with Other Servers

```
+----------------------+     perf:bottleneck-found     +-----------------------+
| performance-profiler | ----------------------------> | standup-notes         |
|                      |                               | (future: reporting)   |
|                      |     perf:profile-completed    +-----------------------+
|                      | ----------------------------> | agile-metrics         |
+----------------------+                               | (future: dashboard)   |
                                                       +-----------------------+
```

- **agile-metrics:** could include detected bottleneck counters in sprint quality
  metrics
- **standup-notes:** could automatically log performance issues as blockers

---

## Usage Examples

### Analyze a Directory for Heavy Dependencies

```json
{
  "tool": "analyze-bundle",
  "arguments": {
    "filePath": "./src"
  }
}
```

### Find Bottlenecks in a Function

```json
{
  "tool": "find-bottlenecks",
  "arguments": {
    "code": "async function processItems(items) {\n  for (const item of items) {\n    const result = await fetch(`/api/${item.id}`);\n    await result.json();\n  }\n}",
    "language": "typescript"
  }
}
```

Expected result: `sequential-await` (warning) at the line of the `await` in the loop.

### Generate a Comparison Benchmark

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

Output: complete Node.js template ready for execution with `node benchmark.js`.

---

## Future Developments

- **Real Bundler Integration:** analyze webpack/vite/esbuild output for
  actual bundle sizes
- **Runtime Profiling:** option to run benchmarks in a secure sandbox with the `vm` module
- **Results Caching:** store previous analyses for comparison over time
- **Web Vitals Metrics Support:** analyze frontend code for patterns that
  impact LCP, FID, CLS
- **CI/CD Integration:** publish results as pull request comments via
  the event bus and the `cicd-monitor` server
- **Automatic Refactoring Suggestions:** for each bottleneck found, generate
  the correct alternative code
