# @mcp-suite/database

## Introduzione

Il pacchetto `@mcp-suite/database` fornisce un'astrazione per la creazione e gestione di database SQLite utilizzati dai server MCP Suite. Offre due funzionalita principali: una factory per creare connessioni database (`createDatabase`) e un sistema di migrazioni incrementali (`runMigrations`).

```
packages/database/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts          # Re-export dei moduli pubblici
    ├── connection.ts     # createDatabase(), DatabaseOptions
    └── migrations.ts     # runMigrations(), Migration
```

**Dipendenze:**
- `@mcp-suite/core` - Per la gerarchia di errori e i tipi condivisi
- `better-sqlite3` - Driver SQLite nativo sincrono ad alte prestazioni

---

## createDatabase()

La funzione `createDatabase` e la factory principale per creare connessioni al database. Gestisce automaticamente la creazione delle directory, la configurazione del WAL mode e l'abilitazione delle foreign key.

### Interfaccia DatabaseOptions

```typescript
export interface DatabaseOptions {
  serverName: string;     // Nome del server (diventa il nome del file .db)
  dataDir?: string;       // Directory personalizzata (default: ~/.mcp-suite/data/)
  inMemory?: boolean;     // Se true, usa un database in memoria (per i test)
}
```

### Implementazione

```typescript
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_DATA_DIR = join(homedir(), '.mcp-suite', 'data');

export function createDatabase(options: DatabaseOptions): Database.Database {
  // Modalita in-memory per i test
  if (options.inMemory) {
    return new Database(':memory:');
  }

  // Crea la directory se non esiste
  const dataDir = options.dataDir || DEFAULT_DATA_DIR;
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Crea il database con il nome del server
  const dbPath = join(dataDir, `${options.serverName}.db`);
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Configurazione SQLite ottimale
  db.pragma('journal_mode = WAL');     // Write-Ahead Logging
  db.pragma('foreign_keys = ON');      // Integrta referenziale

  return db;
}
```

### Flusso di creazione

```
createDatabase({ serverName: 'scrum-board' })
        │
        ├── options.inMemory?
        │       └── Si ──► new Database(':memory:')
        │
        ├── Determina dataDir
        │       └── options.dataDir || ~/.mcp-suite/data/
        │
        ├── Crea directory (se non esiste)
        │       └── mkdirSync(dataDir, { recursive: true })
        │
        ├── Costruisce percorso database
        │       └── ~/.mcp-suite/data/scrum-board.db
        │
        ├── Crea connessione SQLite
        │       └── new Database(dbPath)
        │
        ├── Configura pragma
        │       ├── journal_mode = WAL
        │       └── foreign_keys = ON
        │
        └── Restituisce ──► Database.Database
```

---

## Directory dei Database

### Percorso di default

Il percorso predefinito e `~/.mcp-suite/data/` che si espande a:

| Sistema Operativo | Percorso Effettivo |
|-------------------|--------------------|
| **Linux** | `/home/utente/.mcp-suite/data/` |
| **macOS** | `/Users/utente/.mcp-suite/data/` |
| **Windows** | `C:\Users\utente\.mcp-suite\data\` |

### Struttura della directory

```
~/.mcp-suite/data/
├── scrum-board.db              # Sprint, storie, task
├── scrum-board.db-wal          # WAL file (Write-Ahead Log)
├── scrum-board.db-shm          # Shared memory per WAL
├── standup-notes.db            # Note di standup
├── time-tracking.db            # Registrazioni tempo
├── snippet-manager.db          # Snippet di codice
├── project-economics.db        # Budget, costi, economia
├── retrospective-manager.db    # Retrospettive e action items
├── environment-manager.db      # Variabili d'ambiente
└── ...                         # Un file per ogni server con persistenza
```

### Personalizzazione del percorso

```bash
# Globale (tutti i server)
export MCP_SUITE_DATA_DIR=/var/data/mcp-suite

