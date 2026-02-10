# First Startup

## Introduction

After completing the installation and compilation (`pnpm build`), you can start the MCP servers and connect them to a compatible client. This guide covers manual startup, the CLI, and configuration for Claude Desktop, Cursor IDE, and VS Code.

---

## 1. Starting a Server Manually

Each compiled server produces a `dist/index.js` file that can be executed directly with Node.js:

```bash
node servers/scrum-board/dist/index.js
```

The server starts in STDIO mode: it waits for JSON-RPC messages on `stdin` and responds on `stdout`. To terminate it, press `Ctrl+C`.

**Note:** The server prints logs to `stderr` (not `stdout`) to avoid interfering with the MCP protocol. To view the logs:

```bash
node servers/scrum-board/dist/index.js 2> scrum-board.log
```

---

## 2. Using the CLI

The `@mcp-suite/cli` package provides commands for managing servers:

### List all servers

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

### Start a server

```bash
npx @mcp-suite/cli start scrum-board
```

### Check the status

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

## 3. Connecting to Claude Desktop

Claude Desktop reads the MCP server configuration from a JSON file whose path depends on the operating system.

### Configuration file path

| Operating System | Path |
|------------------|------|
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **Linux** | `~/.config/Claude/claude_desktop_config.json` |

### Complete configuration with all 22 servers

Create (or modify) the `claude_desktop_config.json` file with the following content. **Replace `/absolute/path/to/mcp-suite` with the actual path to the project directory.**

```json
{
  "mcpServers": {
    "scrum-board": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/scrum-board/dist/index.js"]
    },
    "standup-notes": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/standup-notes/dist/index.js"]
    },
    "time-tracking": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/time-tracking/dist/index.js"]
    },
    "agile-metrics": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/agile-metrics/dist/index.js"]
    },
    "code-review": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/code-review/dist/index.js"]
    },
    "test-generator": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/test-generator/dist/index.js"]
    },
    "cicd-monitor": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/cicd-monitor/dist/index.js"]
    },
    "docker-compose": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/docker-compose/dist/index.js"]
    },
    "db-schema-explorer": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/db-schema-explorer/dist/index.js"]
    },
    "dependency-manager": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/dependency-manager/dist/index.js"]
    },
    "api-documentation": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/api-documentation/dist/index.js"]
    },
    "codebase-knowledge": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/codebase-knowledge/dist/index.js"]
    },
    "data-mock-generator": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/data-mock-generator/dist/index.js"]
    },
    "environment-manager": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/environment-manager/dist/index.js"]
    },
    "http-client": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/http-client/dist/index.js"]
    },
    "log-analyzer": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/log-analyzer/dist/index.js"]
    },
    "performance-profiler": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/performance-profiler/dist/index.js"]
    },
    "project-economics": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/project-economics/dist/index.js"]
    },
    "project-scaffolding": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/project-scaffolding/dist/index.js"]
    },
    "regex-builder": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/regex-builder/dist/index.js"]
    },
    "retrospective-manager": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/retrospective-manager/dist/index.js"]
    },
    "snippet-manager": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/snippet-manager/dist/index.js"]
    }
  }
}
```

### After configuration

1. **Restart Claude Desktop** completely (close and reopen)
2. In the chat, verify that the servers are visible by clicking the tools icon (hammer)
3. Try a command: *"Create a sprint called Sprint 1 from 2025-01-13 to 2025-01-24 with goal: complete the authentication module"*

---

## 4. Testing a Server

### Method 1: MCP Inspector

MCP Inspector is an official debugging tool for MCP servers:

```bash
npx @modelcontextprotocol/inspector node servers/scrum-board/dist/index.js
```

This opens a web interface where you can:
- View available tools
- Execute tools with custom parameters
- Inspect JSON responses

### Method 2: Direct testing with Claude Desktop

After configuring `claude_desktop_config.json`, open Claude Desktop and try:

- *"List the CI/CD pipelines"* (cicd-monitor)
- *"Create a standup note for today"* (standup-notes)
- *"Analyze the dependencies of my project"* (dependency-manager)
- *"Generate mock data for a users table"* (data-mock-generator)

---

## 5. Connecting to Cursor IDE

Cursor supports MCP servers via configuration in the `.cursor/mcp.json` file in the project directory (or in the home directory for global configuration).

### Per-project configuration

Create the `.cursor/mcp.json` file in the project root:

```json
{
  "mcpServers": {
    "scrum-board": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/scrum-board/dist/index.js"]
    },
    "code-review": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/code-review/dist/index.js"]
    },
    "test-generator": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/test-generator/dist/index.js"]
    }
  }
}
```

### Global configuration

To make servers available in all projects, create the file in the home directory:

| Operating System | Path |
|------------------|------|
| **macOS/Linux** | `~/.cursor/mcp.json` |
| **Windows** | `%USERPROFILE%\.cursor\mcp.json` |

### Verify in Cursor

1. Open Cursor IDE
2. Open settings (Cmd/Ctrl + ,)
3. Search for "MCP" in the search bar
4. Configured servers should appear in the list
5. Try a tool in the Cursor chat (Cmd/Ctrl + L)

---

## 6. Connecting to VS Code

VS Code supports MCP servers via the GitHub Copilot extension (with MCP support) or via third-party extensions.

### Configuration with .vscode/mcp.json file

Create the `.vscode/mcp.json` file in the project root:

```json
{
  "servers": {
    "scrum-board": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/scrum-board/dist/index.js"]
    },
    "code-review": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/code-review/dist/index.js"]
    },
    "test-generator": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/test-generator/dist/index.js"]
    }
  }
}
```

### Configuration via settings.json

Add to the VS Code configuration (`settings.json`):

```json
{
  "mcp.servers": {
    "scrum-board": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/servers/scrum-board/dist/index.js"]
    }
  }
}
```

### Verify in VS Code

1. Open VS Code with the Copilot extension active
2. Open the Copilot chat (Ctrl+Shift+I or Cmd+Shift+I)
3. Verify that MCP tools are available
4. Try: *"Use the create-sprint tool to create a sprint"*

---

## Path Tips

- Always use **absolute paths** in configuration files
- On Windows, use forward slashes (`/`) or double backslashes (`\\`)
- Avoid spaces in paths: if present, enclose them in quotes

**Windows example:**
```json
{
  "command": "node",
  "args": ["C:/Users/name/projects/mcp-suite/servers/scrum-board/dist/index.js"]
}
```

**macOS/Linux example:**
```json
{
  "command": "node",
  "args": ["/home/name/projects/mcp-suite/servers/scrum-board/dist/index.js"]
}
```

---

## Optional Environment Variables

You can pass environment variables to servers in the configuration:

```json
{
  "scrum-board": {
    "command": "node",
    "args": ["/path/to/mcp-suite/servers/scrum-board/dist/index.js"],
    "env": {
      "MCP_SUITE_LOG_LEVEL": "debug",
      "MCP_SUITE_SCRUM_BOARD_DATA_DIR": "/custom/path/data"
    }
  }
}
```

For details on environment variables, see the [Configuration](../04-configuration/01-environment-variables.md) section.
