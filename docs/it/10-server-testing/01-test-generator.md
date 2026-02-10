# Test Generator Server

## Panoramica

Il server **test-generator** e' uno strumento MCP dedicato alla generazione automatica di
test unitari, all'identificazione di edge case e all'analisi della copertura del codice.
Rappresenta il punto di partenza per qualsiasi workflow di testing all'interno della
MCP Suite, permettendo di passare da codice sorgente a skeleton di test in pochi secondi.

Il server e' **stateless**: non possiede alcun database ne' store interno. Riceve codice
sorgente in input, lo analizza tramite parsing delle firme di funzione e restituisce
output strutturato senza mantenere stato tra le invocazioni.

```
+--------------------------------------------------------------------+
|                    test-generator server                           |
|                                                                    |
|  +--------------------+  +------------------+  +-----------------+ |
|  | generate-unit-tests|  | find-edge-cases  |  |analyze-coverage | |
|  |                    |  |                  |  |                 | |
|  | - parse funzioni   |  | - null/undefined |  | - estrai nomi   | |
|  | - genera describe  |  | - empty arrays   |  | - cerca test    | |
|  | - genera it blocks |  | - division by 0  |  | - calcola %     | |
|  +--------+-----------+  +--------+---------+  +-------+---------+ |
|           |                       |                     |          |
|           v                       v                     v          |
|      test:generated        (nessun evento)    test:coverage-report |
+--------------------------------------------------------------------+
```

**Versione:** 0.1.0
**Entry point:** `servers/test-generator/src/index.ts`
**Dipendenze:** `@mcp-suite/core`, `@mcp-suite/event-bus`

---

## Tabella dei Tool

| Tool | Descrizione | Parametri |
|------|-------------|-----------|
| `generate-unit-tests` | Genera skeleton di test unitari analizzando le firme delle funzioni nel codice sorgente | `code` (string, obbligatorio): codice sorgente da analizzare; `language` (string, default: `typescript`): linguaggio del sorgente; `framework` (string, default: `vitest`): framework di test (`vitest`, `jest`, `mocha`) |
| `find-edge-cases` | Analizza il codice e suggerisce edge case da testare, classificati per severita' | `code` (string, obbligatorio): codice della funzione da analizzare |
| `analyze-coverage` | Confronta funzioni nel sorgente con riferimenti nei test e calcola la percentuale di copertura | `sourceCode` (string, obbligatorio): codice sorgente contenente le funzioni; `testCode` (string, obbligatorio): codice dei test da verificare |

---

## Dettaglio dei Tool

### generate-unit-tests

Il tool esegue il parsing del codice sorgente cercando due pattern di dichiarazione:

- **Funzioni classiche:** `export (async) function name(params)`
- **Arrow function:** `export const name = (async) (params) =>`

Per ogni funzione trovata genera un blocco `describe/it` con tre test predefiniti:

1. Verifica che la funzione esista e sia callable
2. Test con input valido (placeholder per asserzioni specifiche)
3. Placeholder per edge case (null, undefined, boundary values)

```typescript
// Esempio di input
const code = `
export function calculateTotal(items: Item[], tax: number): number {
  return items.reduce((sum, item) => sum + item.price, 0) * (1 + tax);
}

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
};
`;

// Invocazione
{ tool: "generate-unit-tests", code, framework: "vitest" }
```

**Output generato:**
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

Esegue un'analisi statica del codice per identificare potenziali edge case. I controlli
eseguiti sono:

| Categoria | Severita' | Condizione di rilevamento |
|-----------|-----------|---------------------------|
| `null/undefined` | high | Presenza di parametri nelle funzioni |
| `empty-string` | high | Uso di `.length`, `.trim()`, `.split()`, `.includes()` |
| `whitespace-string` | medium | Idem come sopra |
| `special-characters` | medium | Idem come sopra |
| `empty-array` | high | Uso di `.map()`, `.filter()`, `.reduce()`, `.forEach()` |
| `single-element-array` | medium | Idem come sopra |
| `large-array` | low | Idem come sopra |
| `zero` | high | Uso di `parseInt`, `parseFloat`, `Number()`, `Math.*` |
| `negative-numbers` | high | Idem come sopra |
| `boundary-numbers` | medium | Idem come sopra |
| `division-by-zero` | high | Presenza dell'operatore `/` (esclude commenti) |
| `async-rejection` | high | Presenza di `async`, `await`, `Promise`, `.then()` |
| `async-timeout` | medium | Idem come sopra |
| `error-propagation` | high | Presenza di blocchi `try/catch` |
| `nested-null` | medium | Uso di `?.`, `\|\|`, `&&` |
| `regex-edge-cases` | medium | Uso di `RegExp`, `.match()`, `.test()` |
| `file-not-found` | high | Uso di `readFile`, `writeFile`, `fs.*` |
| `file-permissions` | medium | Idem come sopra |

