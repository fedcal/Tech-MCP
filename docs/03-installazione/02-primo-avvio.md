# Primo Avvio

## Introduzione

Dopo aver completato l'installazione e la compilazione (`pnpm build`), e possibile avviare i server MCP e collegarli a un client compatibile. Questa guida copre l'avvio manuale, il CLI, e la configurazione per Claude Desktop, Cursor IDE e VS Code.

---

## 1. Avviare un Server Manualmente

Ogni server compilato produce un file `dist/index.js` eseguibile direttamente con Node.js:

```bash
node servers/scrum-board/dist/index.js
```

Il server si avvia in modalita STDIO: resta in attesa di messaggi JSON-RPC su `stdin` e risponde su `stdout`. Per terminarlo, premere `Ctrl+C`.

**Nota:** Il server stampa i log su `stderr` (non su `stdout`) per non interferire con il protocollo MCP. Per visualizzare i log:

```bash
node servers/scrum-board/dist/index.js 2> scrum-board.log
```

---

## 2. Utilizzare il CLI

Il pacchetto `@mcp-suite/cli` offre comandi per gestire i server:

### Elencare tutti i server

```bash
npx @mcp-suite/cli list
```

Output:
```
Available MCP Suite servers:

  - agile-metrics
  - api-documentation
  - cicd-monitor
  - code-review
  - codebase-knowledge
  - data-mock-generator
  - db-schema-explorer
  - dependency-manager
  - docker-compose
  - environment-manager
  - http-client
  - log-analyzer
  - performance-profiler
  - project-economics
  - project-scaffolding
  - regex-builder
  - retrospective-manager
  - scrum-board
  - snippet-manager
  - standup-notes
  - test-generator
  - time-tracking

Total: 22 servers
```

### Avviare un server

```bash
npx @mcp-suite/cli start scrum-board
```

### Verificare lo stato

```bash
npx @mcp-suite/cli status
```

Output:
```
MCP Suite Status:

  Total servers: 22
  Built: 22
  Not built: 0

  Built servers:
    + agile-metrics
    + api-documentation
    ...
```

---

## 3. Connettere a Claude Desktop

Claude Desktop legge la configurazione dei server MCP da un file JSON il cui percorso dipende dal sistema operativo.

### Percorso del file di configurazione

| Sistema Operativo | Percorso |
|-------------------|----------|
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **Linux** | `~/.config/Claude/claude_desktop_config.json` |

### Configurazione completa con tutti i 22 server

Creare (o modificare) il file `claude_desktop_config.json` con il seguente contenuto. **Sostituire `/percorso/assoluto/mcp-suite` con il percorso effettivo della directory del progetto.**

```json
{
  "mcpServers": {
    "scrum-board": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/scrum-board/dist/index.js"]
    },
    "standup-notes": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/standup-notes/dist/index.js"]
    },
    "time-tracking": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/time-tracking/dist/index.js"]
    },
    "agile-metrics": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/agile-metrics/dist/index.js"]
    },
    "code-review": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/code-review/dist/index.js"]
    },
    "test-generator": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/test-generator/dist/index.js"]
    },
    "cicd-monitor": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/cicd-monitor/dist/index.js"]
    },
    "docker-compose": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/docker-compose/dist/index.js"]
    },
    "db-schema-explorer": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/db-schema-explorer/dist/index.js"]
    },
    "dependency-manager": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/dependency-manager/dist/index.js"]
    },
    "api-documentation": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/api-documentation/dist/index.js"]
    },
    "codebase-knowledge": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/codebase-knowledge/dist/index.js"]
    },
    "data-mock-generator": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/data-mock-generator/dist/index.js"]
    },
    "environment-manager": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/environment-manager/dist/index.js"]
    },
    "http-client": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/http-client/dist/index.js"]
    },
    "log-analyzer": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/log-analyzer/dist/index.js"]
    },
    "performance-profiler": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/performance-profiler/dist/index.js"]
    },
    "project-economics": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/project-economics/dist/index.js"]
    },
    "project-scaffolding": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/project-scaffolding/dist/index.js"]
    },
    "regex-builder": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/regex-builder/dist/index.js"]
    },
    "retrospective-manager": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/retrospective-manager/dist/index.js"]
    },
    "snippet-manager": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/snippet-manager/dist/index.js"]
    }
  }
}
```

### Dopo la configurazione

1. **Riavviare Claude Desktop** completamente (chiudere e riaprire)
2. Nella chat, verificare che i server siano visibili cliccando sull'icona degli strumenti (martello)
3. Provare un comando: *"Crea uno sprint chiamato Sprint 1 dal 2025-01-13 al 2025-01-24 con goal: completare il modulo autenticazione"*

