# Project Scaffolding Server

## Overview

The **project-scaffolding** server automates the creation of new projects and components
from predefined templates. It solves the initial setup problem:
every new project requires the manual creation of `package.json`, `tsconfig.json`,
folder structure, and boilerplate files. This process is repetitive and error-prone.

With this server, a single command generates a complete project, consistent with the
team's best practices, ready to start development.

```
+------------------------------------------------------------+
|              project-scaffolding server                    |
|                                                            |
|  +-------------------------------------------------------+ |
|  |                  Tool Layer                           | |
|  |                                                       | |
|  |  list-templates  scaffold-project  scaffold-component | |
|  +-------------------------------------------------------+ |
|                         |                                  |
|                         v                                  |
|  +-------------------------------------------------------+ |
|  |              services/templates.ts                    | |
|  |                                                       | |
|  |  TEMPLATES = {                                        | |
|  |    'node-typescript'  -> Node.js + TypeScript + ESM   | |
|  |    'express-api'      -> Express REST API + TS        | |
|  |    'react-app'        -> React + Vite + TypeScript    | |
|  |    'mcp-server'       -> MCP Server + TypeScript      | |
|  |  }                                                    | |
|  |                                                       | |
|  |  substitutePlaceholders(content, values)              | |
|  +-------------------------------------------------------+ |
|                         |                                  |
|                         v                                  |
|                Filesystem (mkdir + writeFile)              |
+------------------------------------------------------------+
```

### Key Features

- **4 built-in templates**: covering the most common use cases
- **Placeholder substitution**: `{{projectName}}`, `{{author}}`, `{{description}}`, `{{license}}`
- **Single component generation**: component, service, controller, model
- **TypeScript and JavaScript support**: language choice for components
- **No events**: purely generative server, no Event Bus integration

---

## Tool Table

| Tool | Description | Parameters |
|------|-------------|-----------|
| `list-templates` | Lists all available templates with name, description, and file structure | None |
| `scaffold-project` | Generates an entire project from a template with placeholder substitution | `template` (string) - Template name; `projectName` (string); `outputDir` (string); `options?` (object: author, description, license) |
| `scaffold-component` | Generates a single component/service/controller/model file | `type` (enum: component, service, controller, model); `name` (string); `outputDir` (string); `language` (enum: typescript, javascript) |

---

## Architecture

### Service Layer: templates.ts

The core of the server is the `services/templates.ts` file, which contains:

- The `TemplateDefinition` interface: `{ name, description, files: Record<string, string> }`
- The definitions of the 4 templates as constants
- The `TEMPLATES: Record<string, TemplateDefinition>` registry
- The `substitutePlaceholders(content, values)` function for placeholder substitution

```
  TemplateDefinition
  +-------------------+
  | name: string      |
  | description: str  |
  | files: {          |
  |   "path": content |     substitutePlaceholders()
  |   "path": content | --> {{projectName}} -> "my-app"
  |   ...             |     {{author}}      -> "Mario Rossi"
  | }                 |     {{description}} -> "..."
  +-------------------+     {{license}}     -> "MIT"
```

### Available Templates

| Template | Description | Generated Files |
|----------|-------------|-----------------|
| `node-typescript` | Node.js with TypeScript, ESM, and Vitest | package.json, tsconfig.json, src/index.ts, .gitignore, README.md |
| `express-api` | Express REST API with TypeScript, routing, and middleware | package.json, tsconfig.json, src/index.ts, src/app.ts, src/routes/health.ts, src/middleware/error-handler.ts, .gitignore, README.md |
| `react-app` | React application with TypeScript and Vite | package.json, tsconfig.json, vite.config.ts, index.html, src/main.tsx, src/App.tsx, src/App.css, .gitignore, README.md |
| `mcp-server` | Model Context Protocol server with TypeScript | package.json, tsconfig.json, src/index.ts, src/tools.ts, .gitignore, README.md |

### Generatable Component Types

| Type | Generated File | Content |
|------|----------------|---------|
| `component` | `Name.tsx` / `Name.jsx` | React component with props interface (TS) |
| `service` | `Name.service.ts` / `.js` | Class with CRUD methods: findAll, findById, create, update, delete |
| `controller` | `Name.controller.ts` / `.js` | Express controller with handlers getAll, getById, create, update, delete |
| `model` | `Name.model.ts` / `.js` | Interface + factory functions create/update (TS) or plain functions (JS) |

### Flow of scaffold-project

