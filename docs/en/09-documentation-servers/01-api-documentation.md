# API Documentation Server

## Overview

The **api-documentation** server automates the extraction, generation, and analysis
of API documentation. The problem it solves is well known: API documentation
tends to become outdated quickly, developers forget to update JSDoc comments,
and the OpenAPI specification does not reflect the actual routes in the code.

This server scans source code to find endpoint definitions (Express.js and NestJS),
generates OpenAPI 3.0.3 skeletons, and identifies exports lacking JSDoc/TSDoc
documentation.

```
+------------------------------------------------------------+
|                 api-documentation server                   |
|                                                            |
|  +-------------------------------------------------------+ |
|  |                    Tool Layer                         | |
|  |                                                       | |
|  |  extract-endpoints    generate-openapi                | |
|  |  find-undocumented                                    | |
|  +-------------------------------------------------------+ |
|                         |                                  |
|                         v                                  |
|  +-------------------------------------------------------+ |
|  |                fs (readFileSync)                      | |
|  |                                                       | |
|  |  Recognized patterns:                                 | |
|  |  - Express: app.get('/path', handler)                 | |
|  |  - Express: router.post('/path', middleware, handler) | |
|  |  - NestJS:  @Get('/path'), @Post('/path')             | |
|  |  - NestJS:  @Controller('/prefix')                    | |
|  +-------------------------------------------------------+ |
|                         |                                  |
|                         v                                  |
|  +-------------------------------------------------------+ |
|  |                   Event Bus                           | |
|  |   docs:api-updated                                    | |
|  |   docs:stale-detected                                 | |
|  +-------------------------------------------------------+ |
+------------------------------------------------------------+
```

### Key Features

- **Dual-framework**: support for Express.js (route-based) and NestJS (decorator-based)
- **OpenAPI Generation**: 3.0.3 skeleton with path parameters, request body, and tags
- **Documentation Coverage**: percentage of exports with JSDoc/TSDoc
- **Stateless Analysis**: no store, direct reading of source files

---

## Tool Table

| Tool | Description | Parameters |
|------|-------------|-----------|
| `extract-endpoints` | Scans a source file to extract API endpoint definitions | `filePath` (string) - Path to the source file |
| `generate-openapi` | Generates an OpenAPI 3.0.3 specification from an array of endpoint definitions | `endpoints` (array of {method, path, description?}); `title` (string); `version` (string) |
| `find-undocumented` | Finds functions and exports lacking JSDoc/TSDoc comments | `filePath` (string) - Path to the source file |

---

## Architecture

### extract-endpoints: Pattern Recognition

The tool uses two parsing strategies in parallel:

```
  Source file
       |
       +--------+--------+
       |                  |
       v                  v
  Express Routes     Decorator Routes
  (regex-based)      (regex-based)
       |                  |
       v                  v
  app.get('/x',h)    @Get('/x')
  router.post(..)    @Post('/x')
  inline handlers    @Controller('/prefix')
       |                  |
       +--------+---------+
                |
                v
          Merge + apply controller prefix
                |
                v
          Endpoint[] { method, path, handlerName, lineNumber }
```

**Recognized Express Patterns:**
- `app.get('/path', handler)` - with named handler
- `router.post('/path', middleware, handler)` - with middleware
- `app.get('/path', (req, res) => {...})` - inline handler

**Recognized Decorator Patterns:**
- `@Get('/path')`, `@Post('/path')`, `@Put`, `@Patch`, `@Delete`
- `@Controller('/prefix')` - prefix applied to all endpoints in the file
- Lookahead for the method name (up to 5 lines after the decorator)

### generate-openapi: Specification Generation

```
  endpoints[] + title + version
       |
       v
  OpenAPI 3.0.3 skeleton
  {
    openapi: "3.0.3",
    info: { title, version, description },
    paths: {
      "/users/{id}": {             <-- :id -> {id} automatic conversion
        "get": {
          summary: "GET /users/:id",
          operationId: "getUsersById",
          tags: ["users"],          <-- extracted from the first path segment
          parameters: [{            <-- automatic path parameters
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" }
          }],
          responses: {
            "200": { description: "Successful operation" },
            "400": { description: "Bad request" },
            "404": { description: "Not found" },
            "500": { description: "Internal server error" }
          }
        }
      }
    }
  }
```

For POST/PUT/PATCH methods, a placeholder `requestBody` with content type
`application/json` is automatically added.

### find-undocumented: Coverage Analysis

```
  Source file
       |
       v
  Search for export patterns:
    export function name
    export default function name
    export class name
    export interface name
    export type name =
    export const name
    export enum name
    export { name1, name2 }  <-- trace to declaration
       |
       v
  For each export found:
    Look back (previous lines)
    Search for /** ... */ (JSDoc/TSDoc)
       |
       +-- Found: isDocumented = true
       +-- Not found: isDocumented = false
            -> Publish docs:stale-detected
       |
       v
  Result:
  {
    totalExports: 10,
    documentedCount: 7,
    undocumentedCount: 3,
    coveragePercent: 70,
    documented: [...],
    undocumented: [...]
  }
```