---

## 4. Testare un Server

### Metodo 1: MCP Inspector

MCP Inspector e uno strumento di debug ufficiale per server MCP:

```bash
npx @modelcontextprotocol/inspector node servers/scrum-board/dist/index.js
```

Questo apre un'interfaccia web dove e possibile:
- Visualizzare i tool disponibili
- Eseguire tool con parametri personalizzati
- Ispezionare le risposte JSON

### Metodo 2: Test diretto con Claude Desktop

Dopo aver configurato `claude_desktop_config.json`, aprire Claude Desktop e provare:

- *"Elenca le pipeline CI/CD"* (cicd-monitor)
- *"Crea una nota di standup per oggi"* (standup-notes)
- *"Analizza le dipendenze del mio progetto"* (dependency-manager)
- *"Genera dati mock per una tabella utenti"* (data-mock-generator)

---

## 5. Connettere a Cursor IDE

Cursor supporta i server MCP tramite la configurazione nel file `.cursor/mcp.json` nella directory del progetto (o nella home directory per configurazione globale).

### Configurazione per progetto

Creare il file `.cursor/mcp.json` nella root del progetto:

```json
{
  "mcpServers": {
    "scrum-board": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/scrum-board/dist/index.js"]
    },
    "code-review": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/code-review/dist/index.js"]
    },
    "test-generator": {
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/test-generator/dist/index.js"]
    }
  }
}
```

### Configurazione globale

Per rendere i server disponibili in tutti i progetti, creare il file nella home directory:

| Sistema Operativo | Percorso |
|-------------------|----------|
| **macOS/Linux** | `~/.cursor/mcp.json` |
| **Windows** | `%USERPROFILE%\.cursor\mcp.json` |

### Verificare in Cursor

1. Aprire Cursor IDE
2. Aprire le impostazioni (Cmd/Ctrl + ,)
3. Cercare "MCP" nella barra di ricerca
4. I server configurati devono apparire nella lista
5. Provare un tool nella chat di Cursor (Cmd/Ctrl + L)

---

## 6. Connettere a VS Code

VS Code supporta i server MCP tramite l'estensione GitHub Copilot (con supporto MCP) o tramite estensioni di terze parti.

### Configurazione con file .vscode/mcp.json

Creare il file `.vscode/mcp.json` nella root del progetto:

```json
{
  "servers": {
    "scrum-board": {
      "type": "stdio",
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/scrum-board/dist/index.js"]
    },
    "code-review": {
      "type": "stdio",
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/code-review/dist/index.js"]
    },
    "test-generator": {
      "type": "stdio",
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/test-generator/dist/index.js"]
    }
  }
}
```

### Configurazione tramite settings.json

Aggiungere alla configurazione di VS Code (`settings.json`):

```json
{
  "mcp.servers": {
    "scrum-board": {
      "type": "stdio",
      "command": "node",
      "args": ["/percorso/assoluto/mcp-suite/servers/scrum-board/dist/index.js"]
    }
  }
}
```

### Verificare in VS Code

1. Aprire VS Code con l'estensione Copilot attiva
2. Aprire la chat di Copilot (Ctrl+Shift+I o Cmd+Shift+I)
3. Verificare che i tool MCP siano disponibili
4. Provare: *"Usa il tool create-sprint per creare uno sprint"*

---

## Consigli per i Percorsi

- Usare sempre **percorsi assoluti** nei file di configurazione
- Su Windows, usare barre normali (`/`) o doppie barre rovesciate (`\\`)
- Evitare spazi nei percorsi: se presenti, racchiuderli tra virgolette

**Esempio Windows:**
```json
{
  "command": "node",
  "args": ["C:/Users/nome/progetti/mcp-suite/servers/scrum-board/dist/index.js"]
}
```

**Esempio macOS/Linux:**
```json
{
  "command": "node",
  "args": ["/home/nome/progetti/mcp-suite/servers/scrum-board/dist/index.js"]
}
```

---

## Variabili d'Ambiente Opzionali

E possibile passare variabili d'ambiente ai server nella configurazione:

```json
{
  "scrum-board": {
    "command": "node",
    "args": ["/percorso/mcp-suite/servers/scrum-board/dist/index.js"],
    "env": {
      "MCP_SUITE_LOG_LEVEL": "debug",
      "MCP_SUITE_SCRUM_BOARD_DATA_DIR": "/percorso/personalizzato/data"
    }
  }
}
```

Per i dettagli sulle variabili d'ambiente, consultare la sezione [Configurazione](../04-configurazione/01-variabili-ambiente.md).
