# Code Review Server

## Overview

The **code-review** server provides static code analysis tools oriented toward the review
process. Its main purpose is to solve a common problem in development teams:
manual code review is slow, subjective, and often overlooks repetitive issues
such as forgotten debug statements, hardcoded credentials, or overly complex functions.

This server automates mechanical checks, allowing human reviewers to focus
on business logic and architectural decisions.

```
+---------------------------------------------------+
|              code-review server                   |
|                                                   |
|  +---------------------------------------------+  |
|  |               Tool Layer                    |  |
|  |                                             |  |
|  |  analyze-diff   check-complexity            |  |
|  |  suggest-improvements                       |  |
|  +---------------------------------------------+  |
|                      |                            |
|                      v                            |
|  +---------------------------------------------+  |
|  |             Event Bus                       |  |
|  |  code:commit-analyzed                       |  |
|  |  code:review-completed                      |  |
|  +---------------------------------------------+  |
+---------------------------------------------------+
```

### Key Features

- **Stateless**: no internal store, each call is independent
- **Multi-language**: support for Python, Rust, Java, TypeScript-specific patterns
- **Severity grading**: each issue is classified as `error`, `warning`, or `info`
- **No external dependencies**: all analysis is performed via regex and pattern counting

---

## Tool Table

| Tool | Description | Parameters |
|------|-------------|-----------|
| `analyze-diff` | Analyzes a git diff string to identify common issues in added code | `diff` (string) - The git diff string to analyze |
| `check-complexity` | Calculates the cyclomatic complexity of a code snippet by counting decision points | `code` (string) - The code snippet; `language` (string) - The programming language |
| `suggest-improvements` | Suggests improvements regarding magic numbers, long functions, deep nesting, duplicate code, unused variables | `code` (string) - The code snippet; `language` (string) - The programming language |

---

## Architecture

The server has no store or internal services. Each tool operates as a pure function
that receives an input and produces a JSON result.

```
              MCP Request
                   |
                   v
        +---------------------+
        |   Tool Dispatcher   |
        +---------------------+
         /        |         \
        v         v          v
  analyze-   check-     suggest-
  diff       complexity  improvements
    |            |           |
    v            v           v
  parseDiff  calculate   checkMagicNumbers
  detectIss  Complexity  checkLongFunctions
  ues                    checkDeepNesting
                         checkDuplicatePatterns
                         checkUnusedVariables
```

### Data Flow of `analyze-diff`

1. The diff string is split into lines
2. Modified file names are extracted (`+++` headers)
3. Hunk headers are parsed to track line numbers
4. Each added line (`+`) is tested against issue patterns:
   - `console.log/debug/info/warn/error/trace/dir` -> `console-statement` (warning)
   - `TODO/FIXME/HACK/XXX/TEMP` in comments -> `todo-comment` (info)
   - `debugger` statement -> `debugger-statement` (error)
   - `alert()` calls -> `alert-statement` (warning)
   - Hardcoded password/secret/api_key/token -> `hardcoded-credential` (error)
   - Empty catch blocks -> `empty-catch` (warning)
5. Consecutive blocks of more than 50 added lines are checked -> `large-addition` (info)

### Data Flow of `check-complexity`

1. The code is stripped of comments and strings (to avoid false positives)
2. Decision patterns are counted: `if`, `else if`, `for`, `while`, `case`, `catch`, `&&`, `||`, `?:`
3. Language-specific patterns:
   - **Python**: `elif`, `except`, `and`, `or`
   - **Rust**: `match`, `=>`
4. Total complexity starts at 1 (main path) + pattern count
5. Rating: `<=5` low, `<=10` moderate, `<=20` high, `>20` very high

### Data Flow of `suggest-improvements`

1. Five independent checks are performed:
   - **Magic numbers**: numbers >= 2 digits not in const declarations (excludes 0,1,2,10,100,1000,24,60,1024)
   - **Long functions**: > 30 lines via curly brace counting
   - **Deep nesting**: > 4 levels of curly braces (deduplicated every 5 lines)
   - **Duplicate code**: identical lines (> 10 characters) appearing >= 3 times
   - **Unused variables**: variables declared but referenced only once
2. Suggestions are sorted by severity: `high` > `medium` > `low`

