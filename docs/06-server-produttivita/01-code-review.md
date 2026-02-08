# Code Review Server

## Panoramica

Il server **code-review** fornisce strumenti di analisi statica del codice orientati al processo
di revisione. Il suo scopo principale e' risolvere un problema comune nei team di sviluppo:
la revisione manuale del codice e' lenta, soggettiva e spesso tralascia problemi ripetitivi
come statement di debug dimenticati, credenziali hardcoded o funzioni troppo complesse.

Questo server automatizza i controlli meccanici, permettendo ai revisori umani di concentrarsi
sulla logica di business e sulle scelte architetturali.

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

### Caratteristiche principali

- **Stateless**: nessuno store interno, ogni chiamata e' indipendente
- **Multi-linguaggio**: supporto per pattern specifici di Python, Rust, Java, TypeScript
- **Severity grading**: ogni problema e' classificato come `error`, `warning` o `info`
- **Nessuna dipendenza esterna**: tutta l'analisi avviene tramite regex e conteggio pattern

---

## Tabella dei Tool

| Tool | Descrizione | Parametri |
|------|-------------|-----------|
| `analyze-diff` | Analizza una stringa git diff per individuare problemi comuni nel codice aggiunto | `diff` (string) - La stringa git diff da analizzare |
| `check-complexity` | Calcola la complessita' ciclomatica di uno snippet di codice contando i punti di decisione | `code` (string) - Lo snippet di codice; `language` (string) - Il linguaggio di programmazione |
| `suggest-improvements` | Suggerisce miglioramenti su magic number, funzioni lunghe, nesting profondo, codice duplicato, variabili inutilizzate | `code` (string) - Lo snippet di codice; `language` (string) - Il linguaggio di programmazione |

---

## Architettura

Il server non possiede uno store ne' servizi interni. Ogni tool opera come una funzione pura
che riceve un input e produce un risultato JSON.

```
              Richiesta MCP
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

### Flusso dati di `analyze-diff`

1. La stringa diff viene divisa in righe
2. Si estraggono i nomi dei file modificati (`+++` headers)
3. Si parsano gli hunk headers per tracciare i numeri di riga
4. Ogni riga aggiunta (`+`) viene testata contro pattern di problemi:
   - `console.log/debug/info/warn/error/trace/dir` -> `console-statement` (warning)
   - `TODO/FIXME/HACK/XXX/TEMP` nei commenti -> `todo-comment` (info)
   - `debugger` statement -> `debugger-statement` (error)
   - `alert()` calls -> `alert-statement` (warning)
   - Password/secret/api_key/token hardcoded -> `hardcoded-credential` (error)
   - Catch block vuoti -> `empty-catch` (warning)
5. Si controllano blocchi consecutivi di oltre 50 righe aggiunte -> `large-addition` (info)

### Flusso dati di `check-complexity`

1. Il codice viene ripulito da commenti e stringhe (per evitare falsi positivi)
2. Si contano i pattern di decisione: `if`, `else if`, `for`, `while`, `case`, `catch`, `&&`, `||`, `?:`
3. Pattern specifici per linguaggio:
   - **Python**: `elif`, `except`, `and`, `or`
   - **Rust**: `match`, `=>`
4. La complessita' totale parte da 1 (percorso principale) + conteggio pattern
5. Rating: `<=5` bassa, `<=10` moderata, `<=20` alta, `>20` molto alta

### Flusso dati di `suggest-improvements`

1. Si eseguono 5 controlli indipendenti:
   - **Magic numbers**: numeri >= 2 cifre non in dichiarazioni const (esclude 0,1,2,10,100,1000,24,60,1024)
   - **Funzioni lunghe**: > 30 righe tramite conteggio parentesi graffe
   - **Nesting profondo**: > 4 livelli di parentesi graffe (deduplicato ogni 5 righe)
   - **Codice duplicato**: righe identiche (> 10 caratteri) che appaiono >= 3 volte
   - **Variabili inutilizzate**: variabili dichiarate ma referenziate una sola volta
2. I suggerimenti sono ordinati per severita': `high` > `medium` > `low`

---

## Integrazione Event Bus

### Eventi pubblicati

| Evento | Emesso da | Payload |
|--------|-----------|---------|
| `code:commit-analyzed` | `analyze-diff` | `{ commitHash, files, stats: { filesChanged, linesAdded, linesRemoved } }` |
| `code:review-completed` | `suggest-improvements` | `{ files, issues, suggestions }` |

### Eventi sottoscritti

Nessuno. Il server e' puramente reattivo alle chiamate tool.

---

## Interazioni con altri server

```
+------------------+     code:commit-analyzed       +-------------------+
|   code-review    | ---------------------------->  |   standup-notes   |
|                  |     code:review-completed      |   agile-metrics   |
+------------------+ ---------------------------->  +-------------------+

+------------------+                                +-------------------+
|  codebase-       |  (input per analisi modulo)    |   code-review     |
|  knowledge       | -----------------------------> |                   |
+------------------+                                +-------------------+
```

| Server collegato | Direzione | Descrizione |
|------------------|-----------|-------------|
| `standup-notes` | -> (via evento) | Riceve notifica delle analisi completate |
| `agile-metrics` | -> (via evento) | Puo' aggregare metriche di qualita' del codice |
| `codebase-knowledge` | <- (input) | Fornisce contesto su moduli e dipendenze |
| `dependency-manager` | collaborativo | Entrambi analizzano aspetti diversi della qualita' |

---

## Esempi di utilizzo

### Analisi di un diff

**Richiesta:**
```json
{
  "tool": "analyze-diff",
  "arguments": {
    "diff": "--- a/src/app.ts\n+++ b/src/app.ts\n@@ -10,3 +10,5 @@\n+console.log('debug');\n+const password = 'secret123';\n+debugger;"
  }
}
```

**Risposta (semplificata):**
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

### Controllo complessita'

**Richiesta:**
```json
{
  "tool": "check-complexity",
  "arguments": {
    "code": "function process(data) {\n  if (data.valid) {\n    for (const item of data.items) {\n      if (item.active && item.count > 0) {\n        switch(item.type) {\n          case 'A': break;\n          case 'B': break;\n        }\n      }\n    }\n  }\n}",
    "language": "javascript"
  }
}
```

**Risposta:**
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

### Suggerimenti di miglioramento

**Richiesta:**
```json
{
  "tool": "suggest-improvements",
  "arguments": {
    "code": "function calc(x) {\n  const result = x * 3.14159;\n  const temp = 42;\n  return result * 86400;\n}",
    "language": "typescript"
  }
}
```

**Risposta (semplificata):**
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

## Sviluppi futuri

- **Supporto file multipli**: analisi di interi commit invece di singoli diff
- **Regole personalizzabili**: file di configurazione `.code-review.json` per abilitare/disabilitare regole
- **Metriche storiche**: integrazione con il database per tracciare l'evoluzione della complessita'
- **Analisi di sicurezza avanzata**: pattern per SQL injection, XSS, path traversal
- **Integrazione CI/CD**: trigger automatico su ogni push tramite il server `cicd-monitor`
- **Pattern per linguaggi aggiuntivi**: Go, C#, PHP, Ruby
- **Soglie configurabili**: parametri per lunghezza funzione, profondita' nesting, conteggio duplicati
