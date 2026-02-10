# Snippet Manager Server

## Overview

The **snippet-manager** server is a reusable code fragment manager with
SQLite persistence. It allows saving, searching, retrieving, and organizing code
snippets with support for tags, programming language, and full-text search.

Unlike stateless servers, snippet-manager maintains persistent state
through the `SnippetStore` service based on SQLite, ensuring that snippets
are available across different sessions.

```
+---------------------------------------------------------------------+
|                    snippet-manager server                           |
|                                                                     |
|  +-------------+ +----------------+ +-----------+ +---------------+ |
|  |save-snippet | |search-snippets | |get-snippet| |delete-snippet | |
|  +------+------+ +-------+--------+ +-----+-----+ +------+--------+ |
|         |                |               |              |           |
|  +------+------+                                                    |
|  | list-tags   |                                                    |
|  +------+------+                                                    |
|         |                |               |              |           |
|         v                v               v              v           |
|  +-------------------------------------------------------------+    |
|  |                  SnippetStore (SQLite)                      |    |
|  |  +-------------------------------------------------------+  |    |
|  |  | snippets                                              |  |    |
|  |  | id | title | code | language | description | tags     |  |    |
|  |  |    |       |      |          |             | (JSON)   |  |    |
|  |  |    |       |      |          |             |          |  |    |
|  |  | createdAt  | updatedAt                                |  |    |
|  |  +-------------------------------------------------------+  |    |
|  +-------------------------------------------------------------+    |
+---------------------------------------------------------------------+
```

**Version:** 0.1.0
**Entry point:** `servers/snippet-manager/src/index.ts`
**Dependencies:** `@mcp-suite/core`, `@mcp-suite/event-bus`, `@mcp-suite/database`

---

## Tool Table

| Tool | Description | Parameters |
|------|-------------|-----------|
| `save-snippet` | Saves a new code snippet | `title` (string): title; `code` (string): code; `language` (string): language; `description` (string, optional): description; `tags` (string[], optional): tags |
| `search-snippets` | Searches snippets by keyword, tag, or language | `keyword` (string, optional): full-text search; `tag` (string, optional): filter by tag; `language` (string, optional): filter by language |
| `get-snippet` | Retrieves a snippet by ID | `id` (string): snippet ID |
| `delete-snippet` | Deletes a snippet by ID | `id` (string): snippet ID |
| `list-tags` | Lists all tags with usage count | No parameters |

---

## Tool Details

### save-snippet

Creates a new record in the `snippets` table with automatic timestamps. Tags are
serialized as a JSON array.

```json
{
  "tool": "save-snippet",
  "arguments": {
    "title": "Debounce function TypeScript",
    "code": "export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {\n  let timer: ReturnType<typeof setTimeout>;\n  return ((...args: any[]) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), ms);\n  }) as T;\n}",
    "language": "typescript",
    "description": "Generic debounce implementation with TypeScript typing",
    "tags": ["utility", "performance", "typescript"]
  }
}
```

### search-snippets

Supports three combinable search modes:

| Mode | Field | SQL Query |
|------|-------|-----------|
| `keyword` | title, description, code | `LIKE %keyword%` on all three fields |
| `tag` | tags (JSON) | `LIKE %"tag"%` in the JSON field |
| `language` | language | Exact match |

Filters are combinable with AND:

```json
{
  "tool": "search-snippets",
  "arguments": {
    "keyword": "fetch",
    "tag": "async",
    "language": "typescript"
  }
}
```

Results are ordered by `updatedAt DESC` (most recent snippets first).

### get-snippet

Direct retrieval by ID. Returns the complete `CodeSnippet` object or an error if
not found.

### delete-snippet

Permanent deletion by ID. Returns `true` if the snippet was deleted,
error if the ID does not exist.

### list-tags

Collects all unique tags from all snippets and returns an array sorted by
descending count:

```json
[
  { "tag": "typescript", "count": 15 },
  { "tag": "utility", "count": 12 },
  { "tag": "react", "count": 8 },
  { "tag": "async", "count": 5 }
]
```

