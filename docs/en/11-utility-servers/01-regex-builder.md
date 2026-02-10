# Regex Builder Server

## Overview

The **regex-builder** server is a complete toolkit for working with regular expressions.
It allows you to build regex from common patterns, test them against sample text, explain
in natural language what a pattern does, optimize it, and convert it between different
programming languages.

The server is completely **stateless**: it has no database, store, or persistent services.
It does not publish or subscribe to events from the Event Bus. Each invocation is independent.

```
+---------------------------------------------------------------------+
|                      regex-builder server                           |
|                                                                     |
|  +-----------+ +----------+ +-----------+ +----------+ +---------+  |
|  |build-regex| |test-regex| |explain-   | |optimize- | |convert- |  |
|  |           | |          | |regex      | |regex     | |regex    |  |
|  | email     | | match    | | explanat. | | reduce   | | JS<->Py |  |
|  | url       | | captures | | token by  | | backtrack| | JS<->Go |  |
|  | uuid      | | groups   | | token     | | altern.  | |         |  |
|  +-----------+ +----------+ +-----------+ +----------+ +---------+  |
|                                                                     |
|              No events -- No store -- Stateless                     |
+---------------------------------------------------------------------+
```

**Version:** 0.1.0
**Entry point:** `servers/regex-builder/src/index.ts`
**Dependencies:** `@mcp-suite/core`, `@mcp-suite/event-bus`

---

## Tool Table

| Tool | Description | Parameters |
|------|-------------|-----------|
| `build-regex` | Builds a regex from a common pattern name or description | `description` (string): pattern name or description; `anchorStart` (boolean, optional): adds `^`; `anchorEnd` (boolean, optional): adds `$`; `captureGroups` (boolean, optional): wraps in a capture group; `flags` (string, optional): suggested flags |
| `test-regex` | Tests a regex against a text and returns matches | `pattern` (string): regex pattern; `text` (string): text to test against; `flags` (string, optional): regex flags |
| `explain-regex` | Explains each part of a regex in natural language | `pattern` (string): pattern to explain |
| `optimize-regex` | Suggests optimizations for a regex pattern | `pattern` (string): pattern to optimize |
| `convert-regex` | Converts a regex between JavaScript, Python, and Go syntax | `pattern` (string): pattern to convert; `fromLanguage` (string): source language; `toLanguage` (string): target language |

---

## Tool Details

### build-regex

Builds regex from predefined pattern names. The available common patterns are:

| Pattern Name | Generated Expression | Description |
|-------------|---------------------|-------------|
| `email` | `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}` | Email address |
| `url` | `https?://[\w.-]+(?:\.[\w.-]+)+[\w.,@?^=%&:/~+#-]*` | HTTP/HTTPS URL |
| `ipv4` | `(?:(?:25[0-5]\|2[0-4]\d\|[01]?\d\d?)\.){3}(?:...)` | IPv4 address |
| `phone` | `\+?\d{1,3}[-.\\s]?\(?\d{1,4}\)?[-.\\s]?\d{1,4}[-.\\s]?\d{1,9}` | International phone number |
| `date_iso` | `\d{4}-(?:0[1-9]\|1[0-2])-(?:0[1-9]\|[12]\d\|3[01])` | ISO date (YYYY-MM-DD) |
| `time_24h` | `(?:[01]\d\|2[0-3]):[0-5]\d(?::[0-5]\d)?` | 24h time (HH:MM:SS) |
| `hex_color` | `#(?:[0-9a-fA-F]{3}){1,2}` | Hexadecimal color |
| `uuid` | `[0-9a-fA-F]{8}-...-[0-9a-fA-F]{12}` | UUID v4 |
| `slug` | `[a-z0-9]+(?:-[a-z0-9]+)*` | URL slug |
| `semver` | `\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?(?:\+...)?` | Semantic version |

If the requested pattern is not among the predefined ones, the tool returns the
complete list of available patterns with a suggestion to use `test-regex` to validate
a custom pattern.

