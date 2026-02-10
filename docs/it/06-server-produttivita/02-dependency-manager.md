# Dependency Manager Server

## Panoramica

Il server **dependency-manager** e' dedicato alla gestione e all'analisi delle dipendenze
di un progetto Node.js. Risolve tre problemi critici nello sviluppo software moderno:

1. **Vulnerabilita' di sicurezza**: le dipendenze possono contenere falle note (CVE)
   che espongono l'applicazione a rischi
2. **Dipendenze inutilizzate**: packages dichiarati in `package.json` ma mai importati
   aumentano la dimensione del bundle e la superficie di attacco
3. **Incompatibilita' di licenza**: licenze copyleft (GPL, AGPL) possono imporre
   restrizioni indesiderate sulla distribuzione del software

```
+--------------------------------------------------------+
|            dependency-manager server                   |
|                                                        |
|  +---------------------------------------------------+ |
|  |                Tool Layer                         | |
|  |                                                   | |
|  |  check-vulnerabilities  find-unused               | |
|  |  license-audit                                    | |
|  +---------------------------------------------------+ |
|            |                       |                   |
|            v                       v                   |
|  +------------------+   +----------------------+       |
|  | child_process    |   | fs (node_modules)    |       |
|  | execSync         |   | readFileSync         |       |
|  | (npm audit)      |   |                      |       |
|  +------------------+   +----------------------+       |
|            |                                           |
|            v                                           |
|  +---------------------------------------------------+ |
|  |   Event Bus: code:dependency-alert                | |
|  +---------------------------------------------------+ |
+--------------------------------------------------------+
```

### Caratteristiche principali

- **Integrazione npm audit**: wrapper attorno a `npm audit --json` con parsing strutturato
- **Scansione import**: analisi ricorsiva dei file sorgente per trovare dipendenze inutilizzate
- **Audit licenze**: lettura diretta dei `package.json` in `node_modules`
- **Alert automatici**: pubblicazione eventi per vulnerabilita' critiche/alte

---

## Tabella dei Tool

| Tool | Descrizione | Parametri |
|------|-------------|-----------|
| `check-vulnerabilities` | Esegue `npm audit --json` e raggruppa le vulnerabilita' per severita' | `projectPath` (string) - Percorso assoluto alla directory del progetto |
| `find-unused` | Analizza gli import nei file sorgente per trovare dipendenze non utilizzate | `projectPath` (string) - Percorso assoluto alla directory del progetto |
| `license-audit` | Legge le licenze di ogni dipendenza da `node_modules` e segnala le copyleft | `projectPath` (string) - Percorso assoluto alla directory del progetto |

---

## Architettura

Il server e' stateless e non possiede servizi interni. Ogni tool lavora direttamente
con il filesystem e con processi child.

```
  projectPath
      |
      +-- package.json  <--- letto da tutti e 3 i tool
      |
      +-- node_modules/ <--- letto da license-audit
      |     +-- pkg-a/
      |     |     +-- package.json (campo "license")
      |     +-- pkg-b/
      |           +-- package.json
      |
      +-- src/           <--- scansionato da find-unused
            +-- index.ts
            +-- app.ts
            +-- utils/
```

### Flusso di `check-vulnerabilities`