```
  1. Template validation
         |
         v
  2. Placeholder values preparation
     { projectName, author, description, license }
         |
         v
  3. For each file in the template:
     a. Path calculation: outputDir/projectName/relativePath
     b. Directory creation (mkdir recursive)
     c. Placeholder substitution in the content
     d. File writing to disk
         |
         v
  4. Return list of created files
```

---

## Event Bus Integration

This server **neither publishes nor subscribes to events**. It is a purely generative server
that operates on explicit user request.

---

## Interactions with Other Servers

```
+----------------------+                          +---------------------+
| project-scaffolding  |  generates analyzable    | dependency-manager  |
|                      |  project            ---> |  (check-vulnerab.)  |
+----------------------+                          +---------------------+
         |
         |  generates code        ------>  +---------------------+
         +------------------------->  | code-review         |
                                      | (analyze/suggest)   |
                                      +---------------------+
         |
         |  generates structure   ------>  +---------------------+
         +------------------------->  | codebase-knowledge  |
                                      | (architecture-map)  |
                                      +---------------------+
```

| Related Server | Direction | Description |
|----------------|-----------|-------------|
| `dependency-manager` | output -> input | Generated projects can be analyzed for vulnerabilities/licenses |
| `code-review` | output -> input | Generated code can be submitted for review |
| `codebase-knowledge` | output -> input | The generated structure can be explored with architecture-map |
| `api-documentation` | output -> input | Generated Express routes can be extracted by extract-endpoints |

---

## Usage Examples

### Template listing

**Request:**
```json
{
  "tool": "list-templates",
  "arguments": {}
}
```

**Response:**
```json
[
  {
    "name": "node-typescript",
    "description": "Node.js project with TypeScript, ESM, and Vitest",
    "files": ["package.json", "tsconfig.json", "src/index.ts", ".gitignore", "README.md"]
  },
  {
    "name": "express-api",
    "description": "Express REST API with TypeScript, routing, and middleware",
    "files": ["package.json", "tsconfig.json", "src/index.ts", "src/app.ts", "..."]
  },
  {
    "name": "react-app",
    "description": "React application with TypeScript and Vite",
    "files": ["package.json", "tsconfig.json", "vite.config.ts", "index.html", "..."]
  },
  {
    "name": "mcp-server",
    "description": "Model Context Protocol server with TypeScript",
    "files": ["package.json", "tsconfig.json", "src/index.ts", "src/tools.ts", "..."]
  }
]
```

### Project generation

**Request:**
```json
{
  "tool": "scaffold-project",
  "arguments": {
    "template": "express-api",
    "projectName": "user-service",
    "outputDir": "/home/user/projects",
    "options": {
      "author": "Mario Rossi",
      "description": "User management microservice",
      "license": "MIT"
    }
  }
}
```

**Response:**
```json
{
  "template": "express-api",
  "projectName": "user-service",
  "outputDir": "/home/user/projects/user-service",
  "filesCreated": [
    "package.json", "tsconfig.json", "src/index.ts", "src/app.ts",
    "src/routes/health.ts", "src/middleware/error-handler.ts",
    ".gitignore", "README.md"
  ],
  "totalFiles": 8
}
```

### Component generation

**Request:**
```json
{
  "tool": "scaffold-component",
  "arguments": {
    "type": "service",
    "name": "User",
    "outputDir": "/home/user/projects/user-service/src/services",
    "language": "typescript"
  }
}
```

**Response:**
```
Generated service file: /home/user/projects/user-service/src/services/User.service.ts

export class UserService {
  async findAll(): Promise<unknown[]> {
    throw new Error('Not implemented');
  }
  async findById(id: string): Promise<unknown | null> { ... }
  async create(data: unknown): Promise<unknown> { ... }
  async update(id: string, data: unknown): Promise<unknown> { ... }
  async delete(id: string): Promise<void> { ... }
}

export const userService = new UserService();
```

---

## Future Developments

- **Custom templates**: support for user-defined templates in a configurable directory
- **Conditional variables**: `{{#if useDatabase}}` for optional sections in templates
- **Post-scaffold hooks**: automatic execution of `npm install`, `git init` after generation
- **Composite templates**: combination of multiple templates (e.g., express-api + database + docker)
- **Test generation**: automatic scaffolding of test files for each generated component
- **Event Bus integration**: publishing a `project:created` event to notify other servers
- **Name validation**: PascalCase check for components, kebab-case for projects
