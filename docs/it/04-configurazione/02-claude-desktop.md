# Configurazione Claude Desktop

## Introduzione

Claude Desktop e il client principale per i server MCP Suite. Questa guida descrive in dettaglio come configurare il collegamento tra Claude Desktop e i 22 server della suite.

---

## Percorso del File di Configurazione

Claude Desktop cerca il file `claude_desktop_config.json` in un percorso specifico per sistema operativo:

| Sistema Operativo | Percorso Completo |
|-------------------|-------------------|
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **Linux** | `~/.config/Claude/claude_desktop_config.json` |

### Come trovare il percorso su Windows

```powershell
# In PowerShell
echo $env:APPDATA\Claude\claude_desktop_config.json

# Tipicamente:
# C:\Users\NomeUtente\AppData\Roaming\Claude\claude_desktop_config.json
```

### Come trovare il percorso su macOS

```bash
echo ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

### Come trovare il percorso su Linux

```bash
echo ~/.config/Claude/claude_desktop_config.json
```

**Nota:** Se la directory `Claude/` non esiste, crearla:
```bash
# macOS
mkdir -p ~/Library/Application\ Support/Claude

# Linux
mkdir -p ~/.config/Claude

# Windows (PowerShell)
New-Item -ItemType Directory -Path "$env:APPDATA\Claude" -Force
```

---

## Formato JSON

Il file di configurazione ha la seguente struttura:

```json
{
  "mcpServers": {
    "nome-server": {
      "command": "percorso-al-binario",
      "args": ["argomento1", "argomento2"],
      "env": {
        "VARIABILE": "valore"
      }
    }
  }
}
```

### Campi

| Campo | Tipo | Obbligatorio | Descrizione |
|-------|------|-------------|-------------|
| `command` | `string` | Si | Comando da eseguire (es. `"node"`) |
| `args` | `string[]` | Si | Argomenti del comando (percorso al file JS) |
| `env` | `object` | No | Variabili d'ambiente da passare al processo |

---

## Configurare un Singolo Server

Per configurare solo il server `scrum-board`:

```json
{
  "mcpServers": {
    "scrum-board": {
      "command": "node",
      "args": ["/home/utente/mcp-suite/servers/scrum-board/dist/index.js"]
    }
  }
}
```

### Con variabili d'ambiente personalizzate

```json
{
  "mcpServers": {
    "scrum-board": {
      "command": "node",
      "args": ["/home/utente/mcp-suite/servers/scrum-board/dist/index.js"],
      "env": {
        "MCP_SUITE_SCRUM_BOARD_LOG_LEVEL": "debug",
        "MCP_SUITE_SCRUM_BOARD_DATA_DIR": "/home/utente/dati-mcp"
      }
    }
  }
}
```

---

## Configurazione Completa: Tutti i 22 Server

Di seguito la configurazione per abilitare **tutti** i server della suite. Sostituire `/PERCORSO/ASSOLUTO/mcp-suite` con il percorso reale del progetto.

```json
{
  "mcpServers": {
    "agile-metrics": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/mcp-suite/servers/agile-metrics/dist/index.js"]
    },
    "api-documentation": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/mcp-suite/servers/api-documentation/dist/index.js"]
    },
    "cicd-monitor": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/mcp-suite/servers/cicd-monitor/dist/index.js"]
    },
    "code-review": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/mcp-suite/servers/code-review/dist/index.js"]
    },
    "codebase-knowledge": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/mcp-suite/servers/codebase-knowledge/dist/index.js"]
    },
    "data-mock-generator": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/mcp-suite/servers/data-mock-generator/dist/index.js"]
    },
    "db-schema-explorer": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/mcp-suite/servers/db-schema-explorer/dist/index.js"]
    },
    "dependency-manager": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/mcp-suite/servers/dependency-manager/dist/index.js"]
    },
    "docker-compose": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/mcp-suite/servers/docker-compose/dist/index.js"]
    },
    "environment-manager": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/mcp-suite/servers/environment-manager/dist/index.js"]
    },
    "http-client": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/mcp-suite/servers/http-client/dist/index.js"]
    },
    "log-analyzer": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/mcp-suite/servers/log-analyzer/dist/index.js"]
    },
    "performance-profiler": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/mcp-suite/servers/performance-profiler/dist/index.js"]
    },
    "project-economics": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/mcp-suite/servers/project-economics/dist/index.js"]
    },
    "project-scaffolding": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/mcp-suite/servers/project-scaffolding/dist/index.js"]
    },
    "regex-builder": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/mcp-suite/servers/regex-builder/dist/index.js"]
    },
    "retrospective-manager": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/mcp-suite/servers/retrospective-manager/dist/index.js"]
    },
    "scrum-board": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/mcp-suite/servers/scrum-board/dist/index.js"]
    },
    "snippet-manager": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/mcp-suite/servers/snippet-manager/dist/index.js"]
    },
    "standup-notes": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/mcp-suite/servers/standup-notes/dist/index.js"]
    },
    "test-generator": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/mcp-suite/servers/test-generator/dist/index.js"]
    },
    "time-tracking": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/mcp-suite/servers/time-tracking/dist/index.js"]
    }
  }
}
```

---

## Consigli per la Gestione dei Percorsi

### Usare sempre percorsi assoluti

I percorsi relativi **non funzionano** nella configurazione di Claude Desktop perche il working directory del processo e imprevedibile.

```json
// CORRETTO
"args": ["/home/utente/mcp-suite/servers/scrum-board/dist/index.js"]

