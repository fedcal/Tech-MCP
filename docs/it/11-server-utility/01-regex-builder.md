# Regex Builder Server

## Panoramica

Il server **regex-builder** e' un toolkit completo per lavorare con le espressioni regolari.
Permette di costruire regex da pattern comuni, testarle contro testi di esempio, spiegare
in linguaggio naturale cosa fa un pattern, ottimizzarlo e convertirlo tra diversi linguaggi
di programmazione.

Il server e' completamente **stateless**: non possiede database, store o servizi persistenti.
Non pubblica ne' sottoscrive eventi dall'Event Bus. Ogni invocazione e' indipendente.

```
+---------------------------------------------------------------------+
|                      regex-builder server                           |
|                                                                     |
|  +-----------+ +----------+ +-----------+ +----------+ +---------+  |
|  |build-regex| |test-regex| |explain-   | |optimize- | |convert- |  |
|  |           | |          | |regex      | |regex     | |regex    |  |
|  | email     | | match    | | spiegaz.  | | riduci   | | JS<->Py |  |
|  | url       | | catture  | | token per | | backtrack| | JS<->Go |  |
|  | uuid      | | gruppi   | | token     | | altern.  | |         |  |
|  +-----------+ +----------+ +-----------+ +----------+ +---------+  |
|                                                                     |
|              Nessun evento -- Nessuno store -- Stateless            |
+---------------------------------------------------------------------+
```

**Versione:** 0.1.0
**Entry point:** `servers/regex-builder/src/index.ts`
**Dipendenze:** `@mcp-suite/core`, `@mcp-suite/event-bus`

---

## Tabella dei Tool

| Tool | Descrizione | Parametri |
|------|-------------|-----------|
| `build-regex` | Costruisce una regex da un nome di pattern comune o descrizione | `description` (string): nome pattern o descrizione; `anchorStart` (boolean, opzionale): aggiunge `^`; `anchorEnd` (boolean, opzionale): aggiunge `$`; `captureGroups` (boolean, opzionale): avvolge in gruppo di cattura; `flags` (string, opzionale): flag suggeriti |
| `test-regex` | Testa una regex contro un testo e restituisce i match | `pattern` (string): pattern regex; `text` (string): testo su cui testare; `flags` (string, opzionale): flag regex |
| `explain-regex` | Spiega ogni parte di una regex in linguaggio naturale | `pattern` (string): pattern da spiegare |
| `optimize-regex` | Suggerisce ottimizzazioni per un pattern regex | `pattern` (string): pattern da ottimizzare |
| `convert-regex` | Converte una regex tra sintassi JavaScript, Python e Go | `pattern` (string): pattern da convertire; `fromLanguage` (string): linguaggio sorgente; `toLanguage` (string): linguaggio destinazione |

---

## Dettaglio dei Tool

### build-regex

Costruisce regex a partire da nomi di pattern predefiniti. I pattern comuni disponibili sono:

| Nome pattern | Espressione generata | Descrizione |
|-------------|---------------------|-------------|
| `email` | `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}` | Indirizzo email |
| `url` | `https?://[\w.-]+(?:\.[\w.-]+)+[\w.,@?^=%&:/~+#-]*` | URL HTTP/HTTPS |
| `ipv4` | `(?:(?:25[0-5]\|2[0-4]\d\|[01]?\d\d?)\.){3}(?:...)` | Indirizzo IPv4 |
| `phone` | `\+?\d{1,3}[-.\\s]?\(?\d{1,4}\)?[-.\\s]?\d{1,4}[-.\\s]?\d{1,9}` | Numero di telefono internazionale |
| `date_iso` | `\d{4}-(?:0[1-9]\|1[0-2])-(?:0[1-9]\|[12]\d\|3[01])` | Data ISO (YYYY-MM-DD) |
| `time_24h` | `(?:[01]\d\|2[0-3]):[0-5]\d(?::[0-5]\d)?` | Orario 24h (HH:MM:SS) |
| `hex_color` | `#(?:[0-9a-fA-F]{3}){1,2}` | Colore esadecimale |
| `uuid` | `[0-9a-fA-F]{8}-...-[0-9a-fA-F]{12}` | UUID v4 |
| `slug` | `[a-z0-9]+(?:-[a-z0-9]+)*` | URL slug |
| `semver` | `\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?(?:\+...)?` | Versione semantica |

