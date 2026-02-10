# Creating Your First MCP Server

## Introduction

In this chapter you will build a complete MCP server starting from an empty project. The server will expose tools for managing notes, with input validation via Zod and STDIO transport.

---

## Project Setup

### Prerequisites

- Node.js >= 18
- npm or pnpm
- TypeScript 5.x

### Initialization

```bash
mkdir mcp-notes-server && cd mcp-notes-server
npm init -y
```

Install the dependencies:

```bash
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node
```

### TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

### Package.json

Update `package.json`:

```json
{
  "name": "mcp-notes-server",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "mcp-notes": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  }
}
```

The `"type": "module"` field is essential: MCP SDK uses ESM.

### Folder Structure

```bash
mkdir -p src
```

```
mcp-notes-server/
  src/
    index.ts         # Entry point + server logic
  package.json
  tsconfig.json
```

---

## The Minimal Server

Create `src/index.ts`:

```typescript
#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// In-memory state
const notes: Map<string, string> = new Map();

// Create the server
const server = new McpServer({
  name: "notes-server",
  version: "1.0.0",
});

// Register the first tool
server.tool(
  "add-note",
  "Adds a new note",
  {
    title: z.string().describe("Note title"),
    content: z.string().describe("Note content"),
  },
  async ({ title, content }) => {
    notes.set(title, content);
    return {
      content: [
        {
          type: "text",
          text: `Note "${title}" saved successfully.`,
        },
      ],
    };
  },
);

// Start with STDIO transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Notes MCP Server started on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

### Code Anatomy

**1. SDK Import:**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
```

`McpServer` is the main class. It manages the protocol lifecycle, tool registration, and capability negotiation.

**2. Server creation:**

```typescript
const server = new McpServer({
  name: "notes-server",    // Unique identifier
  version: "1.0.0",        // Version (semver)
});
```

**3. Tool registration:**

```typescript
server.tool(
  "add-note",              // Tool name (identifier)
  "Adds a new note",       // Description (the AI model reads this!)
  {                        // Input schema (Zod object)
    title: z.string(),
    content: z.string(),
  },
  async ({ title, content }) => {  // Async handler
    // ... logic ...
    return {
      content: [{ type: "text", text: "result" }],
    };
  },
);
```

The `server.tool()` signature has 4 arguments:
- **name**: unique string that identifies the tool
- **description**: text that the AI model uses to decide when to invoke the tool
- **inputSchema**: object with Zod keys that defines the parameters
- **handler**: async function that receives the typed parameters and returns the result

**4. Result format:**

```typescript
return {
  content: [
    { type: "text", text: "result text" }
  ],
  isError: false,  // optional, defaults to false
};
```

The `content` field is an array that can contain:
- `{ type: "text", text: "..." }` -- text
- `{ type: "image", data: "base64...", mimeType: "image/png" }` -- image
- `{ type: "resource", resource: { uri: "...", text: "..." } }` -- embedded resource

**5. STDIO Transport:**

```typescript
const transport = new StdioServerTransport();
await server.connect(transport);
```

`connect()` starts the read/write loop on stdin/stdout. From this point on, the server is listening.

**6. Logging to stderr:**

```typescript
console.error("Notes MCP Server started on stdio");
```

**Never use `console.log()`** in a STDIO server: it would corrupt the protocol. All logging must go to stderr with `console.error()`.

---

## Adding More Tools

Extend the server with tools to read, list, and delete notes:

```typescript
// Tool: read a note
server.tool(
  "get-note",
  "Retrieves the content of a note by title",
  {
    title: z.string().describe("Title of the note to read"),
  },
  async ({ title }) => {
    const content = notes.get(title);
    if (!content) {
      return {
        content: [{ type: "text", text: `Note "${title}" not found.` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: content }],
    };
  },
);

// Tool: list all notes
server.tool(
  "list-notes",
  "Lists all saved notes",
  {},  // No parameters required
  async () => {
    if (notes.size === 0) {
      return {
        content: [{ type: "text", text: "No notes saved." }],
      };
    }
    const list = Array.from(notes.keys())
      .map((title, i) => `${i + 1}. ${title}`)
      .join("\n");
    return {
      content: [{ type: "text", text: list }],
    };
  },
);

// Tool: delete a note
server.tool(
  "delete-note",
  "Deletes a note by title",
  {
    title: z.string().describe("Title of the note to delete"),
  },
  async ({ title }) => {
    const deleted = notes.delete(title);
    if (!deleted) {
      return {
        content: [{ type: "text", text: `Note "${title}" not found.` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: `Note "${title}" deleted.` }],
    };
  },
);
```