// ERRATO - non funzionera
"args": ["./servers/scrum-board/dist/index.js"]
```

### Windows: formati di percorso

Su Windows, sono accettati entrambi i formati:

```json
// Con barre normali (raccomandato)
"args": ["C:/Users/nome/mcp-suite/servers/scrum-board/dist/index.js"]

// Con doppie barre rovesciate
"args": ["C:\\Users\\nome\\mcp-suite\\servers\\scrum-board\\dist\\index.js"]
```

### Verificare il percorso di Node.js

Se `"command": "node"` non funziona, specificare il percorso assoluto di Node.js:

```bash
# Trovare il percorso
which node        # macOS/Linux
where node        # Windows
```

```json
{
  "command": "/usr/local/bin/node",
  "args": ["/home/utente/mcp-suite/servers/scrum-board/dist/index.js"]
}
```

---

## Riavvio di Claude Desktop

Dopo ogni modifica al file `claude_desktop_config.json` e **necessario riavviare completamente** Claude Desktop:

### macOS
1. Cliccare con il tasto destro sull'icona di Claude nel Dock
2. Selezionare "Esci"
3. Riaprire Claude Desktop

### Windows
1. Cliccare con il tasto destro sull'icona di Claude nella system tray
2. Selezionare "Esci" o "Quit"
3. Riaprire Claude Desktop

### Linux
1. Chiudere la finestra di Claude Desktop
2. Verificare che il processo sia terminato: `pkill -f Claude`
3. Riaprire Claude Desktop

**Nota:** La semplice chiusura della finestra potrebbe non bastare. Assicurarsi che il processo sia completamente terminato.

---

## Verifica del Collegamento

Dopo il riavvio di Claude Desktop:

1. Aprire una nuova conversazione
2. Cercare l'icona degli **strumenti** (icona a forma di martello) nella barra della chat
3. Cliccarla per visualizzare l'elenco dei tool disponibili
4. Ogni server registrato dovrebbe mostrare i propri tool

### Test rapido

Provare i seguenti comandi nella chat:

| Server | Comando di test |
|--------|----------------|
| scrum-board | *"Crea uno sprint chiamato Sprint 1 dal 2025-01-13 al 2025-01-24"* |
| standup-notes | *"Registra la mia nota di standup di oggi"* |
| snippet-manager | *"Salva questo snippet di codice Python: print('hello')"* |
| regex-builder | *"Costruisci una regex per validare un'email"* |
| http-client | *"Fai una richiesta GET a https://httpbin.org/get"* |

---

## Troubleshooting

### Il server non appare nei tool

1. Verificare che il server sia stato compilato: `ls servers/nome-server/dist/index.js`
2. Verificare che il percorso nel JSON sia corretto e assoluto
3. Verificare la sintassi del JSON (usare un validatore online se necessario)
4. Riavviare completamente Claude Desktop

### Errore "Server disconnected"

1. Provare ad avviare il server manualmente per verificare che funzioni:
   ```bash
   node /percorso/servers/nome-server/dist/index.js
   ```
2. Se mostra errori, ricompilare: `pnpm build`
3. Controllare i log del server (vengono scritti su stderr)

### Troppi server rallentano Claude Desktop

Se 22 server risultano troppi, configurare solo quelli necessari per il workflow corrente. Ad esempio, per un workflow Scrum:

```json
{
  "mcpServers": {
    "scrum-board": { "command": "node", "args": ["..."] },
    "standup-notes": { "command": "node", "args": ["..."] },
    "time-tracking": { "command": "node", "args": ["..."] },
    "agile-metrics": { "command": "node", "args": ["..."] },
    "retrospective-manager": { "command": "node", "args": ["..."] }
  }
}
```