---

## Event Bus Integration

### Published Events

| Event | Emitted by | Payload |
|-------|-----------|---------|
| `code:commit-analyzed` | `analyze-diff` | `{ commitHash, files, stats: { filesChanged, linesAdded, linesRemoved } }` |
| `code:review-completed` | `suggest-improvements` | `{ files, issues, suggestions }` |

### Subscribed Events

None. The server is purely reactive to tool calls.

---

## Interactions with Other Servers

```
+------------------+     code:commit-analyzed       +-------------------+
|   code-review    | ---------------------------->  |   standup-notes   |
|                  |     code:review-completed      |   agile-metrics   |
+------------------+ ---------------------------->  +-------------------+

+------------------+                                +-------------------+
|  codebase-       |  (input for module analysis)   |   code-review     |
|  knowledge       | -----------------------------> |                   |
+------------------+                                +-------------------+
```

| Related Server | Direction | Description |
|----------------|-----------|-------------|
| `standup-notes` | -> (via event) | Receives notification of completed analyses |
| `agile-metrics` | -> (via event) | Can aggregate code quality metrics |
| `codebase-knowledge` | <- (input) | Provides context about modules and dependencies |
| `dependency-manager` | collaborative | Both analyze different aspects of code quality |

---

## Usage Examples

### Analyzing a diff

**Request:**
```json
{
  "tool": "analyze-diff",
  "arguments": {
    "diff": "--- a/src/app.ts\n+++ b/src/app.ts\n@@ -10,3 +10,5 @@\n+console.log('debug');\n+const password = 'secret123';\n+debugger;"
  }
}
```

**Response (simplified):**
```json
{
  "stats": { "filesChanged": 1, "linesAdded": 3, "linesRemoved": 0 },
  "totalIssues": 3,
  "issuesBySeverity": { "error": 2, "warning": 1, "info": 0 },
  "issues": [
    { "type": "console-statement", "severity": "warning", "line": 10 },
    { "type": "hardcoded-credential", "severity": "error", "line": 11 },
    { "type": "debugger-statement", "severity": "error", "line": 12 }
  ]
}
```

### Complexity check

**Request:**
```json
{
  "tool": "check-complexity",
  "arguments": {
    "code": "function process(data) {\n  if (data.valid) {\n    for (const item of data.items) {\n      if (item.active && item.count > 0) {\n        switch(item.type) {\n          case 'A': break;\n          case 'B': break;\n        }\n      }\n    }\n  }\n}",
    "language": "javascript"
  }
}
```

**Response:**
```json
{
  "totalComplexity": 7,
  "rating": "moderate - manageable complexity",
  "breakdown": [
    { "pattern": "if", "count": 2, "description": "If statements" },
    { "pattern": "for", "count": 1, "description": "For loops" },
    { "pattern": "case", "count": 2, "description": "Switch case branches" },
    { "pattern": "&&", "count": 1, "description": "Logical AND operators" }
  ],
  "lineCount": 12,
  "language": "javascript"
}
```

### Improvement suggestions

**Request:**
```json
{
  "tool": "suggest-improvements",
  "arguments": {
    "code": "function calc(x) {\n  const result = x * 3.14159;\n  const temp = 42;\n  return result * 86400;\n}",
    "language": "typescript"
  }
}
```

**Response (simplified):**
```json
{
  "totalSuggestions": 2,
  "suggestionsBySeverity": { "high": 0, "medium": 2, "low": 0 },
  "suggestions": [
    { "type": "magic-number", "severity": "medium", "message": "Magic number 3.14159 found" },
    { "type": "magic-number", "severity": "medium", "message": "Magic number 86400 found" }
  ]
}
```

---

## Future Developments

- **Multi-file support**: analysis of entire commits instead of single diffs
- **Customizable rules**: `.code-review.json` configuration file to enable/disable rules
- **Historical metrics**: database integration to track complexity evolution
- **Advanced security analysis**: patterns for SQL injection, XSS, path traversal
- **CI/CD integration**: automatic trigger on every push via the `cicd-monitor` server
- **Additional language patterns**: Go, C#, PHP, Ruby
- **Configurable thresholds**: parameters for function length, nesting depth, duplicate count