**Customization Options:**
- `anchorStart: true` --> adds `^` at the beginning
- `anchorEnd: true` --> adds `$` at the end
- `captureGroups: true` --> wraps in `(...)`
- `flags: "gi"` --> adds global flags

### test-regex

Applies a regex pattern to text and returns all matches found, including
capture groups and positions.

```json
{
  "tool": "test-regex",
  "arguments": {
    "pattern": "\\b(\\w+)@(\\w+\\.\\w+)\\b",
    "text": "Contact mario@example.com or luigi@test.it",
    "flags": "g"
  }
}
```

### explain-regex

Analyzes a regex pattern token by token and produces a natural language explanation.
Useful for understanding complex regex inherited or found in existing codebases.

### optimize-regex

Analyzes a pattern and suggests optimizations to:
- Reduce the risk of catastrophic backtracking
- Simplify redundant alternations
- Use possessive quantifiers where supported
- Eliminate unnecessary capture groups (`(...)` --> `(?:...)`)

### convert-regex

Converts regex patterns between the syntaxes of:
- **JavaScript** (standard ECMAScript)
- **Python** (`re` module)
- **Go** (`regexp` package)

Handles syntax differences such as lookbehind, named groups, and flags.

---

## Architecture

```
index.ts
  |
  +-- server.ts (createRegexBuilderServer)
        |
        +-- tools/build-regex.ts      --> COMMON_PATTERNS + validation
        +-- tools/test-regex.ts       --> RegExp.exec() + match extraction
        +-- tools/explain-regex.ts    --> tokenization + explanation
        +-- tools/optimize-regex.ts   --> pattern analysis + suggestions
        +-- tools/convert-regex.ts    --> syntax mapping between languages
```

The architecture is purely functional. Each tool is a pure function that takes
input and produces output without side effects.

---

## Event Bus Integration

The server **does not publish** and **does not subscribe to** any events. It operates in complete
isolation, making it ideal for standalone usage.

---

## Interactions with Other Servers

```
+------------------+                         +------------------+
| test-generator   | ---- (manual) -------> | regex-builder    |
| (generates tests |                         | (validates       |
|  for regex funcs)|                         |  patterns in code)|
+------------------+                         +------------------+
                                                    ^
+------------------+                                |
| code-review      | ---- (manual) -----------------+
| (suggests        |
|  improvements)   |
+------------------+
```

Interactions are manual (the user invokes the tools in sequence), not automatic
via Event Bus:

- **test-generator:** generate tests for functions that use regex
- **code-review:** during a review, use `explain-regex` to understand complex
  patterns and `optimize-regex` to suggest improvements

---

## Usage Examples

### Build an Email Regex with Anchoring

```json
{
  "tool": "build-regex",
  "arguments": {
    "description": "email",
    "anchorStart": true,
    "anchorEnd": true,
    "flags": "i"
  }
}
```

**Output:**
```json
{
  "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
  "flags": "i",
  "description": "Email address",
  "fullRegex": "/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/i"
}
```

### Test a Regex for ISO Dates

```json
{
  "tool": "test-regex",
  "arguments": {
    "pattern": "\\d{4}-\\d{2}-\\d{2}",
    "text": "The project started on 2024-01-15 and will end on 2024-06-30",
    "flags": "g"
  }
}
```

### Explain a Complex Pattern

```json
{
  "tool": "explain-regex",
  "arguments": {
    "pattern": "(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)"
  }
}
```

### Convert a Pattern from JavaScript to Python

```json
{
  "tool": "convert-regex",
  "arguments": {
    "pattern": "(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})",
    "fromLanguage": "javascript",
    "toLanguage": "python"
  }
}
```

---

## Future Developments

- **Visual Pattern Builder:** guided interface for building complex regex step by step
- **Extended Pattern Library:** add patterns for Italian fiscal code, VAT number,
  IBAN, MAC address, JWT token
- **Regex Benchmark:** measure the execution time of a pattern on texts of various
  sizes
- **ReDoS Detection:** advanced analysis to identify patterns vulnerable to
  Regular Expression Denial of Service
- **Additional Language Support:** Rust, Java, C#, Ruby
- **Code Generation:** produce complete code with regex validation in every supported
  language
