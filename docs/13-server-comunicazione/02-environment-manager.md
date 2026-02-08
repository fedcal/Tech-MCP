# Environment Manager Server

## Panoramica

Il server **environment-manager** e' uno strumento specializzato per la gestione sicura
dei file `.env` e delle variabili di ambiente. Permette di esplorare, confrontare,
validare e generare template di file `.env` con un'attenzione particolare alla sicurezza:
i valori sensibili (password, token, chiavi API) vengono automaticamente mascherati
nell'output.

Il server e' **stateless**: non possiede database. Utilizza il servizio `env-parser` per
il parsing dei file `.env` con supporto per commenti, valori multilinea, valori quotati
e rilevamento automatico di segreti.

```
+------------------------------------------------------------------------+
|                   environment-manager server                           |
|                                                                        |
|  +------------------+ +---------------+ +---------------------+        |
|  |list-environments | |get-env-vars   | |compare-environments |        |
|  |                  | |               | |                     |        |
|  | trova .env*      | | parse .env    | | diff due .env       |        |
|  | ricorsivo        | | masking auto  | | solo in A / in B    |        |
|  +------------------+ +---------------+ | valori diversi      |        |
|                                         +---------------------+        |
|  +------------------+ +----------------------+                         |
|  |validate-env      | |generate-env-template |                         |
|  |                  | |                      |                         |
|  | confronta con    | | rimuove segreti      |                         |
|  | template (.env.  | | mantiene chiavi      |                         |
|  | example)         | | aggiunge placeholder |                         |
|  +------------------+ +----------------------+                         |
|                                                                        |
|  +-----------------------------------------------------------+         |
|  |              env-parser (servizio interno)                |         |
|  |                                                           |         |
|  |  Rileva segreti per nome chiave:                          |         |
|  |  SECRET, PASSWORD, PASSWD, KEY, TOKEN,                    |         |
|  |  API_KEY, PRIVATE, CREDENTIAL                             |         |
|  |                                                           |         |
|  |  Masking: "ab*****yz" (primi 2 + ultimi 2 caratteri)      |         |
|  +-----------------------------------------------------------+         |
|                                                                        |
|              Nessun evento -- Nessuno store -- Stateless               |
+------------------------------------------------------------------------+
```

**Versione:** 0.1.0
**Entry point:** `servers/environment-manager/src/index.ts`
**Dipendenze:** `@mcp-suite/core`, `@mcp-suite/event-bus`, `node:fs`, `node:path`

---

## Tabella dei Tool

| Tool | Descrizione | Parametri |
|------|-------------|-----------|
| `list-environments` | Trova tutti i file `.env*` in una directory (ricorsivo) | `directory` (string): percorso da esplorare |
| `get-env-vars` | Analizza un file `.env` e restituisce le variabili con masking dei segreti | `filePath` (string): percorso al file `.env` |
| `compare-environments` | Confronta due file `.env` mostrando differenze | `fileA` (string): primo file; `fileB` (string): secondo file |
| `validate-env` | Valida un file `.env` rispetto a un template | `envFile` (string): file da validare; `templateFile` (string): file template (.env.example) |
| `generate-env-template` | Genera un template `.env` rimuovendo i valori segreti | `sourceFile` (string): file sorgente; `outputFile` (string, opzionale): percorso output |

---

## Dettaglio dei Tool

### list-environments

Esplora ricorsivamente una directory cercando tutti i file che iniziano con `.env`:

```
  progetto/
  |-- .env                    <-- trovato
  |-- .env.local              <-- trovato
  |-- .env.production         <-- trovato
  |-- .env.example            <-- trovato
  |-- src/
  |   |-- .env.test           <-- trovato (ricorsivo)
  |-- docker/
      |-- .env.docker         <-- trovato (ricorsivo)
```

### get-env-vars

Analizza un file `.env` con il servizio `env-parser` e restituisce le variabili
con i valori segreti automaticamente mascherati.

**Input:**
```
# Database configuration
DB_HOST=localhost
DB_PORT=5432
DB_PASSWORD=SuperSecret123!
DB_NAME=myapp

# API Keys
STRIPE_SECRET_KEY=sk_live_abc123xyz789
STRIPE_PUBLIC_KEY=pk_live_def456
JWT_TOKEN=eyJhbGciOiJIUzI1NiJ9.payload.signature
```

**Output** (valori segreti mascherati automaticamente):
```json
{
  "variables": [
    { "key": "DB_HOST", "value": "localhost", "isSecret": false },
    { "key": "DB_PASSWORD", "value": "Su***********3!", "isSecret": true },
    { "key": "STRIPE_SECRET_KEY", "value": "sk***********89", "isSecret": true },
    { "key": "JWT_TOKEN", "value": "ey***********re", "isSecret": true }
  ]
}
```

### compare-environments

Confronta due file `.env` e produce un report con tre sezioni:

```
  .env.development vs .env.production:
  +--------------------------------------------------+
  | Solo in A:        DEBUG=true                     |
  | Solo in B:        REDIS_URL=redis://...          |
  | Valori diversi:   DB_HOST, DB_PASSWORD           |
  | Identici:         DB_PORT=5432                   |
  +--------------------------------------------------+
```

### validate-env

Confronta un file `.env` con un template (es. `.env.example`) per verificare che
tutte le chiavi richieste siano presenti:

```
  Confronto .env.example vs .env:
  DB_HOST: OK | DB_PORT: OK | DB_PASSWORD: MANCANTE
  REDIS_URL: MANCANTE | API_KEY: OK
  Risultato: 2 variabili mancanti (DB_PASSWORD, REDIS_URL)
```

### generate-env-template

Genera un file template a partire da un `.env` esistente: mantiene tutte le chiavi,
rimuove i valori segreti (sostituiti con stringa vuota), preserva valori non sensibili
e commenti. Esempio:

**Output (.env.example):**
```
DB_HOST=localhost
DB_PASSWORD=
API_KEY=
PORT=3000
```

---

## Architettura

```
index.ts
  |
  +-- server.ts (createEnvironmentManagerServer)
  |     |
  |     +-- registra 5 tool
  |
  +-- services/
  |     +-- env-parser.ts  --> parseEnvFile(), parseEnvFileWithMasking()
  |                            isSecretKey(), maskValue()
  |
  +-- tools/
        +-- list-environments.ts
        +-- get-env-vars.ts
        +-- compare-environments.ts
        +-- validate-env.ts
        +-- generate-env-template.ts
```

### Servizio env-parser

Il servizio `env-parser` e' il cuore del server. Gestisce:

**Rilevamento segreti per nome chiave:**

I pattern rilevati come sensibili sono:
| Pattern | Esempio di chiave |
|---------|------------------|
| `SECRET` | `JWT_SECRET`, `APP_SECRET` |
| `PASSWORD` | `DB_PASSWORD`, `ADMIN_PASSWORD` |
| `PASSWD` | `FTP_PASSWD` |
| `KEY` | `API_KEY`, `ENCRYPTION_KEY` |
| `TOKEN` | `AUTH_TOKEN`, `JWT_TOKEN` |
| `API_KEY` | `STRIPE_API_KEY` |
| `PRIVATE` | `PRIVATE_KEY`, `SSH_PRIVATE` |
| `CREDENTIAL` | `AWS_CREDENTIAL` |

Il confronto e' case-insensitive (`key.toUpperCase().includes(pattern)`).

**Algoritmo di masking:**

```
  Input: "SuperSecret123!"  (15 caratteri)

  Se length <= 5:  "*****"  (completamente mascherato)
  Se length > 5:   "Su" + "***********" + "3!"
                   (primi 2) + (*  per length-4) + (ultimi 2)
```

**Parsing del file .env:**

Il parser gestisce:
- Righe vuote (ignorate)
- Commenti (`#` all'inizio della riga)
- Formato `KEY=VALUE`
- Valori quotati (singoli o doppi apici)
- Valori multilinea (apici non chiusi sulla stessa riga)
- Commenti inline (`VALUE # commento`) solo per valori non quotati

---

## Integrazione Event Bus

Il server **non pubblica** e **non sottoscrive** alcun evento. Opera in completo
isolamento per ragioni di sicurezza: le variabili di ambiente non dovrebbero transitare
attraverso canali di comunicazione inter-server.

---

## Interazioni con altri Server

```
+------------------+                         +---------------------+
| http-client      | ---- (manuale) ------>  | environment-manager |
| (usa URL/token   |                         | (fornisce valori    |
|  dagli ambienti) |                         |  .env per richieste)|
+------------------+                         +---------------------+
        ^                                           |
        |                                           v
+------------------+                         +------------------+
| docker-compose   |                         | project-         |
| (verifica env    |                         | scaffolding      |
|  per container)  |                         | (genera .env.    |
+------------------+                         |  example)        |
                                             +------------------+
```

Le interazioni sono manuali (l'utente invoca i tool in sequenza):

- **http-client:** ottenere URL e token dagli `.env` per usarli nelle richieste
- **docker-compose:** verificare che i file `.env` dei container siano corretti
- **project-scaffolding:** generare `.env.example` come parte del setup di un nuovo progetto

---

## Esempi di Utilizzo

### Esplorare gli ambienti di un progetto

```json
{ "tool": "list-environments", "arguments": { "directory": "/home/user/progetto" } }
```

### Confrontare staging e production

```json
{
  "tool": "compare-environments",
  "arguments": {
    "fileA": "/home/user/progetto/.env.staging",
    "fileB": "/home/user/progetto/.env.production"
  }
}
```

### Validare e generare template

```json
// Validare contro template
{ "tool": "validate-env", "arguments": { "envFile": ".env", "templateFile": ".env.example" } }

// Generare template sicuro (commitabile nel repository)
{ "tool": "generate-env-template", "arguments": { "sourceFile": ".env" } }
```

---

## Sicurezza

- **Masking automatico:** tutti i valori sensibili sono mascherati per default
- **Rilevamento proattivo:** identifica segreti basandosi sul nome della chiave
- **Template generation sicura:** rimuove automaticamente tutti i valori segreti
- **Nessun evento:** le variabili di ambiente non transitano mai attraverso l'Event Bus
- **Nessuna persistenza:** i dati non vengono mai salvati in database

---

## Sviluppi Futuri

- **Cifratura segreti:** supporto per valori cifrati con chiave simmetrica
- **Validazione tipi:** verificare che i valori corrispondano al tipo atteso
- **Integrazione vault:** connessione a HashiCorp Vault o AWS Secrets Manager
- **Rotazione segreti:** suggerire segreti che non sono stati cambiati da tempo
- **Docker compose integration:** verificare che le variabili nel `docker-compose.yml`
  esistano nei file `.env`
- **Schema validation:** supportare file `.env.schema` con tipi e vincoli