---

## Advanced Validation with Zod

Zod allows you to define expressive validation schemas:

```typescript
server.tool(
  "search-notes",
  "Search notes by keyword with filter options",
  {
    query: z.string().min(2).describe("Text to search for (minimum 2 characters)"),
    caseSensitive: z.boolean().optional().default(false)
      .describe("If true, the search is case-sensitive"),
    limit: z.number().int().min(1).max(100).optional().default(10)
      .describe("Maximum number of results (1-100)"),
  },
  async ({ query, caseSensitive, limit }) => {
    const results: string[] = [];
    for (const [title, content] of notes) {
      const haystack = caseSensitive ? content : content.toLowerCase();
      const needle = caseSensitive ? query : query.toLowerCase();
      if (haystack.includes(needle)) {
        results.push(title);
      }
      if (results.length >= limit) break;
    }

    return {
      content: [{
        type: "text",
        text: results.length > 0
          ? `Found ${results.length} notes:\n${results.join("\n")}`
          : `No results for "${query}".`,
      }],
    };
  },
);
```

### Common Zod Patterns

```typescript
// Strings
z.string()                           // any string
z.string().min(1)                    // non-empty
z.string().email()                   // valid email
z.string().url()                     // valid URL
z.string().uuid()                    // valid UUID

// Numbers
z.number()                           // any number
z.number().int()                     // integer
z.number().int().positive()          // positive integer
z.number().min(0).max(100)           // range

// Booleans and enums
z.boolean()                          // true/false
z.enum(["low", "medium", "high"])    // string enum

// Optionals and defaults
z.string().optional()                // string | undefined
z.number().optional().default(10)    // with default value

// Arrays and objects
z.array(z.string())                  // array of strings
z.object({                           // nested object
  name: z.string(),
  tags: z.array(z.string()).optional(),
})

// Describe (important for the AI!)
z.string().describe("Field description for the AI model")
```

The `.describe()` is crucial: the text is included in the JSON schema sent to the model, helping it understand what to provide as an argument.

---

## Error Handling

### Execution Errors (handled by the tool)

When a tool encounters a predictable error, it returns `isError: true`:

```typescript
async ({ title }) => {
  try {
    const data = fetchData(title);
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }],
      isError: true,
    };
  }
}
```

This is the standard pattern: try/catch wrapping the logic, with `isError: true` on failure. The AI model receives the error as context and can decide how to proceed.

### Protocol Errors (unhandled exceptions)

If the tool throws an unhandled exception, the SDK automatically transforms it into a JSON-RPC error. It is best practice to always handle errors explicitly.

---

## Build and Manual Testing

```bash
npm run build
```

Test the server with the MCP Inspector (official tool):

```bash
npx @modelcontextprotocol/inspector dist/index.js
```

This opens a web interface where you can list and invoke the server's tools.

---

## Claude Desktop Configuration

To use the server with Claude Desktop, add the following to the configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "notes": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-notes-server/dist/index.js"]
    }
  }
}
```

After restarting Claude Desktop, the model will see the server's tools and will be able to invoke them when relevant to the conversation.

---

## Summary

In this chapter you learned:

1. How to structure an MCP server project with TypeScript
2. How to register tools with `server.tool()` and validate input with Zod
3. The result format (content array with text/image/resource types)
4. Error handling with `isError: true`
5. The importance of using `console.error()` instead of `console.log()` with STDIO
6. How to test with MCP Inspector and configure Claude Desktop

**Next**: [Creating Your First MCP Client](./03-first-client.md)
