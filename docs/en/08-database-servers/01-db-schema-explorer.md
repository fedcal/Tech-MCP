# DB Schema Explorer Server

## Overview

The **db-schema-explorer** server enables interactive exploration of SQLite database
schemas. It solves the problem of understanding data structure: when
working with an existing database, it is necessary to quickly understand which tables
exist, how they are related, which indexes are missing, and how to visualize the relationships.

This server provides read-only access to the database, ensuring that no
operation can modify the data or the schema. It uses the `better-sqlite3`
library for direct, synchronous, and performant access.

```
+------------------------------------------------------------+
|              db-schema-explorer server                     |
|                                                            |
|  +-------------------------------------------------------+ |
|  |                       Tool Layer                      | |
|  |                                                       | |
|  |          explore-schema      describe-table           | |
|  |          suggest-indexes     generate-erd             | |
|  +-------------------------------------------------------+ |
|                         |                                  |
|                         v                                  |
|  +-------------------------------------------------------+ |
|  |           better-sqlite3 (readonly: true)             | |
|  |                                                       | |
|  |      PRAGMA table_info    PRAGMA index_list           | |
|  |      PRAGMA index_info    PRAGMA foreign_key_list     | |
|  |      sqlite_master        SELECT COUNT(*)             | |
|  +-------------------------------------------------------+ |
|                         |                                  |
|                         v                                  |
|  +------------------------------------------------------+  |
|  |          Event Bus: db:index-suggestion              |  |
|  +------------------------------------------------------+  |
+------------------------------------------------------------+
```

### Key Features

- **Read-only access**: `better-sqlite3` opened with `{ readonly: true }`
- **PRAGMA-based**: all analysis is based on standard SQLite PRAGMA commands
- **ERD generation**: Mermaid erDiagram diagrams generated automatically
- **Index suggestions**: automatic identification of foreign keys without indexes

---

## Tool Table

| Tool | Description | Parameters |
|------|-------------|-----------|
| `explore-schema` | Explores the database schema, returning all tables and their columns | `dbPath` (string) - Path to the SQLite file |
| `describe-table` | Table details: columns, indexes, foreign keys, and row count | `dbPath` (string); `tableName` (string) |
| `suggest-indexes` | Analyzes tables and suggests missing indexes for better performance | `dbPath` (string) |
| `generate-erd` | Generates an entity-relationship diagram in Mermaid erDiagram syntax | `dbPath` (string) |

---

## Architecture

### PRAGMA Queries Used

| PRAGMA | Usage | Returned Information |
|--------|-------|---------------------|
| `sqlite_master` | Table list | `name` (excluding `sqlite_*`) |
| `PRAGMA table_info("table")` | Table columns | `cid, name, type, notnull, dflt_value, pk` |
| `PRAGMA index_list("table")` | Index list | `seq, name, unique, origin, partial` |
| `PRAGMA index_info("index")` | Index columns | `seqno, cid, name` |
| `PRAGMA foreign_key_list("table")` | Foreign keys | `id, seq, table, from, to, on_update, on_delete` |
| `SELECT COUNT(*)` | Row count | `count` |

### Flow of explore-schema

```
  dbPath
    |
    v
  Database(dbPath, { readonly: true })
    |
    v
  SELECT name FROM sqlite_master
  WHERE type='table' AND name NOT LIKE 'sqlite_%'
    |
    v
  For each table:
    PRAGMA table_info("tableName")
    |
    v
  TableSchema[] = [{
    name: "users",
    columns: [
      { name: "id", type: "INTEGER", nullable: false, primaryKey: true },
      { name: "email", type: "TEXT", nullable: false, primaryKey: false },
      ...
    ]
  }]
    |
    v
  db.close()
```

### Flow of suggest-indexes

```
  For each table:
    |
    +-- PRAGMA index_list -> set of already indexed columns
    |
    +-- PRAGMA foreign_key_list -> list of foreign keys
    |       |
    |       v
    |   For each FK whose 'from' field is NOT indexed:
    |       -> Suggestion: CREATE INDEX idx_table_column ON "table"("column")
    |       -> Publishes db:index-suggestion event
    |
    +-- If table has > 1000 rows and NO user-defined indexes:
            -> Generic query analysis suggestion
```

### Flow of generate-erd

```
  For each table:
    |
    +-- PRAGMA table_info -> columns with converted types:
    |     INTEGER -> int, TEXT/CHAR -> string,
    |     REAL/FLOAT -> float, BLOB -> blob,
    |     BOOL -> boolean, DATE/TIME -> datetime
    |
    +-- PRAGMA foreign_key_list -> relationships
    |
    v
  Mermaid output:

  erDiagram
      users {
          int id PK
          string email
          string name
          datetime created_at
      }
      posts {
          int id PK
          int user_id
          string title
          string body
      }
      users ||--o{ posts : "id -> user_id"
```

