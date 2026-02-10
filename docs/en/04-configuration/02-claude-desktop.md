# Claude Desktop Configuration

## Introduction

Claude Desktop is the primary client for MCP Suite servers. This guide describes in detail how to configure the connection between Claude Desktop and the suite's 22 servers.

---

## Configuration File Path

Claude Desktop looks for the `claude_desktop_config.json` file at an OS-specific path:

| Operating System | Full Path |
|------------------|-----------|
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **Linux** | `~/.config/Claude/claude_desktop_config.json` |

### How to find the path on Windows

```powershell
# In PowerShell
echo $env:APPDATA\Claude\claude_desktop_config.json

# Typically:
# C:\Users\UserName\AppData\Roaming\Claude\claude_desktop_config.json
```

### How to find the path on macOS

```bash
echo ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

### How to find the path on Linux

```bash
echo ~/.config/Claude/claude_desktop_config.json
```

**Note:** If the `Claude/` directory does not exist, create it:
```bash
# macOS
mkdir -p ~/Library/Application\ Support/Claude

# Linux
mkdir -p ~/.config/Claude

# Windows (PowerShell)
New-Item -ItemType Directory -Path "$env:APPDATA\Claude" -Force
```

---

## JSON Format

The configuration file has the following structure:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "path-to-binary",
      "args": ["argument1", "argument2"],
      "env": {
        "VARIABLE": "value"
      }
    }
  }
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `command` | `string` | Yes | Command to execute (e.g. `"node"`) |
| `args` | `string[]` | Yes | Command arguments (path to the JS file) |
| `env` | `object` | No | Environment variables to pass to the process |

---

## Configuring a Single Server

To configure only the `scrum-board` server:

```json
{
  "mcpServers": {
    "scrum-board": {
      "command": "node",
      "args": ["/home/user/mcp-suite/servers/scrum-board/dist/index.js"]
    }
  }
}
```

### With custom environment variables

```json
{
  "mcpServers": {
    "scrum-board": {
      "command": "node",
      "args": ["/home/user/mcp-suite/servers/scrum-board/dist/index.js"],
      "env": {
        "MCP_SUITE_SCRUM_BOARD_LOG_LEVEL": "debug",
        "MCP_SUITE_SCRUM_BOARD_DATA_DIR": "/home/user/mcp-data"
      }
    }
  }
}
```

---

## Complete Configuration: All 22 Servers

Below is the configuration to enable **all** servers in the suite. Replace `/ABSOLUTE/PATH/TO/mcp-suite` with the actual project path.

```json
{
  "mcpServers": {
    "agile-metrics": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-suite/servers/agile-metrics/dist/index.js"]
    },
    "api-documentation": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-suite/servers/api-documentation/dist/index.js"]
    },
    "cicd-monitor": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-suite/servers/cicd-monitor/dist/index.js"]
    },
    "code-review": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-suite/servers/code-review/dist/index.js"]
    },
    "codebase-knowledge": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-suite/servers/codebase-knowledge/dist/index.js"]
    },
    "data-mock-generator": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-suite/servers/data-mock-generator/dist/index.js"]
    },
    "db-schema-explorer": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-suite/servers/db-schema-explorer/dist/index.js"]
    },
    "dependency-manager": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-suite/servers/dependency-manager/dist/index.js"]
    },
    "docker-compose": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-suite/servers/docker-compose/dist/index.js"]
    },
    "environment-manager": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-suite/servers/environment-manager/dist/index.js"]
    },
    "http-client": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-suite/servers/http-client/dist/index.js"]
    },
    "log-analyzer": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-suite/servers/log-analyzer/dist/index.js"]
    },
    "performance-profiler": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-suite/servers/performance-profiler/dist/index.js"]
    },
    "project-economics": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-suite/servers/project-economics/dist/index.js"]
    },
    "project-scaffolding": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-suite/servers/project-scaffolding/dist/index.js"]
    },
    "regex-builder": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-suite/servers/regex-builder/dist/index.js"]
    },
    "retrospective-manager": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-suite/servers/retrospective-manager/dist/index.js"]
    },
    "scrum-board": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-suite/servers/scrum-board/dist/index.js"]
    },
    "snippet-manager": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-suite/servers/snippet-manager/dist/index.js"]
    },
    "standup-notes": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-suite/servers/standup-notes/dist/index.js"]
    },
    "test-generator": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-suite/servers/test-generator/dist/index.js"]
    },
    "time-tracking": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-suite/servers/time-tracking/dist/index.js"]
    }
  }
}
```

---

## Tips for Path Management

### Always use absolute paths

Relative paths **do not work** in Claude Desktop configuration because the process working directory is unpredictable.

```json
// CORRECT
"args": ["/home/user/mcp-suite/servers/scrum-board/dist/index.js"]

// WRONG - will not work
"args": ["./servers/scrum-board/dist/index.js"]
```

### Windows: path formats

On Windows, both formats are accepted:

```json
// With forward slashes (recommended)
"args": ["C:/Users/name/mcp-suite/servers/scrum-board/dist/index.js"]

// With double backslashes
"args": ["C:\\Users\\name\\mcp-suite\\servers\\scrum-board\\dist\\index.js"]
```

### Verify the Node.js path

If `"command": "node"` does not work, specify the absolute path to Node.js:

```bash
# Find the path
which node        # macOS/Linux
where node        # Windows
```

```json
{
  "command": "/usr/local/bin/node",
  "args": ["/home/user/mcp-suite/servers/scrum-board/dist/index.js"]
}
```

---

## Restarting Claude Desktop

After every modification to the `claude_desktop_config.json` file, you **must completely restart** Claude Desktop:

### macOS
1. Right-click the Claude icon in the Dock
2. Select "Quit"
3. Reopen Claude Desktop

### Windows
1. Right-click the Claude icon in the system tray
2. Select "Exit" or "Quit"
3. Reopen Claude Desktop

### Linux
1. Close the Claude Desktop window
2. Verify the process has terminated: `pkill -f Claude`
3. Reopen Claude Desktop

**Note:** Simply closing the window may not be sufficient. Make sure the process has fully terminated.

---

## Verifying the Connection

After restarting Claude Desktop:

1. Open a new conversation
2. Look for the **tools** icon (hammer icon) in the chat bar
3. Click it to view the list of available tools
4. Each registered server should show its own tools

### Quick test

Try the following commands in the chat:

| Server | Test command |
|--------|-------------|
| scrum-board | *"Create a sprint called Sprint 1 from 2025-01-13 to 2025-01-24"* |
| standup-notes | *"Record my standup note for today"* |
| snippet-manager | *"Save this Python code snippet: print('hello')"* |
| regex-builder | *"Build a regex to validate an email"* |
| http-client | *"Make a GET request to https://httpbin.org/get"* |

---

## Troubleshooting

### Server does not appear in tools

1. Verify that the server has been compiled: `ls servers/server-name/dist/index.js`
2. Verify that the path in the JSON is correct and absolute
3. Verify the JSON syntax (use an online validator if necessary)
4. Completely restart Claude Desktop

### Error "Server disconnected"

1. Try starting the server manually to verify it works:
   ```bash
   node /path/to/servers/server-name/dist/index.js
   ```
2. If it shows errors, recompile: `pnpm build`
3. Check the server logs (they are written to stderr)

### Too many servers slow down Claude Desktop

If 22 servers are too many, configure only those needed for the current workflow. For example, for a Scrum workflow:

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
