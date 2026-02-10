# Resources and Prompts

## Introduction

Beyond tools, MCP exposes two additional primitives: **Resources** for providing contextual data and **Prompts** for interaction templates. Together with tools, they form the three pillars of the protocol.

```
  +-------------------------------------------------------------------+
  |                       MCP PRIMITIVES                              |
  +-------------------------------------------------------------------+
  |                                                                   |
  |  TOOLS               RESOURCES            PROMPTS                 |
  |  Controlled by       Controlled by        Controlled by           |
  |  the AI model        the host app         the user                |
  |                                                                   |
  |  The model decides   The app decides      The user selects        |
  |  when to invoke      when to load data    a template              |
  |  them                                                             |
  |                                                                   |
  |  Active actions      Passive data         Guided interactions     |
  |  (execute code)      (provide context)    (structure prompts)     |
  +-------------------------------------------------------------------+
```

---

## Resources

Resources are data sources identified by URIs. Unlike tools (which execute actions), resources provide information that enriches the AI's context.

### Registering a Static Resource

```typescript
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({
  name: "docs-server",
  version: "1.0.0",
});

// Static resource: fixed content
server.resource(
  "readme",                                      // Name
  "file:///project/README.md",                   // Unique URI
  { mimeType: "text/markdown" },                 // Metadata
  async () => ({
    contents: [
      {
        uri: "file:///project/README.md",
        mimeType: "text/markdown",
        text: "# My Project\n\nProject description...",
      },
    ],
  }),
);
```

The client accesses the resource with `resources/read` specifying the URI.

### Registering Resource Templates

Templates allow parameterized resources with URI patterns (RFC 6570):

```typescript
// Resource template: dynamic content based on parameter
server.resource(
  "note-by-title",
  new ResourceTemplate("notes://{title}", { list: undefined }),
  { mimeType: "text/plain" },
  async (uri, { title }) => {
    const content = notes.get(title as string);
    if (!content) {
      throw new Error(`Note "${title}" not found`);
    }
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: content,
        },
      ],
    };
  },
);
```

With `list: undefined`, the template does not appear in the resource list. To enumerate available instances:

```typescript
server.resource(
  "note-by-title",
  new ResourceTemplate("notes://{title}", {
    list: async () => {
      // Return currently available resources
      return {
        resources: Array.from(notes.keys()).map((title) => ({
          uri: `notes://${encodeURIComponent(title)}`,
          name: title,
          mimeType: "text/plain",
        })),
      };
    },
  }),
  async (uri, { title }) => {
    const content = notes.get(title as string);
    return {
      contents: [{
        uri: uri.href,
        mimeType: "text/plain",
        text: content ?? "Not found",
      }],
    };
  },
);
```

### Content Types

Resources support both textual and binary content:

```typescript
// Textual content
{
  uri: "file:///config.json",
  mimeType: "application/json",
  text: '{"key": "value"}'
}

// Binary content (base64)
{
  uri: "file:///logo.png",
  mimeType: "image/png",
  blob: "iVBORw0KGgoAAAANSUhEUg..."  // base64
}
```

### Resource Subscriptions

If a resource changes over time, the server can notify clients:

```typescript
// In the capability declaration, enable subscribe
// The server emits notifications when data changes:
server.notification({
  method: "notifications/resources/updated",
  params: { uri: "notes://my-note" },
});
```

---

## Prompts

Prompts are reusable templates that structure interactions with the model. They are typically exposed as slash commands in the user interface.

### Registering a Simple Prompt

```typescript
server.prompt(
  "summarize-notes",                              // Name (becomes /summarize-notes)
  "Summarize all saved notes",                    // Description
  async () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Here are my notes. Provide a concise summary:\n\n${
            Array.from(notes.entries())
              .map(([title, content]) => `## ${title}\n${content}`)
              .join("\n\n")
          }`,
        },
      },
    ],
  }),
);
```

### Prompts with Arguments

```typescript
server.prompt(
  "review-note",
  "Review and improve a specific note",
  [
    {
      name: "title",
      description: "Title of the note to review",
      required: true,
    },
    {
      name: "style",
      description: "Desired style: formal, informal, technical",
      required: false,
    },
  ],
  async ({ title, style }) => {
    const content = notes.get(title);
    if (!content) {
      throw new Error(`Note "${title}" not found`);
    }

    const styleHint = style ? ` Use a ${style} style.` : "";

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Review and improve this note.${styleHint}\n\n# ${title}\n\n${content}`,
          },
        },
      ],
    };
  },
);
```

### Multi-Message Prompts

Prompts can include messages with different roles to create rich contexts:

```typescript
server.prompt(
  "debug-session",
  "Start a guided debugging session",
  [
    {
      name: "error",
      description: "The error message to analyze",
      required: true,
    },
  ],
  async ({ error }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `I have this error: ${error}`,
        },
      },
      {
        role: "assistant",
        content: {
          type: "text",
          text: "I understand the problem. Let's analyze it step by step. First, "
            + "tell me in what context the error occurs.",
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: "It occurs during test execution.",
        },
      },
    ],
  }),
);
```

### Prompts with Embedded Resources

A prompt can include inline resources as context:

```typescript
server.prompt(
  "analyze-project",
  "Analyze the project structure",
  async () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "resource",
          resource: {
            uri: "file:///project/package.json",
            mimeType: "application/json",
            text: JSON.stringify(packageJson, null, 2),
          },
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: "Analyze this configuration and suggest improvements.",
        },
      },
    ],
  }),
);
```

---

## Tool vs Resource vs Prompt: When to Use What

| Scenario | Primitive | Reason |
|----------|-----------|--------|
| Perform a calculation | **Tool** | Active action with side-effect |
| Read a configuration file | **Resource** | Passive contextual data |
| Save data to the database | **Tool** | Action that modifies state |
| Provide DB schema | **Resource** | Static context |
| "Review my code" | **Prompt** | Interaction template |
| Search an archive | **Tool** | Action with dynamic parameters |
| API documentation | **Resource** | Reference context |
| "Generate tests for this file" | **Prompt** | Structured workflow |

**Rule of thumb**: if the model must decide when and how to use it, it is a **Tool**. If the application loads data in the background, it is a **Resource**. If the user selects a predefined action, it is a **Prompt**.

---

## Summary

In this chapter you learned:

1. How to register static and parameterized resources with URI templates
2. The difference between textual and binary content in resources
3. How to create simple prompts, prompts with arguments, and multi-message prompts
4. How to embed resources in prompts
5. When to use tool, resource, or prompt

**Next**: [HTTP Transport and Deployment](./05-http-transport.md)
