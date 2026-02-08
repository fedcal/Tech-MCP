# Docker Compose Server

## Panoramica

Il server **docker-compose** fornisce strumenti per la gestione degli stack Docker Compose:
parsing, analisi, monitoraggio e generazione di configurazioni. Risolve il problema della
complessita' crescente dei file `docker-compose.yml` e dei `Dockerfile`, dove errori di
configurazione, bad practice e mancanza di standardizzazione possono causare problemi
in produzione.

```
+------------------------------------------------------------+
|               docker-compose server                        |
|                                                            |
|  +-------------------------------------------------------+ |
|  |                  Tool Layer                           | |
|  |                                                       | |
|  |  parse-compose     analyze-dockerfile                 | |
|  |  list-services     generate-compose                   | |
|  +-------------------------------------------------------+ |
|        |                                    |              |
|        v                                    v              |
|  +------------+                    +------------------+    |
|  | fs         |                    | child_process    |    |
|  | readFile   |                    | execSync         |    |
|  | (YAML/     |                    | (docker compose  |    |
|  |  Docker)   |                    |  ps --format     |    |
|  +------------+                    |  json)           |    |
|                                    +------------------+    |
+------------------------------------------------------------+
```

### Caratteristiche principali

- **Parser YAML semplificato**: analisi line-based senza dipendenze esterne
- **Validazione best practice**: regole per Dockerfile e docker-compose.yml
- **Monitoraggio runtime**: lista servizi in esecuzione via `docker compose ps`
- **Generazione YAML**: creazione docker-compose.yml da definizioni strutturate
- **Nessun evento**: server stateless senza integrazione Event Bus

---

## Tabella dei Tool

| Tool | Descrizione | Parametri |
|------|-------------|-----------|
| `parse-compose` | Parsa e valida un file docker-compose.yml, estraendo servizi, network, volumi e problemi | `filePath` (string) - Percorso al file docker-compose.yml |
| `analyze-dockerfile` | Analizza un Dockerfile per best practice, sicurezza e ottimizzazione | `filePath` (string) - Percorso al Dockerfile |
| `list-services` | Elenca i servizi Docker in esecuzione, opzionalmente filtrati per progetto Compose | `composePath?` (string) - Percorso opzionale al docker-compose.yml |
| `generate-compose` | Genera un file docker-compose.yml da un array di definizioni di servizi | `services` (array) - Array di oggetti servizio con name, image, ports, environment, volumes |

---

## Architettura

### parse-compose: Parser YAML line-based

Il parser non dipende da librerie YAML esterne. Analizza il file riga per riga:

```
  docker-compose.yml
        |
        v
  +------------------+
  | Line-by-line     |
  | parser           |
  +------------------+
        |
        +-- Sezioni top-level: services, networks, volumes
        |
        +-- Per ogni servizio:
        |     +-- Proprieta': image, build, ports, environment, volumes
        |     +-- Validazione:
        |           +-- image senza tag specifico?
        |           +-- privileged: true?
        |           +-- network_mode: host?
        |           +-- missing image AND build?
        |
        +-- Validazione globale:
              +-- "version" deprecato
              +-- Nessun servizio trovato
```

### analyze-dockerfile: Regole di analisi

Il tool controlla le seguenti best practice:

| Regola | Severita' | Descrizione |
|--------|-----------|-------------|
| `no-latest-tag` | warning | Immagine base con tag `:latest` |
| `no-tag` | warning | Immagine base senza tag esplicito |
| `large-base-image` | info | Uso di distribuzioni complete (ubuntu, debian, centos, etc.) |
| `consecutive-run` | warning | Istruzioni RUN consecutive (aumentano i layer) |
| `apt-no-recommends` | info | `apt-get install` senza `--no-install-recommends` |
| `apt-update-alone` | warning | `apt-get update` senza `apt-get install` nello stesso RUN |
| `pipe-to-shell` | warning | Download con curl/wget piped a shell |
| `use-copy-over-add` | info | ADD usato dove COPY basterebbe |
| `missing-healthcheck` | info | Nessuna istruzione HEALTHCHECK |
| `running-as-root` | warning | Nessuna istruzione USER (container eseguito come root) |

### list-services: Monitoraggio runtime

```
  composePath (opzionale)
        |
        v
  +------------------+         +------------------+
  | docker compose   |  fail   | docker-compose   |
  | ps --format json | ------> | ps --format json |
  +------------------+         +------------------+
        |                             |
        +----------+------------------+
                   |
                   v
            Parse JSON lines
                   |
                   v
            ServiceInfo[]
            { name, status, image, ports }
```