# Per un singolo server
export MCP_SUITE_SCRUM_BOARD_DATA_DIR=/var/data/scrum
```

---

## WAL Journal Mode

Il **Write-Ahead Logging (WAL)** e un journal mode di SQLite che offre significativi vantaggi rispetto al default (rollback journal):

```
┌─────────────────────────────────────────────────────┐
│                  Modalita WAL                       │
│                                                     │
│  Lettori ──► Leggono dal file principale            │
│              (non bloccati dalle scritture)         │
│                                                     │
│  Scrittore ──► Scrive nel file WAL                  │
│                (non blocca i lettori)               │
│                                                     │
│  Checkpoint ──► Periodicamente, il WAL viene        │
│                 sincronizzato nel file principale   │
└─────────────────────────────────────────────────────┘
```

**Vantaggi del WAL mode:**
- **Letture concorrenti**: piu lettori simultanei senza blocchi
- **Scritture non bloccanti**: le scritture non bloccano le letture
- **Performance migliori**: meno operazioni I/O per le transazioni
- **Crash recovery**: il WAL file permette il recupero dopo crash

### Foreign Keys

L'abilitazione delle foreign key con `PRAGMA foreign_keys = ON` garantisce l'integrita referenziale:

```sql
-- Con foreign_keys ON, questa operazione fallira se la story
-- non esiste nella tabella stories
INSERT INTO tasks (title, storyId) VALUES ('Bug fix', 999);
-- Error: FOREIGN KEY constraint failed
```

---

## Sistema di Migrazioni

Il sistema di migrazioni permette ai server di evolvere il proprio schema database in modo incrementale e sicuro.

### Interfaccia Migration

```typescript
export interface Migration {
  version: number;        // Numero progressivo della migrazione
  description: string;    // Descrizione leggibile della migrazione
  up: string;             // SQL da eseguire per applicare la migrazione
}
```

### Funzione runMigrations

```typescript
export function runMigrations(db: Database.Database, migrations: Migration[]): void {
  // 1. Crea la tabella _migrations se non esiste
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 2. Legge le migrazioni gia applicate
  const applied = db
    .prepare('SELECT version FROM _migrations ORDER BY version')
    .all() as Array<{ version: number }>;
  const appliedVersions = new Set(applied.map((m) => m.version));

  // 3. Ordina le migrazioni per versione
  const sorted = [...migrations].sort((a, b) => a.version - b.version);

  // 4. Applica solo le migrazioni nuove
  const insertMigration = db.prepare(
    'INSERT INTO _migrations (version, description) VALUES (?, ?)',
  );

  for (const migration of sorted) {
    if (appliedVersions.has(migration.version)) continue;

    db.exec(migration.up);                                    // Esegue SQL
    insertMigration.run(migration.version, migration.description);  // Registra
  }
}
```

### Flusso delle Migrazioni

```
runMigrations(db, migrations)
        │
        ├── Crea tabella _migrations (se non esiste)
        │       └── version | description | applied_at
        │
        ├── Legge versioni gia applicate
        │       └── SELECT version FROM _migrations
        │
        ├── Per ogni migrazione non applicata (in ordine):
        │       ├── Esegue SQL (db.exec(migration.up))
        │       └── Registra nella tabella _migrations
        │
        └── Completato (schema aggiornato)
```

---

## Come i Server Definiscono i Propri Schemi

Ogni server che necessita di persistenza definisce le proprie migrazioni nel file store/service:

```typescript
// In servers/scrum-board/src/services/scrum-store.ts

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create sprints, stories, and tasks tables',
    up: `
      CREATE TABLE IF NOT EXISTS sprints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        goals TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'planning',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS stories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        acceptanceCriteria TEXT NOT NULL DEFAULT '[]',
        storyPoints INTEGER NOT NULL DEFAULT 0,
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'todo',
        sprintId INTEGER REFERENCES sprints(id),
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'todo',
        assignee TEXT,
        storyId INTEGER NOT NULL REFERENCES stories(id),
        sprintId INTEGER REFERENCES sprints(id),
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  // Futura migrazione per aggiungere colonne o indici:
  // {
  //   version: 2,
  //   description: 'Add tags column to tasks',
  //   up: `ALTER TABLE tasks ADD COLUMN tags TEXT DEFAULT '[]';`,
  // },
];
```

E nel costruttore dello Store:

```typescript
export class ScrumStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    this.db = createDatabase({
      serverName: 'scrum-board',     // => scrum-board.db
      inMemory: options?.inMemory,
      dataDir: options?.dataDir,
    });
    runMigrations(this.db, migrations);  // Applica le migrazioni
  }
}
```

---

## Pattern degli Array JSON

SQLite non ha un tipo nativo per gli array. MCP Suite usa la convenzione di serializzare gli array come stringhe JSON:

```typescript
// Salvataggio: JSON.stringify
const stmt = db.prepare('INSERT INTO sprints (goals) VALUES (?)');
stmt.run(JSON.stringify(['Goal 1', 'Goal 2']));

// Lettura: JSON.parse
function toSprint(row: SprintRow): Sprint {
  return {
    ...row,
    goals: JSON.parse(row.goals) as string[],
  };
}
```

Questo pattern e usato in tutti i server per campi come:
- `goals` (sprint) - array di stringhe
- `acceptanceCriteria` (story) - array di stringhe
- `tags` (snippet, task) - array di stringhe

---

## Database In-Memory per i Test

Per i test, ogni store supporta la modalita in-memory che non crea file su disco:

```typescript
import { ScrumStore } from './services/scrum-store.js';

// In un test
const store = new ScrumStore({ inMemory: true });

// Il database vive solo in RAM
// Le migrazioni vengono applicate normalmente
// Alla fine del test, il database viene automaticamente distrutto
```

Questo approccio garantisce:
- **Isolamento**: ogni test ha il proprio database
- **Velocita**: nessuna operazione I/O su disco
- **Pulizia automatica**: il database scompare quando l'oggetto viene garbage collected
