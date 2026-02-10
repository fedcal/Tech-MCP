# Codebase Knowledge Server

## Overview

The **codebase-knowledge** server is the tool for exploring and understanding the
codebase. It solves the onboarding and navigation problem: when a developer
joins an existing project, or when working on a large codebase, tools are needed
to quickly understand the structure, find specific code, and visualize
dependencies between modules.

This server provides four complementary perspectives on the codebase:
- **Search**: find patterns in the code
- **Explanation**: understand what a single module does
- **Map**: visualize the directory tree structure
- **Graph**: understand dependencies between files

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
|  |  Automatically excluded directories:                  | |
|  |  node_modules, .git, dist, .next,                     | |
|  |  .cache, coverage, __pycache__                        | |
|  +-------------------------------------------------------+ |
+------------------------------------------------------------+
```

### Key Features

- **Regex Search**: full support for regular expressions with fallback to literal search
- **Structural Analysis**: automatic extraction of imports, exports, functions, classes, interfaces
- **Tree Visualization**: ASCII directory map with file count by type
- **Dependency Graph**: adjacency list + Mermaid `graph LR` diagram
- **No Events**: purely read-only and stateless server

---

## Tool Table

| Tool | Description | Parameters |
|------|-------------|-----------|
| `search-code` | Searches for a pattern (string or regex) in the codebase and returns matches with line numbers | `directory` (string); `pattern` (string); `fileExtensions?` (string[]); `maxResults` (number, default: 20) |
| `explain-module` | Analyzes a source file and provides a summary of its structure | `filePath` (string) |
| `architecture-map` | Generates a textual tree map of a directory with file count by type | `directory` (string); `maxDepth` (number, default: 3) |
| `dependency-graph` | Builds an internal dependency graph by analyzing import/require statements | `directory` (string) |

---

## Architecture

### Excluded Directories

All tools automatically exclude the following directories from scanning:

| Directory | Reason |
|-----------|--------|
| `node_modules` | Third-party dependencies, too large |
| `.git` | Version control metadata |
| `dist` | Compiled build output |
| `.next` | Next.js cache |
| `.cache` | Generic caches |
| `coverage` | Test coverage reports |
| `__pycache__` | Python bytecode cache |

### search-code: Search Engine

```
  directory + pattern + fileExtensions?
       |
       v
  walkDirectory(dir, extensions)
    -> Recursive list of all files
       (filtered by extension if specified)
       |
       v
  Pattern -> RegExp
    - If it is a valid regex: use directly
    - If it is not valid: escape special characters -> literal
       |
       v
  For each file:
    For each line:
      regex.test(line)?
        -> Yes: add { lineNumber, content: line.trim() }
        -> Stop when totalMatches >= maxResults
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

### explain-module: Structural Analysis

The tool extracts 6 categories of information from a source file:

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

### architecture-map: Tree Generator

```
  directory
    |
    v
  buildTree(dir, depth=0, maxDepth=3)
    |
    +-- readdirSync(dir, { withFileTypes: true })
    |
    +-- Sort: directories first, then files
    |
    +-- For each directory: recurse (if depth < maxDepth)
    |     If depth == maxDepth: count files without entering
    |
    +-- For each file: leaf node with extension
    |
    v
  renderTree(node, prefix, isLast)
    |
    v
  ASCII Output:

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

### dependency-graph: Import Graph

```
  directory
    |
    v
  collectSourceFiles(dir)
    -> .ts, .tsx, .js, .jsx, .mjs, .mts
    |
    v
  For each file:
    parseImports(content):
      - import ... from 'source'
      - import 'source'
      - require('source')
    |
    +-- Only RELATIVE imports (starting with '.')
    |
    v
  resolveImportPath(source, fromFile, allFiles):
    1. path.resolve(fromDir, source)
    2. Try extensions: .ts, .tsx, .js, .jsx, .mjs, .mts
    3. Try /index + extensions
    4. Resolution .js -> .ts/.tsx
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

## Event Bus Integration

This server **does not publish or subscribe to events**. It is a purely
read-only analysis server.

---

## Interactions with Other Servers

| Related Server | Direction | Description |
|----------------|-----------|-------------|
| `api-documentation` | complementary | `search-code` finds route files; `explain-module` analyzes them before `extract-endpoints` |
| `code-review` | complementary | Provides context about modules before review |
| `dependency-manager` | complementary | The internal dependency graph complements npm dependency analysis |
| `test-generator` | complementary | `explain-module` identifies functions for which to generate tests |
| `project-scaffolding` | complementary | The architecture map validates the structure of generated projects |

---

## Usage Examples

### Code Search

**Request:**
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

**Response:**
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

### Module Explanation

**Request:**
```json
{
  "tool": "explain-module",
  "arguments": {
    "filePath": "/home/user/project/src/services/auth.service.ts"
  }
}
```

**Response:**
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

### Architecture Map

**Request:**
```json
{
  "tool": "architecture-map",
  "arguments": {
    "directory": "/home/user/project/src",
    "maxDepth": 2
  }
}
```

**Response:**
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

### Dependency Graph

**Request:**
```json
{
  "tool": "dependency-graph",
  "arguments": {
    "directory": "/home/user/project/src"
  }
}
```

**Response (simplified):**
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

## Future Developments

- **Semantic Search**: search based on meaning rather than textual pattern
- **Call Graph**: function call tracing between modules
- **Module Complexity Metrics**: LOC, export count, fan-in/fan-out for each file
- **Dead Code Detection**: files that are not imported by any other file
- **Multi-language Support**: analysis of Python, Go, Rust in addition to TypeScript/JavaScript
- **Interactive Visualization**: HTML output with navigable graph
- **Incremental Cache**: scan only files modified since the last analysis
- **Integration with `code-review`**: coupling metric between modules as a quality indicator
