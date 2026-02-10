# MCP Primitives: Tools, Resources, Prompts

## Overview

The Model Context Protocol defines three types of primitives that a server can expose. Each primitive has a specific role in the interaction between the AI and the server.

```
                    MCP Server
        +-------------------------------+
        |                               |
        |  +---------+  +-----------+   |
        |  | Tools   |  | Resources |   |
        |  |(actions) |  |  (data)   |   |
        |  +---------+  +-----------+   |
        |                               |
        |  +------------+               |
        |  | Prompts    |               |
        |  | (templates)|               |
        |  +------------+               |
        +-------------------------------+
```

---

## 1. Tools

**Tools** are functions that the AI can invoke to perform actions. They represent the core of MCP interaction.

### Characteristics

- **The AI decides when to call them**: Based on the conversation context, the AI autonomously chooses which tool to use
- **They have typed parameters**: Each tool declares its inputs with a Zod schema
- **They return structured results**: The result is always an array of `content` with type `text`, `image`, or `resource`
- **They can have side effects**: Creating files, writing to the database, calling external APIs

### Anatomy of a Tool in MCP Suite

```typescript
server.tool(
  'create-sprint',                    // Unique name
  'Create a new sprint',             // Description for the AI
  {                                   // Parameter schema (Zod)
    name: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    goals: z.array(z.string()),
  },
  async ({ name, startDate, endDate, goals }) => {  // Handler
    const sprint = store.createSprint({ name, startDate, endDate, goals });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(sprint, null, 2)
      }]
    };
  }
);
```

### Tool Categories in MCP Suite

| Category | Example | Effects |
|----------|---------|---------|
| **Creation** | `create-sprint`, `save-snippet` | Write to the database |
| **Reading** | `get-sprint`, `search-snippets` | Read-only |
| **Analysis** | `analyze-diff`, `find-bottlenecks` | Process input, no side effects |
| **Generation** | `generate-unit-tests`, `generate-compose` | Produce code/config |
| **Monitoring** | `list-pipelines`, `get-budget-status` | Read external state |

---

## 2. Resources

**Resources** are data that the AI can read. They are identified by URIs and can be static or dynamic.

### Characteristics

- **Identified by URI**: E.g. `file:///path/to/file`, `db://schema/table`
- **The application requests them**: Unlike tools, resources are typically requested by the host application
- **Read-only**: They do not modify state
- **Support URI templates**: E.g. `sprint://{id}` for parametric resources

### Conceptual Example

```typescript
server.resource(
  'sprint://{id}',
  'Get sprint details',
  async (uri) => {
    const id = extractId(uri);
    const sprint = store.getSprint(id);
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(sprint)
      }]
    };
  }
);
```

> **Note**: MCP Suite currently uses mainly Tools to expose functionality. Resources are planned for future developments.

---

## 3. Prompts (Templates)

**Prompts** are predefined templates that guide the AI in specific tasks.

### Characteristics

- **They guide the AI**: They provide structured instructions for complex tasks
- **They accept arguments**: They can be parameterized
- **Combinable with tools**: A prompt can suggest a sequence of tools for the AI to call

### Conceptual Example

```typescript
server.prompt(
  'sprint-review',
  'Generate a sprint review report',
  [{ name: 'sprintId', description: 'Sprint to review', required: true }],
  async ({ sprintId }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Analyze sprint ${sprintId}: use get-sprint for data,
               calculate-velocity for metrics, and generate a report.`
      }
    }]
  })
);
```

> **Note**: MCP Suite currently uses mainly Tools. Prompts are planned for future developments.

---

## How the AI Chooses Tools

When the AI receives the list of available tools, for each tool it knows:

1. **Name**: Unique identifier (e.g. `create-sprint`)
2. **Description**: Text that explains what the tool does
3. **Parameter schema**: Structure of the input parameters with types and descriptions

The AI uses this information to decide which tool to call in response to the user's request. The description is crucial: it must be clear and specific to help the AI make the right choice.

### Best Practices for Descriptions

```
"Create a new sprint with a name, date range, and goals"
   Clear: explains WHAT it does and WHICH inputs are needed

"Sprint creation tool"
   Vague: the AI might not understand when to use it

"Create a new sprint. Returns the created sprint object with id,
 name, dates, status. Use this when the user wants to start
 planning a new iteration."
   Excellent: explains what it does, what it returns, and when to use it
```

---

## The Lifecycle of an MCP Session

```
[1] INITIALIZATION
    Client --> Server: initialize (protocol version, capabilities)
    Server --> Client: capabilities (tool list, resource templates)

[2] DISCOVERY
    Client --> Server: tools/list
    Server --> Client: [{ name, description, inputSchema }, ...]

[3] USAGE (repeated N times)
    Client --> Server: tools/call { name, arguments }
    Server --> Client: { content: [...] }

[4] SHUTDOWN
    Client --> Server: close
```

Each MCP session follows this flow. The Server remains listening after initialization, ready to respond to tool calls until the session is closed.
