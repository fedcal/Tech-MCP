# Test Generator Server

## Overview

The **test-generator** server is an MCP tool dedicated to automatic unit test generation,
edge case identification, and code coverage analysis. It represents the starting point
for any testing workflow within the MCP Suite, allowing you to go from source code to
test skeletons in seconds.

The server is **stateless**: it has no database or internal store. It receives source
code as input, analyzes it by parsing function signatures, and returns structured
output without maintaining state between invocations.

```
+--------------------------------------------------------------------+
|                    test-generator server                           |
|                                                                    |
|  +--------------------+  +------------------+  +-----------------+ |
|  | generate-unit-tests|  | find-edge-cases  |  |analyze-coverage | |
|  |                    |  |                  |  |                 | |
|  | - parse functions  |  | - null/undefined |  | - extract names  | |
|  | - generate describe|  | - empty arrays   |  | - search tests   | |
|  | - generate it blocks| | - division by 0  |  | - calculate %    | |
|  +--------+-----------+  +--------+---------+  +-------+---------+ |
|           |                       |                     |          |
|           v                       v                     v          |
|      test:generated        (no event)        test:coverage-report  |
+--------------------------------------------------------------------+
```

**Version:** 0.1.0
**Entry point:** `servers/test-generator/src/index.ts`
**Dependencies:** `@mcp-suite/core`, `@mcp-suite/event-bus`

---

## Tool Table

| Tool | Description | Parameters |
|------|-------------|-----------|
| `generate-unit-tests` | Generates unit test skeletons by analyzing function signatures in the source code | `code` (string, required): source code to analyze; `language` (string, default: `typescript`): source language; `framework` (string, default: `vitest`): test framework (`vitest`, `jest`, `mocha`) |
| `find-edge-cases` | Analyzes code and suggests edge cases to test, classified by severity | `code` (string, required): function code to analyze |
| `analyze-coverage` | Compares functions in the source with references in tests and calculates the coverage percentage | `sourceCode` (string, required): source code containing the functions; `testCode` (string, required): test code to verify |

---

## Tool Details

### generate-unit-tests

The tool parses the source code looking for two declaration patterns:

- **Classic functions:** `export (async) function name(params)`
- **Arrow functions:** `export const name = (async) (params) =>`

For each function found, it generates a `describe/it` block with three predefined tests:

1. Verify that the function exists and is callable
2. Test with valid input (placeholder for specific assertions)
3. Placeholder for edge cases (null, undefined, boundary values)

```typescript
// Example input
const code = `
export function calculateTotal(items: Item[], tax: number): number {
  return items.reduce((sum, item) => sum + item.price, 0) * (1 + tax);
}

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
};
`;

// Invocation
{ tool: "generate-unit-tests", code, framework: "vitest" }
```

**Generated output:**
```typescript
import { describe, it, expect } from 'vitest';

// import { calculateTotal, formatCurrency } from './source';

describe('calculateTotal', () => {
  it('should exist and be callable', () => {
    expect(calculateTotal).toBeDefined();
    expect(typeof calculateTotal).toBe('function');
  });

  it('should return expected result with valid input', () => {
    const result = calculateTotal(/* items */, /* tax */);
    expect(result).toBeDefined();
    // TODO: Add specific assertions
  });

  it('should handle edge cases', () => {
    // TODO: Test with null/undefined inputs
    // TODO: Test with empty values
    // TODO: Test with boundary values
  });
});
```

### find-edge-cases

Performs static analysis of the code to identify potential edge cases. The checks
performed are:

| Category | Severity | Detection Condition |
|----------|----------|---------------------|
| `null/undefined` | high | Presence of parameters in functions |
| `empty-string` | high | Use of `.length`, `.trim()`, `.split()`, `.includes()` |
| `whitespace-string` | medium | Same as above |
| `special-characters` | medium | Same as above |
| `empty-array` | high | Use of `.map()`, `.filter()`, `.reduce()`, `.forEach()` |
| `single-element-array` | medium | Same as above |
| `large-array` | low | Same as above |
| `zero` | high | Use of `parseInt`, `parseFloat`, `Number()`, `Math.*` |
| `negative-numbers` | high | Same as above |
| `boundary-numbers` | medium | Same as above |
| `division-by-zero` | high | Presence of the `/` operator (excludes comments) |
| `async-rejection` | high | Presence of `async`, `await`, `Promise`, `.then()` |
| `async-timeout` | medium | Same as above |
| `error-propagation` | high | Presence of `try/catch` blocks |
| `nested-null` | medium | Use of `?.`, `\|\|`, `&&` |
| `regex-edge-cases` | medium | Use of `RegExp`, `.match()`, `.test()` |
| `file-not-found` | high | Use of `readFile`, `writeFile`, `fs.*` |
| `file-permissions` | medium | Same as above |

