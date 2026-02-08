# Data Mock Generator Server

## Panoramica

Il server **data-mock-generator** genera dati fittizi realistici per testing, sviluppo
e prototipazione. Risolve un problema comune: per testare un'applicazione servono
dati che assomiglino a quelli reali, ma crearli manualmente e' tedioso e non scalabile.

Questo server offre 16 tipi di generatore, supporta output in JSON e CSV,
e non ha dipendenze esterne per la generazione dei dati: utilizza esclusivamente
`Math.random()` e `crypto.randomUUID()`.

```
+------------------------------------------------------------+
|            data-mock-generator server                      |
|                                                            |
|  +-------------------------------------------------------+ |
|  |                       Tool Layer                      | |
|  |                                                       | |
|  |         generate-mock-data    generate-json           | |
|  |         generate-csv          list-generators         | |
|  +-------------------------------------------------------+ |
|                         |                                  |
|                         v                                  |
|  +-------------------------------------------------------+ |
|  |          services/generators.ts                       | |
|  |                                                       | |
|  |  16 generatori:                                       | |
|  |  firstName, lastName, email, phone, address,          | |
|  |  company, date, integer, float, boolean,              | |
|  |  uuid, sentence, paragraph, url, ipv4, hexColor       | |
|  |                                                       | |
|  |  Nessuna dipendenza esterna:                          | |
|  |  Math.random() + crypto.randomUUID()                  | |
|  +-------------------------------------------------------+ |
+------------------------------------------------------------+
```

### Caratteristiche principali

- **16 generatori built-in**: coprono i tipi di dato piu' comuni
- **Tre formati di output**: JSON array, JSON Schema-based, CSV
- **Nessuna dipendenza esterna**: generazione interamente interna
- **Limiti di sicurezza**: massimo 10.000 righe per chiamata
- **CSV con escaping**: gestione corretta di delimitatori, virgolette e newline

---

## Tabella dei Tool

| Tool | Descrizione | Parametri |
|------|-------------|-----------|
| `generate-mock-data` | Genera righe di dati basate su uno schema di field/type | `schema` (array di {field, type}); `count` (number, 1-10000, default: 10) |
| `generate-json` | Genera oggetti JSON da un JSON Schema con properties e format hint | `jsonSchema` (object con properties); `count` (number, 1-10000, default: 10) |
| `generate-csv` | Genera dati in formato CSV con header e delimitatore configurabile | `columns` (array di {name, type}); `count` (number, 1-10000, default: 10); `delimiter` (string, default: ",") |
| `list-generators` | Elenca tutti i tipi di generatore disponibili con descrizione | Nessuno |

---

## Architettura

### Service Layer: generators.ts

Il file `services/generators.ts` contiene:

- **Dataset di base**: array di nomi, cognomi, strade, citta', aziende, parole lorem, domini
- **16 funzioni generatore**: ognuna restituisce `string | number | boolean`
- **Registry**: `Record<string, GeneratorInfo>` con nome, descrizione e funzione
- **Lookup**: `getGenerator(name)` per ottenere la funzione da un nome stringa

### Tabella dei 16 generatori

| Nome | Tipo output | Descrizione | Esempio |
|------|------------|-------------|---------|
| `firstName` | string | Nome casuale da pool di 40 | `"Jennifer"` |
| `lastName` | string | Cognome casuale da pool di 40 | `"Martinez"` |
| `email` | string | Email combinando nome+cognome+dominio | `"jennifer_martinez42@example.com"` |
| `phone` | string | Telefono US formato (XXX) XXX-XXXX | `"(415) 555-1234"` |
| `address` | string | Indirizzo: numero + via + citta' | `"4521 Oak Ave, Seattle"` |
| `company` | string | Nome azienda da pool di 20 | `"Stark Industries"` |
| `date` | string | Data YYYY-MM-DD tra 2000 e 2025 | `"2018-07-23"` |
| `integer` | number | Intero tra 0 e 10000 | `4287` |
| `float` | number | Decimale con 2 cifre, 0-10000 | `3456.78` |
| `boolean` | boolean | true o false (50/50) | `true` |
| `uuid` | string | UUID v4 via crypto.randomUUID() | `"550e8400-e29b-..."` |
| `sentence` | string | Frase lorem ipsum 5-15 parole | `"Lorem ipsum dolor sit amet."` |
| `paragraph` | string | Paragrafo di 3-7 frasi lorem | `"Lorem ipsum... Dolor sit..."` |
| `url` | string | URL con protocollo, dominio e path | `"https://app.demo.io/docs"` |
| `ipv4` | string | Indirizzo IP v4 valido | `"192.168.42.1"` |
| `hexColor` | string | Colore esadecimale con # | `"#a3f2c1"` |

### Flusso di generate-mock-data

```
  schema: [{ field: "name", type: "firstName" },
           { field: "age",  type: "integer" }]
  count: 3
       |
       v
  Validazione tipi: getGenerator(type) per ogni campo
       |
       v
  Per ogni riga (0..count-1):
    Per ogni campo:
      row[field] = generator()
       |
       v
  Output: [
    { "name": "James", "age": 4521 },
    { "name": "Linda", "age": 892 },
    { "name": "Robert", "age": 7103 }
  ]
```