### generate-compose: Generatore YAML

```
  ServiceDefinition[]              docker-compose.yml
  +------------------+             +--------------------+
  | name: "web"      |             | services:          |
  | image: "nginx"   |  -------->  |   web:             |
  | ports: ["80:80"] |             |     image: nginx   |
  | environment: {}  |             |     ports:         |
  | volumes: [...]   |             |       - "80:80"    |
  +------------------+             |     restart: ...   |
                                   |                    |
                                   | volumes:           |
                                   |   data_vol:        |
                                   +--------------------+
```

Il generatore:
- Aggiunge automaticamente `restart: unless-stopped` a ogni servizio
- Rileva i named volume (non bind mount) e li dichiara nella sezione `volumes:`
- Gestisce l'indentazione YAML corretta a 2 spazi

---

## Integrazione Event Bus

Questo server **non pubblica ne' sottoscrive eventi**. Tutte le operazioni sono
a richiesta e senza side-effect sull'Event Bus.

---

## Interazioni con altri server

| Server collegato | Direzione | Descrizione |
|------------------|-----------|-------------|
| `log-analyzer` | complementare | Analisi dei log dei container Docker |
| `cicd-monitor` | complementare | Monitoraggio pipeline che includono build Docker |
| `environment-manager` | complementare | Gestione variabili d'ambiente usate nei servizi Docker |
| `project-scaffolding` | complementare | Template possono includere Dockerfile e docker-compose.yml |

---

## Esempi di utilizzo

### Parsing docker-compose.yml

**Richiesta:**
```json
{
  "tool": "parse-compose",
  "arguments": {
    "filePath": "/home/user/project/docker-compose.yml"
  }
}
```

**Risposta (semplificata):**
```json
{
  "filePath": "/home/user/project/docker-compose.yml",
  "services": ["web", "db", "redis"],
  "serviceCount": 3,
  "networks": ["backend"],
  "volumes": ["db_data"],
  "validationIssues": [
    "Service \"web\" uses image \"nginx\" without a specific tag."
  ],
  "hasIssues": true
}
```

### Analisi Dockerfile

**Richiesta:**
```json
{
  "tool": "analyze-dockerfile",
  "arguments": {
    "filePath": "/home/user/project/Dockerfile"
  }
}
```

**Risposta:**
```json
{
  "filePath": "/home/user/project/Dockerfile",
  "baseImage": "node:latest",
  "stages": 1,
  "totalInstructions": 12,
  "issues": [
    {
      "line": 1, "severity": "warning", "rule": "no-latest-tag",
      "message": "Base image \"node:latest\" uses the :latest tag.",
      "suggestion": "Pin to a specific version tag (e.g., node:20-alpine)."
    },
    {
      "line": 0, "severity": "warning", "rule": "running-as-root",
      "message": "No USER instruction found.",
      "suggestion": "Add a USER instruction to run as non-root."
    }
  ],
  "summary": { "errors": 0, "warnings": 2, "info": 1 }
}
```

### Generazione docker-compose.yml

**Richiesta:**
```json
{
  "tool": "generate-compose",
  "arguments": {
    "services": [
      {
        "name": "api",
        "image": "node:20-alpine",
        "ports": ["3000:3000"],
        "environment": { "NODE_ENV": "production" },
        "volumes": ["./src:/app/src"]
      },
      {
        "name": "postgres",
        "image": "postgres:16-alpine",
        "ports": ["5432:5432"],
        "environment": { "POSTGRES_PASSWORD": "secret" },
        "volumes": ["pg_data:/var/lib/postgresql/data"]
      }
    ]
  }
}
```

**Risposta:**
```yaml
services:
  api:
    image: node:20-alpine
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: "production"
    volumes:
      - ./src:/app/src
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: "secret"
    volumes:
      - pg_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  pg_data:
```

---

## Sviluppi futuri

- **Supporto Docker Swarm**: parsing e generazione di configurazioni Swarm
- **Validazione network**: verifica che i servizi referenzino network esistenti
- **Multi-stage Dockerfile analysis**: analisi avanzata di build multi-stage
- **Docker image size estimation**: stima delle dimensioni dell'immagine risultante
- **Template Compose**: template predefiniti per stack comuni (LAMP, MEAN, etc.)
- **Integrazione Event Bus**: eventi per container start/stop/crash
- **Compose diff**: confronto tra due versioni di docker-compose.yml
