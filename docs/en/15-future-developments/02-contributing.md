# Contributing Guide

## Welcome

MCP Suite is an open source project and contributions are welcome. This guide explains how to contribute effectively to the project.

---

## Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- Basic knowledge of TypeScript and the Model Context Protocol

---

## Development Environment Setup

```bash
# 1. Fork and clone
git clone https://github.com/<your-username>/mcp-suite.git
cd mcp-suite

# 2. Install dependencies
pnpm install

# 3. Full build
pnpm build

# 4. Verify everything compiles
pnpm typecheck
```

---

## Types of Contributions

### 1. Adding a New MCP Server

The structure is standardized. To create a new server:

```bash
# Create the server structure
mkdir -p servers/my-server/src/{tools,services}
```

**Required files:**

```
servers/my-server/
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── src/
    ├── index.ts          # Entry point
    ├── server.ts         # Factory and tool registration
    ├── tools/            # One file per tool
    │   └── my-tool.ts
    ├── services/         # Business logic (optional)
    │   └── my-store.ts
    └── collaboration.ts  # Event handlers (optional)
```

**package.json template:**

```json
{
  "name": "@mcp-suite/server-my-server",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@mcp-suite/core": "workspace:*",
    "@mcp-suite/event-bus": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.12.1",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

**Register the server** in `pnpm-workspace.yaml` (already covered by the `servers/*` glob).

### 2. Adding a New Tool to an Existing Server

1. Create the file in `servers/<name>/src/tools/my-tool.ts`
2. Follow the existing pattern:

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';

export function registerMyTool(
  server: McpServer,
  store: MyStore,
  eventBus?: EventBus,
): void {
  server.tool(
    'my-tool',
    'Clear description of what the tool does',
    {
      param1: z.string().describe('Parameter description'),
      param2: z.number().optional().describe('Optional parameter'),
    },
    async ({ param1, param2 }) => {
      try {
        const result = store.doSomething(param1, param2);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        };
      }
    },
  );
}
```

3. Register the tool in `server.ts` by calling the registration function

### 3. Adding a New Event

1. Add the definition in `packages/event-bus/src/events.ts`:

```typescript
export interface EventMap {
  // ... existing events ...
  'domain:my-event': {
    field1: string;
    field2: number;
  };
}
```

2. Publish in the appropriate tool
3. Subscribe in the `collaboration.ts` of the interested server
4. Document in the collaboration matrix

### 4. Implementing Placeholder Collaboration Handlers

Many `collaboration.ts` files contain handlers with `void payload` (placeholders). Implementing the actual logic is an excellent contribution:

```typescript
// From:
eventBus.subscribe('scrum:task-updated', (payload) => {
  void payload;
});

// To:
eventBus.subscribe('scrum:task-updated', (payload) => {
  if (payload.newStatus === 'in_progress') {
    store.autoStartTimer(payload.taskId, payload.assignee);
  }
});
```

### 5. Writing Tests

Tests are the top priority. Any contribution that adds tests is particularly appreciated.

---

## Conventions

### Code

- **Formatter**: Prettier (configured in `.prettierrc`)
- **Style**: Single quotes, trailing commas, 100 char line width
- **Imports**: Use `type` import for types (`import type { ... }`)
- **Errors**: Always `error instanceof Error ? error.message : String(error)`
- **Tool naming**: kebab-case (`create-sprint`, not `createSprint`)
- **Event naming**: `domain:action-kebab-case`

### Git

- **Branch**: `feature/feature-name`, `fix/fix-name`, `docs/docs-name`
- **Commit message**: Imperative, concise (e.g., "Add auto-timer to time-tracking")
- **PR**: One feature/fix per PR, with a clear description

### Tool Descriptions

Tool descriptions are crucial because the AI uses them to decide which tool to call. They must be:

- **Specific**: Explain what it does, what it returns, when to use it
- **In English**: For compatibility with all AI clients
- **Under 200 characters**: To avoid taking up too much context

---

## Review Process

1. **Fork** the repository
2. **Create a branch** from `main`
3. **Implement** following the conventions
4. **Build and typecheck**: `pnpm build && pnpm typecheck`
5. **Commit** with clear messages
6. **Open a Pull Request** against `main`
7. **Respond** to review feedback

---

## Areas Where Help is Needed

| Area | Priority | Difficulty |
|------|----------|------------|
| Unit tests for all tools | High | Medium |
| Redis EventBus implementation | High | Medium |
| Client Manager wiring implementation | Medium | High |
| HTTP Transport | Medium | High |
| GitHub Actions CI/CD | Medium | Low |
| Web monitoring dashboard | Low | High |
| Plugin system | Low | High |
| Completion of collaboration handlers | Medium | Low |