---

## Event Bus Integration

### Published Events

| Event | Emitted by | Payload |
|-------|-----------|---------|
| `db:index-suggestion` | `suggest-indexes` | `{ database, table, columns, reason }` |

### Subscribed Events

None.

---

## Interactions with Other Servers

```
+---------------------+    db:index-suggestion    +-------------------+
| db-schema-explorer  | ----------------------->  | agile-metrics     |
|                     |                           | standup-notes     |
+---------------------+                           +-------------------+
         ^
         |  (dbPath as input)
         |
+---------------------+
| data-mock-generator |  generates data that can
|                     |  populate the database
+---------------------+
```

| Related Server | Direction | Description |
|----------------|-----------|-------------|
| `data-mock-generator` | complementary | Generates test data to populate explored tables |
| `api-documentation` | complementary | API endpoints often map directly to tables |
| `agile-metrics` | -> (via event) | Can track DB optimization suggestions |
| `performance-profiler` | complementary | Poor performance may indicate missing indexes |

---

## Usage Examples

### Schema exploration

**Request:**
```json
{
  "tool": "explore-schema",
  "arguments": {
    "dbPath": "/home/user/data/app.sqlite"
  }
}
```

**Response:**
```json
{
  "dbPath": "/home/user/data/app.sqlite",
  "tableCount": 3,
  "tables": [
    {
      "name": "users",
      "columns": [
        { "name": "id", "type": "INTEGER", "nullable": false, "primaryKey": true },
        { "name": "email", "type": "TEXT", "nullable": false, "primaryKey": false },
        { "name": "name", "type": "TEXT", "nullable": true, "primaryKey": false }
      ]
    },
    {
      "name": "posts",
      "columns": [
        { "name": "id", "type": "INTEGER", "nullable": false, "primaryKey": true },
        { "name": "user_id", "type": "INTEGER", "nullable": false, "primaryKey": false },
        { "name": "title", "type": "TEXT", "nullable": false, "primaryKey": false }
      ]
    }
  ]
}
```

### Table description

**Request:**
```json
{
  "tool": "describe-table",
  "arguments": {
    "dbPath": "/home/user/data/app.sqlite",
    "tableName": "posts"
  }
}
```

**Response:**
```json
{
  "tableName": "posts",
  "rowCount": 1523,
  "columns": [
    { "name": "id", "type": "INTEGER", "nullable": false, "primaryKey": true, "defaultValue": null },
    { "name": "user_id", "type": "INTEGER", "nullable": false, "primaryKey": false, "defaultValue": null },
    { "name": "title", "type": "TEXT", "nullable": false, "primaryKey": false, "defaultValue": null }
  ],
  "indexes": [
    { "name": "idx_posts_user_id", "unique": false, "columns": ["user_id"] }
  ],
  "foreignKeys": [
    { "id": 0, "table": "users", "from": "user_id", "to": "id", "onUpdate": "NO ACTION", "onDelete": "CASCADE" }
  ]
}
```

### Index suggestion

**Request:**
```json
{
  "tool": "suggest-indexes",
  "arguments": {
    "dbPath": "/home/user/data/app.sqlite"
  }
}
```

**Response:**
```json
{
  "tablesAnalyzed": 5,
  "suggestionsCount": 2,
  "suggestions": [
    {
      "table": "comments",
      "column": "post_id",
      "reason": "Foreign key column referencing \"posts\"(\"id\") is not indexed.",
      "suggestedSql": "CREATE INDEX idx_comments_post_id ON \"comments\"(\"post_id\");"
    }
  ]
}
```

### ERD Generation

**Request:**
```json
{
  "tool": "generate-erd",
  "arguments": {
    "dbPath": "/home/user/data/app.sqlite"
  }
}
```

**Response (mermaid field):**
```
erDiagram
    users {
        int id PK
        string email
        string name
        datetime created_at
    }
    posts {
        int id PK
        int user_id
        string title
        string body
    }
    users ||--o{ posts : "id -> user_id"
```

---

## Future Developments

- **PostgreSQL and MySQL support**: extension beyond SQLite with native drivers
- **Query analyzer**: SQL query analysis with index suggestions based on EXPLAIN
- **Schema migration**: comparison between two schema versions with diff generation
- **Data sampling**: preview of the first N records from each table
- **Advanced statistics**: value distribution, NULL values, column cardinality
- **Schema export**: SQL DDL generation from the existing schema
- **Bidirectional Event Bus integration**: subscription to schema modification events