### Flusso di generate-json (JSON Schema)

```
  jsonSchema: {
    properties: {
      id:    { type: "string", format: "uuid" },
      email: { type: "string", format: "email" },
      score: { type: "number" }
    }
  }
       |
       v
  Per ogni property: resolveGenerator(prop)
    1. Controlla prop.format -> getGenerator(format)
    2. Mappa formati noti: email, uri, uuid, ipv4, date, ...
    3. Fallback su prop.type: string->sentence, number->float,
       integer->integer, boolean->boolean
       |
       v
  Generazione righe come generate-mock-data
```

### Flusso di generate-csv

```
  columns: [{ name: "Nome", type: "firstName" },
            { name: "Email", type: "email" }]
  delimiter: ";"
       |
       v
  Header: escapeCsvField("Nome", ";") + ";" + escapeCsvField("Email", ";")
       |
       v
  Per ogni riga:
    value = String(generator())
    escapeCsvField(value, delimiter):
      - Se contiene delimiter, '"' o '\n':
        wrap in "" e raddoppia le virgolette interne
      - Altrimenti: valore come stringa
       |
       v
  Output:
    Nome;Email
    James;james_smith@example.com
    Linda;linda.johnson42@test.org
```

---

## Integrazione Event Bus

Questo server **non pubblica ne' sottoscrive eventi**. E' un server puramente
generativo senza side-effect.

---

## Interazioni con altri server

| Server collegato | Direzione | Descrizione |
|------------------|-----------|-------------|
| `db-schema-explorer` | complementare | Lo schema esplorato guida la definizione dello schema per i mock data |
| `test-generator` | complementare | I dati mock possono essere usati come fixture per i test generati |
| `api-documentation` | complementare | Esempi di request/response possono usare dati mock |
| `http-client` | complementare | I dati generati possono essere inviati come body di richieste HTTP |

---

## Esempi di utilizzo

### Generazione dati da schema

**Richiesta:**
```json
{
  "tool": "generate-mock-data",
  "arguments": {
    "schema": [
      { "field": "id", "type": "uuid" },
      { "field": "name", "type": "firstName" },
      { "field": "surname", "type": "lastName" },
      { "field": "email", "type": "email" },
      { "field": "active", "type": "boolean" }
    ],
    "count": 3
  }
}
```

**Risposta:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Jennifer",
    "surname": "Martinez",
    "email": "jennifer.martinez@example.com",
    "active": true
  },
  {
    "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "name": "Robert",
    "surname": "Smith",
    "email": "robert_smith42@test.org",
    "active": false
  }
]
```

### Generazione da JSON Schema

**Richiesta:**
```json
{
  "tool": "generate-json",
  "arguments": {
    "jsonSchema": {
      "properties": {
        "userId": { "type": "string", "format": "uuid" },
        "email": { "type": "string", "format": "email" },
        "registeredAt": { "type": "string", "format": "date" },
        "score": { "type": "integer" }
      }
    },
    "count": 2
  }
}
```

**Risposta:**
```json
[
  { "userId": "abc-123-...", "email": "james.lee@mock.dev", "registeredAt": "2019-03-15", "score": 7842 },
  { "userId": "def-456-...", "email": "mary_white@demo.net", "registeredAt": "2022-11-08", "score": 1256 }
]
```

### Generazione CSV

**Richiesta:**
```json
{
  "tool": "generate-csv",
  "arguments": {
    "columns": [
      { "name": "Nome", "type": "firstName" },
      { "name": "Cognome", "type": "lastName" },
      { "name": "IP", "type": "ipv4" }
    ],
    "count": 3,
    "delimiter": ";"
  }
}
```

**Risposta:**
```
Nome;Cognome;IP
James;Smith;192.168.1.42
Linda;Johnson;10.0.0.15
Robert;Williams;172.16.5.200
```

### Lista generatori

**Richiesta:**
```json
{
  "tool": "list-generators",
  "arguments": {}
}
```

**Risposta (parziale):**
```json
[
  { "name": "firstName", "description": "Generates a random first name" },
  { "name": "lastName", "description": "Generates a random last name" },
  { "name": "email", "description": "Generates a random email address" },
  { "name": "uuid", "description": "Generates a random UUID v4 using crypto.randomUUID()" }
]
```

---

## Sviluppi futuri

- **Generatori personalizzati**: definizione di generatori custom con pattern regex
- **Relazioni tra campi**: email basata sul firstName+lastName della stessa riga
- **Locale/i18n**: nomi, indirizzi e formati specifici per paese (IT, DE, FR, etc.)
- **Generazione SQL INSERT**: output diretto come statement SQL
- **Seed deterministico**: parametro `seed` per generazione riproducibile
- **Vincoli di unicita'**: garanzia che certi campi (email, uuid) non si ripetano
- **Range configurabili**: min/max per integer e float, date range personalizzato
- **Template di schema**: schema predefiniti per utenti, prodotti, ordini, etc.