---

## Event Bus Integration

### Published Events

| Event | Emitted by | Payload | Condition |
|-------|-----------|---------|-----------|
| `docs:api-updated` | `extract-endpoints` | `{ endpoint, method, changes }` | When endpoints are found |
| `docs:stale-detected` | `find-undocumented` | `{ filePath, lastUpdated, reason }` | For each export without JSDoc |

### Subscribed Events

None.

---

## Interactions with Other Servers

```
+---------------------+    docs:api-updated       +-------------------+
| api-documentation   | ----------------------->  | standup-notes     |
|                     |    docs:stale-detected    | agile-metrics     |
+---------------------+ ----------------------->  +-------------------+

+---------------------+                           +-------------------+
| codebase-knowledge  | ---- (exploration) -----> | api-documentation |
|                     |                           | (input: filePath) |
+---------------------+                           +-------------------+
```

| Related Server | Direction | Description |
|----------------|-----------|-------------|
| `codebase-knowledge` | -> input | `search-code` can find route files to pass to `extract-endpoints` |
| `code-review` | complementary | Lack of documentation is a code quality issue |
| `project-scaffolding` | complementary | Express templates generate analyzable routes |
| `http-client` | complementary | Extracted endpoints can be tested directly |
| `standup-notes` | -> (via event) | Receives notification of stale documentation |

---

## Usage Examples

### Endpoint Extraction

**Request:**
```json
{
  "tool": "extract-endpoints",
  "arguments": {
    "filePath": "/home/user/project/src/routes/users.ts"
  }
}
```

**Response:**
```json
{
  "filePath": "/home/user/project/src/routes/users.ts",
  "fileName": "users.ts",
  "totalEndpoints": 4,
  "endpoints": [
    { "method": "GET", "path": "/users", "handlerName": "getAllUsers", "lineNumber": 8 },
    { "method": "GET", "path": "/users/:id", "handlerName": "getUserById", "lineNumber": 15 },
    { "method": "POST", "path": "/users", "handlerName": "createUser", "lineNumber": 22 },
    { "method": "DELETE", "path": "/users/:id", "handlerName": "deleteUser", "lineNumber": 30 }
  ],
  "controllerPrefix": null
}
```

### OpenAPI Generation

**Request:**
```json
{
  "tool": "generate-openapi",
  "arguments": {
    "endpoints": [
      { "method": "GET", "path": "/users", "description": "List all users" },
      { "method": "POST", "path": "/users", "description": "Create a new user" },
      { "method": "GET", "path": "/users/:id", "description": "Get user by ID" }
    ],
    "title": "User Service API",
    "version": "1.0.0"
  }
}
```

**Response (simplified):**
```json
{
  "openapi": "3.0.3",
  "info": { "title": "User Service API", "version": "1.0.0" },
  "paths": {
    "/users": {
      "get": {
        "summary": "List all users",
        "operationId": "getUsers",
        "tags": ["users"],
        "responses": { "200": {}, "400": {}, "404": {}, "500": {} }
      },
      "post": {
        "summary": "Create a new user",
        "operationId": "postUsers",
        "requestBody": { "content": { "application/json": {} } }
      }
    },
    "/users/{id}": {
      "get": {
        "summary": "Get user by ID",
        "operationId": "getUsersById",
        "parameters": [{ "name": "id", "in": "path", "required": true }]
      }
    }
  }
}
```

### Finding Undocumented Code

**Request:**
```json
{
  "tool": "find-undocumented",
  "arguments": {
    "filePath": "/home/user/project/src/services/user.service.ts"
  }
}
```

**Response:**
```json
{
  "fileName": "user.service.ts",
  "totalExports": 5,
  "documentedCount": 3,
  "undocumentedCount": 2,
  "coveragePercent": 60,
  "documented": [
    { "name": "UserService", "type": "class", "lineNumber": 10, "isDocumented": true }
  ],
  "undocumented": [
    { "name": "createUser", "type": "function", "lineNumber": 45, "isDocumented": false },
    { "name": "UserInput", "type": "interface", "lineNumber": 5, "isDocumented": false }
  ]
}
```

---

## Future Developments

- **Directory Scanning**: recursive analysis of all route files in a project
- **Fastify/Koa/Hono Support**: extension to alternative Express frameworks
- **OpenAPI Validation**: verify that an existing specification conforms to the standard
- **Swagger UI Generation**: interactive HTML output for documentation
- **Documentation Diff**: comparison between OpenAPI specification and actual endpoints in the code
- **Automatic JSDoc Generation**: creation of template comments for undocumented exports
- **Integration with `test-generator`**: test generation for each documented endpoint