---

## Architecture

```
index.ts
  |
  +-- server.ts (createSnippetManagerServer)
  |     |
  |     +-- creates SnippetStore
  |     +-- registers all tools passing the store
  |
  +-- services/
  |     +-- snippet-store.ts  --> SnippetStore (class with CRUD methods)
  |
  +-- tools/
        +-- save-snippet.ts
        +-- search-snippets.ts
        +-- get-snippet.ts
        +-- delete-snippet.ts
        +-- list-tags.ts
```

### SnippetStore

The store uses `@mcp-suite/database` to create and manage the SQLite database.

**`snippets` Table Schema:**

| Column | Type | Constraints |
|--------|------|------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `title` | TEXT | NOT NULL |
| `code` | TEXT | NOT NULL |
| `language` | TEXT | NOT NULL |
| `description` | TEXT | Nullable |
| `tags` | TEXT | NOT NULL, DEFAULT '[]' (JSON array) |
| `createdAt` | TEXT | NOT NULL, DEFAULT datetime('now') |
| `updatedAt` | TEXT | NOT NULL, DEFAULT datetime('now') |

**Migration (version 1):**
```sql
CREATE TABLE IF NOT EXISTS snippets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  code TEXT NOT NULL,
  language TEXT NOT NULL,
  description TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Tag Management:**
Tags are stored as a JSON string (`["tag1", "tag2"]`) in the `tags` field.
Deserialization occurs in the `rowToSnippet()` method via `JSON.parse()`.

The `listTags()` method performs a full table scan, parses all
tags, and aggregates them in a `Map<string, number>` for counting.

---

## Event Bus Integration

The server **does not publish** and **does not subscribe to** any events. Snippets are managed
in a completely local manner.

---

## Interactions with Other Servers

```
+------------------+                         +------------------+
| code-review      | ---- (manual) -------> | snippet-manager  |
| (finds reusable  |                         | (saves patterns  |
|  patterns)       |                         |  as snippets)    |
+------------------+                         +------------------+
        ^                                           |
        |                                           v
+------------------+                         +------------------+
| test-generator   |                         | project-         |
| (generates tests |                         | scaffolding      |
|  for snippets)   |                         | (uses snippets   |
+------------------+                         |  in templates)   |
                                             +------------------+
```

- **code-review:** during a review, save reusable patterns as snippets
- **test-generator:** generate tests for functions saved as snippets
- **project-scaffolding:** use saved snippets as templates for new projects

---

## Usage Examples

### Save a React Helper

```json
{
  "tool": "save-snippet",
  "arguments": {
    "title": "useLocalStorage Hook",
    "code": "function useLocalStorage<T>(key: string, initialValue: T) {\n  const [value, setValue] = useState<T>(() => {\n    const stored = localStorage.getItem(key);\n    return stored ? JSON.parse(stored) : initialValue;\n  });\n  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);\n  return [value, setValue] as const;\n}",
    "language": "typescript",
    "description": "React hook to synchronize state with localStorage",
    "tags": ["react", "hooks", "localstorage"]
  }
}
```

### Search Snippets by Tag

```json
{
  "tool": "search-snippets",
  "arguments": { "tag": "react" }
}
```

### View All Available Tags

```json
{
  "tool": "list-tags",
  "arguments": {}
}
```

---

## Future Developments

- **Snippet Versioning:** maintain a history of changes for each snippet
- **Import/Export:** import snippets from GitHub Gists, export as files
- **Advanced Full-text Search:** SQLite FTS5 index for more performant search
- **Shared Snippets:** synchronization via Event Bus with other suite users
- **Templates with Placeholders:** support `{{name}}` variables replaceable at
  time of use
- **Editor Integration:** generate VS Code or IntelliJ snippets directly from the store
- **Deduplication:** detect duplicate or very similar snippets and suggest merging
- **Rating and Statistics:** track how many times a snippet is used to sort
  by popularity