L'output include un riepilogo con totale edge case trovati, distribuzione per severita'
e dettaglio per ogni caso identificato.

### analyze-coverage

Confronta il codice sorgente con il codice dei test per determinare quali funzioni
hanno copertura. Il processo e':

1. **Estrazione nomi funzione** dal sorgente (funzioni, arrow function, metodi di classe)
2. **Ricerca riferimenti** nei test: blocchi `describe()`, blocchi `it()/test()`,
   chiamate dirette alla funzione
3. **Calcolo percentuale:** `(funzioni coperte / totale funzioni) * 100`

```
  Sorgente                          Test
  +------------------+              +------------------+
  | function add()   |  ------>     | describe('add')  |  COPERTA
  | function sub()   |  ------>     | test('sub ...')  |  COPERTA
  | function mul()   |  --X         |                  |  SCOPERTA
  | function div()   |  --X         |                  |  SCOPERTA
  +------------------+              +------------------+

  Coverage: 2/4 = 50%
```

---

## Architettura

Il server segue un'architettura completamente stateless:

```
index.ts
  |
  +-- server.ts (createTestGeneratorServer)
        |
        +-- tools/generate-unit-tests.ts  --> parseFunctions() + generateTestCode()
        +-- tools/find-edge-cases.ts      --> analyzeEdgeCases()
        +-- tools/analyze-coverage.ts     --> extractFunctionNames() + findTestReferences()
```

Non esiste alcun servizio o store. Ogni tool riceve l'input, lo elabora in memoria
e restituisce il risultato. Questa scelta progettuale garantisce:

- **Nessuna dipendenza da database:** zero configurazione necessaria
- **Idempotenza:** lo stesso input produce sempre lo stesso output
- **Scalabilita':** nessun stato condiviso, nessun lock

---

## Integrazione Event Bus

### Eventi pubblicati

| Evento | Payload | Emesso da |
|--------|---------|-----------|
| `test:generated` | `{ filePath: string, testCount: number, framework: string }` | `generate-unit-tests` |
| `test:coverage-report` | `{ filePath: string, coverage: number, uncoveredLines: number[] }` | `analyze-coverage` |

### Eventi sottoscritti

Nessuno. Il server e' un puro produttore di eventi.

---

## Interazioni con altri Server

```
+-------------------+       test:generated        +-------------------+
| test-generator    | --------------------------> | standup-notes     |
|                   |                             | (futuro: auto-log)|
|                   |       test:coverage-report  +-------------------+
|                   | --------------------------> | agile-metrics     |
+-------------------+                             | (futuro: metriche)|
                                                  +-------------------+
```

- **agile-metrics:** potrebbe in futuro sottoscrivere `test:coverage-report` per
  includere metriche di copertura nelle analisi di sprint
- **standup-notes:** potrebbe registrare automaticamente i test generati come attivita'
  completata

---

## Esempi di Utilizzo

### Generare test per un modulo

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

### Trovare edge case in una funzione asincrona

```json
{
  "tool": "find-edge-cases",
  "arguments": {
    "code": "export async function fetchUser(id: string) { const res = await fetch(`/api/users/${id}`); return res.json(); }"
  }
}
```

Risultato atteso: edge case per `null/undefined`, `empty-string`, `async-rejection`,
`async-timeout`.

### Analizzare la copertura

```json
{
  "tool": "analyze-coverage",
  "arguments": {
    "sourceCode": "export function add(a, b) { return a + b; }\nexport function sub(a, b) { return a - b; }",
    "testCode": "describe('add', () => { it('should add', () => { expect(add(1,2)).toBe(3); }); });"
  }
}
```

Risultato: `coveragePercentage: 50`, `uncoveredFunctions: ["sub"]`.

---

## Sviluppi Futuri

- **Supporto multi-linguaggio:** estendere il parsing a Python, Go, Rust
- **Generazione test avanzati:** integrare i suggerimenti di `find-edge-cases` direttamente
  nei test generati da `generate-unit-tests`
- **Integrazione con file system:** leggere direttamente file sorgente e test da percorsi
  su disco, invece di richiedere il codice come stringa
- **Template personalizzabili:** permettere all'utente di definire template custom per
  i blocchi `describe/it`
- **Metriche storiche:** persistere i report di copertura per tracciare l'evoluzione
  nel tempo
- **Supporto property-based testing:** generare test basati su proprieta' con librerie
  come `fast-check`