The output includes a summary with total edge cases found, distribution by severity,
and detail for each identified case.

### analyze-coverage

Compares source code with test code to determine which functions have coverage.
The process is:

1. **Function name extraction** from the source (functions, arrow functions, class methods)
2. **Reference search** in tests: `describe()` blocks, `it()/test()` blocks,
   direct calls to the function
3. **Percentage calculation:** `(covered functions / total functions) * 100`

```
  Source                              Tests
  +------------------+              +------------------+
  | function add()   |  ------>     | describe('add')  |  COVERED
  | function sub()   |  ------>     | test('sub ...')  |  COVERED
  | function mul()   |  --X         |                  |  UNCOVERED
  | function div()   |  --X         |                  |  UNCOVERED
  +------------------+              +------------------+

  Coverage: 2/4 = 50%
```

---

## Architecture

The server follows a completely stateless architecture:

```
index.ts
  |
  +-- server.ts (createTestGeneratorServer)
        |
        +-- tools/generate-unit-tests.ts  --> parseFunctions() + generateTestCode()
        +-- tools/find-edge-cases.ts      --> analyzeEdgeCases()
        +-- tools/analyze-coverage.ts     --> extractFunctionNames() + findTestReferences()
```

There is no service or store. Each tool receives input, processes it in memory,
and returns the result. This design choice guarantees:

- **No database dependency:** zero configuration needed
- **Idempotency:** the same input always produces the same output
- **Scalability:** no shared state, no locks

---

## Event Bus Integration

### Published Events

| Event | Payload | Emitted by |
|-------|---------|-----------|
| `test:generated` | `{ filePath: string, testCount: number, framework: string }` | `generate-unit-tests` |
| `test:coverage-report` | `{ filePath: string, coverage: number, uncoveredLines: number[] }` | `analyze-coverage` |

### Subscribed Events

None. The server is a pure event producer.

---

## Interactions with Other Servers

```
+-------------------+       test:generated        +-------------------+
| test-generator    | --------------------------> | standup-notes     |
|                   |                             | (future: auto-log)|
|                   |       test:coverage-report  +-------------------+
|                   | --------------------------> | agile-metrics     |
+-------------------+                             | (future: metrics) |
                                                  +-------------------+
```

- **agile-metrics:** could in the future subscribe to `test:coverage-report` to
  include coverage metrics in sprint analyses
- **standup-notes:** could automatically log generated tests as completed activities

---

## Usage Examples

### Generate Tests for a Module

```json
{
  "tool": "generate-unit-tests",
  "arguments": {
    "code": "export function validateEmail(email: string): boolean { ... }",
    "language": "typescript",
    "framework": "vitest"
  }
}
```

### Find Edge Cases in an Async Function

```json
{
  "tool": "find-edge-cases",
  "arguments": {
    "code": "export async function fetchUser(id: string) { const res = await fetch(`/api/users/${id}`); return res.json(); }"
  }
}
```

Expected result: edge cases for `null/undefined`, `empty-string`, `async-rejection`,
`async-timeout`.

### Analyze Coverage

```json
{
  "tool": "analyze-coverage",
  "arguments": {
    "sourceCode": "export function add(a, b) { return a + b; }\nexport function sub(a, b) { return a - b; }",
    "testCode": "describe('add', () => { it('should add', () => { expect(add(1,2)).toBe(3); }); });"
  }
}
```

Result: `coveragePercentage: 50`, `uncoveredFunctions: ["sub"]`.

---

## Future Developments

- **Multi-language Support:** extend parsing to Python, Go, Rust
- **Advanced Test Generation:** integrate `find-edge-cases` suggestions directly
  into tests generated by `generate-unit-tests`
- **File System Integration:** read source and test files directly from paths
  on disk, instead of requiring code as a string
- **Customizable Templates:** allow users to define custom templates for
  `describe/it` blocks
- **Historical Metrics:** persist coverage reports to track evolution
  over time
- **Property-based Testing Support:** generate property-based tests with libraries
  like `fast-check`
