# DB Schema Explorer Server

## Panoramica

Il server **db-schema-explorer** consente l'esplorazione interattiva degli schemi di
database SQLite. Risolve il problema della comprensione della struttura dati: quando
si lavora con un database esistente, e' necessario capire rapidamente quali tabelle
esistono, come sono collegate, quali indici mancano e come visualizzare le relazioni.

Questo server fornisce accesso in sola lettura al database, garantendo che nessuna
operazione possa modificare i dati o lo schema. Utilizza la libreria `better-sqlite3`
per un accesso diretto, sincrono e performante.

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

### Caratteristiche principali

- **Accesso in sola lettura**: `better-sqlite3` aperto con `{ readonly: true }`
- **PRAGMA-based**: tutta l'analisi si basa su comandi PRAGMA standard di SQLite
- **Generazione ERD**: diagrammi Mermaid erDiagram generati automaticamente
- **Suggerimenti indici**: identificazione automatica di foreign key senza indice

---

## Tabella dei Tool

| Tool | Descrizione | Parametri |
|------|-------------|-----------|
| `explore-schema` | Esplora lo schema del database, restituendo tutte le tabelle e le loro colonne | `dbPath` (string) - Percorso al file SQLite |
| `describe-table` | Dettaglio di una tabella: colonne, indici, foreign key e conteggio righe | `dbPath` (string); `tableName` (string) |
| `suggest-indexes` | Analizza le tabelle e suggerisce indici mancanti per migliori performance | `dbPath` (string) |
| `generate-erd` | Genera un diagramma entita'-relazione in sintassi Mermaid erDiagram | `dbPath` (string) |

---

## Architettura

### Query PRAGMA utilizzate

| PRAGMA | Uso | Informazioni restituite |
|--------|-----|------------------------|
| `sqlite_master` | Lista tabelle | `name` (escluse `sqlite_*`) |
| `PRAGMA table_info("table")` | Colonne della tabella | `cid, name, type, notnull, dflt_value, pk` |
| `PRAGMA index_list("table")` | Lista indici | `seq, name, unique, origin, partial` |
| `PRAGMA index_info("index")` | Colonne dell'indice | `seqno, cid, name` |
| `PRAGMA foreign_key_list("table")` | Foreign key | `id, seq, table, from, to, on_update, on_delete` |
| `SELECT COUNT(*)` | Conteggio righe | `count` |

### Flusso di explore-schema

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
  Per ogni tabella:
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

### Flusso di suggest-indexes

```
  Per ogni tabella:
    |
    +-- PRAGMA index_list -> set di colonne gia' indicizzate
    |
    +-- PRAGMA foreign_key_list -> elenco foreign key
    |       |
    |       v
    |   Per ogni FK il cui campo 'from' NON e' indicizzato:
    |       -> Suggerimento: CREATE INDEX idx_table_column ON "table"("column")
    |       -> Pubblica evento db:index-suggestion
    |
    +-- Se tabella ha > 1000 righe e NESSUN indice user-defined:
            -> Suggerimento generico di analisi query
```

### Flusso di generate-erd

```
  Per ogni tabella:
    |
    +-- PRAGMA table_info -> colonne con tipo convertito:
    |     INTEGER -> int, TEXT/CHAR -> string,
    |     REAL/FLOAT -> float, BLOB -> blob,
    |     BOOL -> boolean, DATE/TIME -> datetime
    |
    +-- PRAGMA foreign_key_list -> relazioni
    |
    v
  Output Mermaid:

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

## Integrazione Event Bus

### Eventi pubblicati

| Evento | Emesso da | Payload |
|--------|-----------|---------|
| `db:index-suggestion` | `suggest-indexes` | `{ database, table, columns, reason }` |

### Eventi sottoscritti

Nessuno.

---

## Interazioni con altri server

```
+---------------------+    db:index-suggestion    +-------------------+
| db-schema-explorer  | ----------------------->  | agile-metrics     |
|                     |                           | standup-notes     |
+---------------------+                           +-------------------+
         ^
         |  (dbPath come input)
         |
+---------------------+
| data-mock-generator |  genera dati che possono
|                     |  popolare il database
+---------------------+
```

| Server collegato | Direzione | Descrizione |
|------------------|-----------|-------------|
| `data-mock-generator` | complementare | Genera dati di test per popolare tabelle esplorate |
| `api-documentation` | complementare | Gli endpoint API spesso mappano direttamente sulle tabelle |
| `agile-metrics` | -> (via evento) | Puo' tracciare suggerimenti di ottimizzazione DB |
| `performance-profiler` | complementare | Performance scarse possono indicare indici mancanti |

---

## Esempi di utilizzo

### Esplorazione schema

**Richiesta:**
```json
{
  "tool": "explore-schema",
  "arguments": {
    "dbPath": "/home/user/data/app.sqlite"
  }
}
```

**Risposta:**
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

### Descrizione tabella

**Richiesta:**
```json
{
  "tool": "describe-table",
  "arguments": {
    "dbPath": "/home/user/data/app.sqlite",
    "tableName": "posts"
  }
}
```

**Risposta:**
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

### Suggerimento indici

**Richiesta:**
```json
{
  "tool": "suggest-indexes",
  "arguments": {
    "dbPath": "/home/user/data/app.sqlite"
  }
}
```

**Risposta:**
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

### Generazione ERD

**Richiesta:**
```json
{
  "tool": "generate-erd",
  "arguments": {
    "dbPath": "/home/user/data/app.sqlite"
  }
}
```

**Risposta (campo mermaid):**
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

## Sviluppi futuri

- **Supporto PostgreSQL e MySQL**: estensione oltre SQLite con driver nativi
- **Query analyzer**: analisi di query SQL con suggerimento di indici basato su EXPLAIN
- **Migrazione schema**: confronto tra due versioni di schema con generazione diff
- **Data sampling**: anteprima dei primi N record di ogni tabella
- **Statistiche avanzate**: distribuzione valori, valori NULL, cardinalita' colonne
- **Export schema**: generazione DDL SQL dallo schema esistente
- **Integrazione Event Bus bidirezionale**: sottoscrizione a eventi di modifica schema