Se il pattern richiesto non e' tra quelli predefiniti, il tool restituisce la lista
completa dei pattern disponibili con suggerimento di usare `test-regex` per validare
un pattern personalizzato.

**Opzioni di personalizzazione:**
- `anchorStart: true` --> aggiunge `^` all'inizio
- `anchorEnd: true` --> aggiunge `$` alla fine
- `captureGroups: true` --> avvolge in `(...)`
- `flags: "gi"` --> aggiunge flag globali

### test-regex

Applica un pattern regex a un testo e restituisce tutti i match trovati, includendo
gruppi di cattura e posizioni.

```json
{
  "tool": "test-regex",
  "arguments": {
    "pattern": "\\b(\\w+)@(\\w+\\.\\w+)\\b",
    "text": "Contatta mario@example.com o luigi@test.it",
    "flags": "g"
  }
}
```

### explain-regex

Analizza un pattern regex token per token e produce una spiegazione in linguaggio naturale.
Utile per comprendere regex complesse ereditate o trovate in codebase esistenti.

### optimize-regex

Analizza un pattern e suggerisce ottimizzazioni per:
- Ridurre il rischio di catastrophic backtracking
- Semplificare alternanze ridondanti
- Usare quantificatori possessivi dove supportato
- Eliminare gruppi di cattura non necessari (`(...)` --> `(?:...)`)

### convert-regex

Converte pattern regex tra le sintassi di:
- **JavaScript** (standard ECMAScript)
- **Python** (modulo `re`)
- **Go** (pacchetto `regexp`)

Gestisce le differenze di sintassi come lookbehind, named groups e flag.

---

## Architettura

```
index.ts
  |
  +-- server.ts (createRegexBuilderServer)
        |
        +-- tools/build-regex.ts      --> COMMON_PATTERNS + validazione
        +-- tools/test-regex.ts       --> RegExp.exec() + match extraction
        +-- tools/explain-regex.ts    --> tokenizzazione + spiegazione
        +-- tools/optimize-regex.ts   --> analisi pattern + suggerimenti
        +-- tools/convert-regex.ts    --> mappatura sintassi tra linguaggi
```

L'architettura e' puramente funzionale. Ogni tool e' una funzione pura che prende
input e produce output senza effetti collaterali.

---

## Integrazione Event Bus

Il server **non pubblica** e **non sottoscrive** alcun evento. Opera in completo
isolamento, il che lo rende ideale per utilizzo standalone.

---

## Interazioni con altri Server

```
+------------------+                         +------------------+
| test-generator   | ---- (manuale) ------>  | regex-builder    |
| (genera test per |                         | (valida pattern  |
|  funzioni regex) |                         |  usati nel code) |
+------------------+                         +------------------+
                                                    ^
+------------------+                                |
| code-review      | ---- (manuale) ----------------+
| (suggerisce      |
|  miglioramenti)  |
+------------------+
```

Le interazioni sono manuali (l'utente invoca i tool in sequenza), non automatiche
tramite Event Bus:

- **test-generator:** generare test per funzioni che usano regex
- **code-review:** durante una review, usare `explain-regex` per comprendere pattern
  complessi e `optimize-regex` per suggerire miglioramenti

---

## Esempi di Utilizzo

### Costruire una regex per email con ancoraggio

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

### Testare una regex per date ISO

```json
{
  "tool": "test-regex",
  "arguments": {
    "pattern": "\\d{4}-\\d{2}-\\d{2}",
    "text": "Il progetto e' partito il 2024-01-15 e finira' il 2024-06-30",
    "flags": "g"
  }
}
```

### Spiegare un pattern complesso

```json
{
  "tool": "explain-regex",
  "arguments": {
    "pattern": "(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)"
  }
}
```

### Convertire un pattern da JavaScript a Python

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

## Sviluppi Futuri

- **Pattern builder visuale:** interfaccia guidata per costruire regex complesse passo passo
- **Libreria pattern estesa:** aggiungere pattern per codice fiscale italiano, partita IVA,
  IBAN, MAC address, JWT token
- **Benchmark regex:** misurare il tempo di esecuzione di un pattern su testi di varie
  dimensioni
- **Rilevamento ReDoS:** analisi avanzata per identificare pattern vulnerabili a
  Regular Expression Denial of Service
- **Supporto linguaggi aggiuntivi:** Rust, Java, C#, Ruby
- **Generazione codice:** produrre codice completo con validazione regex in ogni linguaggio
  supportato