1. Verifica esistenza di `package.json` nel percorso indicato
2. Esegue `npm audit --json` con timeout di 60 secondi
3. Gestisce il codice di uscita non-zero (npm audit esce con errore se trova vulnerabilita')
4. Parsa l'output JSON nel formato npm v7+
5. Raggruppa per severita': `critical`, `high`, `moderate`, `low`, `info`
6. Per ogni vulnerabilita' critica/alta, pubblica evento `code:dependency-alert`

### Flusso di `find-unused`

1. Legge `dependencies` e `devDependencies` da `package.json`
2. Raccoglie ricorsivamente tutti i file `.ts`, `.js`, `.tsx`, `.jsx`
3. Salta le directory: `node_modules`, `dist`, `build`, `.git`, `coverage`
4. Estrae i nomi dei pacchetti da:
   - Import ES modules: `import ... from 'package'`
   - CommonJS: `require('package')`
   - Import dinamici: `import('package')`
5. Gestisce i pacchetti scoped: `@scope/package`
6. Confronta le dipendenze dichiarate con quelle importate
7. Riporta separatamente `unusedDependencies` e `unusedDevDependencies`

### Flusso di `license-audit`

1. Legge tutte le dipendenze da `package.json`
2. Per ogni dipendenza, legge il `package.json` in `node_modules/<dep>/`
3. Estrae il campo `license` (stringa, oggetto `{type, url}`, o array legacy `licenses`)
4. Confronta con la lista di licenze copyleft:
   - GPL (2.0, 3.0, -only, -or-later)
   - AGPL (1.0, 3.0)
   - LGPL (2.0, 2.1, 3.0)
   - MPL-2.0, EUPL, CPAL-1.0, OSL-3.0, CC-BY-SA-4.0
5. Raggruppa le dipendenze per tipo di licenza
6. Segnala separatamente le dipendenze con licenza copyleft

---

## Integrazione Event Bus

### Eventi pubblicati

| Evento | Emesso da | Payload | Condizione |
|--------|-----------|---------|------------|
| `code:dependency-alert` | `check-vulnerabilities` | `{ package, severity, advisory }` | Per ogni vulnerabilita' con severity `critical` o `high` |

### Eventi sottoscritti

Nessuno.

---

## Interazioni con altri server

```
+---------------------+    code:dependency-alert    +-------------------+
| dependency-manager  | --------------------------> | standup-notes     |
|                     |                             | agile-metrics     |
+---------------------+                             +-------------------+
         ^
         |  (input: projectPath)
         |
+---------------------+
| project-scaffolding |  genera progetti con dipendenze che
|                     |  dependency-manager puo' poi analizzare
+---------------------+
```

| Server collegato | Direzione | Descrizione |
|------------------|-----------|-------------|
| `standup-notes` | -> (via evento) | Riceve alert su vulnerabilita' critiche |
| `agile-metrics` | -> (via evento) | Puo' tracciare il trend delle vulnerabilita' |
| `project-scaffolding` | complementare | I progetti generati possono essere analizzati |
| `code-review` | complementare | Entrambi valutano aspetti di qualita' del codice |

---

## Esempi di utilizzo

### Controllo vulnerabilita'

**Richiesta:**
```json
{
  "tool": "check-vulnerabilities",
  "arguments": {
    "projectPath": "/home/user/my-project"
  }
}
```

**Risposta (semplificata):**
```json
{
  "project": "my-project",
  "totalVulnerabilities": 5,
  "severityCounts": {
    "high": 2,
    "moderate": 2,
    "low": 1
  },
  "vulnerabilities": {
    "high": [
      {
        "name": "lodash",
        "severity": "high",
        "title": "Prototype Pollution",
        "url": "https://github.com/advisories/GHSA-xxxx",
        "range": "<4.17.21",
        "fixAvailable": { "name": "lodash", "version": "4.17.21" }
      }
    ]
  },
  "metadata": {
    "totalDependencies": 142,
    "devDependencies": 38,
    "prodDependencies": 104
  }
}
```

### Ricerca dipendenze inutilizzate

**Richiesta:**
```json
{
  "tool": "find-unused",
  "arguments": {
    "projectPath": "/home/user/my-project"
  }
}
```

**Risposta:**
```json
{
  "project": "my-project",
  "sourceFilesScanned": 47,
  "summary": {
    "totalDependencies": 12,
    "totalDevDependencies": 8,
    "unusedDependencies": 2,
    "unusedDevDependencies": 1
  },
  "unusedDependencies": ["moment", "lodash"],
  "unusedDevDependencies": ["@types/lodash"],
  "note": "Dependencies may be used in config files, scripts, or other non-source files."
}
```

### Audit licenze

**Richiesta:**
```json
{
  "tool": "license-audit",
  "arguments": {
    "projectPath": "/home/user/my-project"
  }
}
```

**Risposta (semplificata):**
```json
{
  "project": "my-project",
  "summary": {
    "totalDependenciesChecked": 20,
    "uniqueLicenses": 4,
    "copyleftCount": 1,
    "notFoundInNodeModules": 0
  },
  "copyleftWarnings": [
    { "name": "some-gpl-lib", "version": "2.1.0", "license": "GPL-3.0" }
  ],
  "byLicense": {
    "MIT": [{ "name": "express", "version": "4.21.0" }],
    "ISC": [{ "name": "glob", "version": "10.3.0" }],
    "GPL-3.0": [{ "name": "some-gpl-lib", "version": "2.1.0" }]
  }
}
```

---

## Sviluppi futuri

- **Supporto pnpm/yarn**: analisi dei lockfile specifici oltre a npm
- **Aggiornamenti automatici**: suggerimento di versioni aggiornate per dipendenze obsolete
- **Policy di licenza configurabile**: file `.license-policy.json` per definire licenze accettate/rifiutate
- **Cache risultati audit**: evitare chiamate ripetute a npm audit per lo stesso progetto
- **Scansione profonda**: analisi degli import transitivi (dipendenze di dipendenze)
- **Integrazione con `cicd-monitor`**: trigger automatico dell'audit su ogni build
- **Report PDF/HTML**: generazione di report formattati per stakeholder non tecnici
- **Supporto monorepo**: analisi coordinata di workspace pnpm/npm
