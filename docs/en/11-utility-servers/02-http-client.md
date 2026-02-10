# HTTP Client Server

## Overview

The **http-client** server is a complete HTTP client integrated into the MCP Suite. It allows
sending HTTP requests with any method, comparing responses between different endpoints,
and generating equivalent curl commands. It uses the native Node.js `fetch()` API
with timeout management via `AbortController` and automatic JSON serialization.

The server is **stateless**, it has no database or store. It does not publish or subscribe
to events from the Event Bus. Each request is independent and self-contained.

```
+-------------------------------------------------------------------+
|                      http-client server                           |
|                                                                   |
|  +----------------+   +-------------------+   +-----------------+ |
|  | send-request   |   | compare-responses |   | generate-curl   | |
|  |                |   |                   |   |                 | |
|  | - HTTP methods |   | - diff status     |   | - single-line   | |
|  | - headers      |   | - diff headers    |   | - multi-line    | |
|  | - JSON body    |   | - diff body       |   | - shell escape  | |
|  | - query params |   | - diff duration   |   |                 | |
|  | - timeout      |   |                   |   |                 | |
|  | - AbortCtrl    |   |                   |   |                 | |
|  +----------------+   +-------------------+   +-----------------+ |
|                                                                   |
|              No events -- Uses native fetch -- Stateless          |
+-------------------------------------------------------------------+
```

**Version:** 0.1.0
**Entry point:** `servers/http-client/src/index.ts`
**Dependencies:** `@mcp-suite/core`, `@mcp-suite/event-bus`

---

## Tool Table

| Tool | Description | Parameters |
|------|-------------|-----------|
| `send-request` | Executes an HTTP request and returns status, headers, body, and duration | `method` (enum: GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS); `url` (string, valid URL); `headers` (Record, optional); `body` (string or object, optional); `queryParams` (Record, optional); `timeoutMs` (number, default: 30000) |
| `compare-responses` | Executes two requests and compares status, headers, body, and duration | Parameters for the two requests to compare |
| `generate-curl` | Generates a curl command equivalent to the specified request | Request parameters; format options (single-line, multi-line) |

---

## Tool Details

### send-request

The main tool of the server. It builds and executes a complete HTTP request with the
following characteristics:

**Execution Flow:**

```
  Input parameters
       |
       v
  URL construction with query params
       |
       v
  Header preparation
  (auto Content-Type: application/json if body is an object)
       |
       v
  AbortController creation with timeout
       |
       v
  fetch() with performance.now() measurement
       |
       v
  Response header extraction
       |
       v
  Body parsing (auto-detect JSON)
       |
       v
  Structured output: { status, statusText, headers, body, durationMs }
```

**Automatic Body Handling:**
- If `body` is a JavaScript object, it is serialized with `JSON.stringify()`
- The `Content-Type: application/json` header is automatically added if not present
- For `GET` and `HEAD` methods, the body is ignored

**Timeout Handling:**
- Uses native `AbortController`
- Default: 30000ms (30 seconds)
- On timeout, returns a structured error with `AbortError`

**Structured Response:**

```json
{
  "status": 200,
  "statusText": "OK",
  "headers": {
    "content-type": "application/json",
    "x-request-id": "abc123"
  },
  "body": { "data": "..." },
  "durationMs": 145.23
}
```

### compare-responses

Executes two HTTP requests and produces a detailed comparison that includes:

- **Status:** HTTP status code comparison
- **Headers:** differences between response headers
- **Body:** structural differences in the body (size, JSON keys)
- **Duration:** response time comparison in milliseconds

Useful for:
- Verifying that two environments (staging vs production) respond the same way
- Comparing different versions of an API
- A/B testing on different endpoints

### generate-curl

Generates a `curl` command equivalent to the specified request, available in two formats:

**Single-line:**
```bash
curl -X POST 'https://api.example.com/users' -H 'Content-Type: application/json' -d '{"name":"Mario"}'
```

**Multi-line (readable):**
```bash
curl -X POST \
  'https://api.example.com/users' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Mario"
  }'
```

Includes correct shell escaping for values containing special characters.

---

## Architecture

```
index.ts
  |
  +-- server.ts (createHttpClientServer)
        |
        +-- tools/send-request.ts       --> URL building + fetch() + timing
        +-- tools/compare-responses.ts  --> dual fetch + diff computation
        +-- tools/generate-curl.ts      --> curl command generation + escaping
```

The server has no internal services. It exclusively uses the native `fetch()` API from
Node.js 18+ without external dependencies like `axios` or `got`.

---

## Event Bus Integration

The server **does not publish** and **does not subscribe to** any events. Each request is
completely isolated and produces no side effects in the system.

---

## Interactions with Other Servers

```
+------------------+                         +------------------+
| api-documentation| ---- (manual) -------> | http-client      |
| (generates API   |                         | (tests endpoints)|
|  docs)           |                         |                  |
+------------------+                         +------------------+
                                                    ^
+------------------+                                |
| environment-mgr  | ---- (manual) -----------------+
| (provides URLs   |
|  and env vars)   |
+------------------+
```

- **api-documentation:** after documenting an API, use `http-client` to verify
  that endpoints respond as documented
- **environment-manager:** obtain URLs and tokens from environments to use in requests

---

## Usage Examples

### GET Request with Query Params

```json
{
  "tool": "send-request",
  "arguments": {
    "method": "GET",
    "url": "https://api.example.com/users",
    "queryParams": { "page": "1", "limit": "10" },
    "headers": { "Authorization": "Bearer token123" },
    "timeoutMs": 5000
  }
}
```

### POST Request with JSON Body

```json
{
  "tool": "send-request",
  "arguments": {
    "method": "POST",
    "url": "https://api.example.com/users",
    "body": { "name": "Mario Rossi", "email": "mario@example.com" },
    "headers": { "Authorization": "Bearer token123" }
  }
}
```

The `Content-Type: application/json` is added automatically.

### Compare Two Environments

```json
{
  "tool": "compare-responses",
  "arguments": {
    "requestA": {
      "method": "GET",
      "url": "https://staging.api.com/health"
    },
    "requestB": {
      "method": "GET",
      "url": "https://production.api.com/health"
    }
  }
}
```

### Generate a Curl Command

```json
{
  "tool": "generate-curl",
  "arguments": {
    "method": "POST",
    "url": "https://api.example.com/data",
    "headers": { "Content-Type": "application/json", "X-API-Key": "key123" },
    "body": { "query": "SELECT * FROM users" }
  }
}
```

---

## Future Developments

- **Request Collections:** save sets of requests as reusable "collections"
  (similar to Postman)
- **Environment Variables:** native integration with `environment-manager` to substitute
  placeholders in URLs and headers
- **Request Chaining:** execute sequences of requests where the output of one feeds
  the input of the next (e.g., login -> use token -> call API)
- **Mock Server:** generate a local mock server based on captured responses
- **Retry with Backoff:** support for automatic retries with exponential backoff
- **Aggregate Metrics:** collect latency and error rate statistics for series
  of repeated requests
- **GraphQL Support:** dedicated tool for GraphQL queries/mutations with schema
  auto-completion
- **WebSocket:** support for bidirectional WebSocket connections
