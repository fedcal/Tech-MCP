# Retrospective Manager Server

## Overview

The **retrospective-manager** server manages the complete cycle of agile retrospectives:
from creating a session with a specific format, to collecting feedback by category,
to the voting system, to the automatic generation of action items from the most
voted themes.

It supports three standard retrospective formats, each with its own categories:

```
  +------------------------+   +---------------------+   +-----------------------+
  |   MAD - SAD - GLAD     |   |         4Ls         |   | START - STOP - CONT.  |
  +------------------------+   +---------------------+   +-----------------------+
  |  mad: what made you    |   | liked: what we       |   | start: what to start  |
  |       angry            |   | liked                |   | stop: what to stop    |
  |  sad: what made you    |   | learned: what we     |   | continue: what to     |
  |       sad              |   | learned              |   | keep doing            |
  |  glad: what made you   |   | lacked: what was     |   |                       |
  |        happy           |   | missing              |   |                       |
  |                        |   | longed-for: what we  |   |                       |
  |                        |   | wished for           |   |                       |
  +------------------------+   +---------------------+   +-----------------------+
```

The server is one of the most active in the MCP Suite's collaboration network:
it publishes action items that are picked up by the scrum-board and subscribes to events
to create retrospectives automatically at the end of a sprint or after failed builds.

```
+------------------------------------------------------------------------------+
|                 retrospective-manager server                                 |
|                                                                              |
|  +-------------+ +----------+ +-----------+ +------------------+ +---------+ |
|  |create-retro | |add-retro-| |vote-retro-| |generate-action-  | |get-retro| |
|  |             | |item      | |item       | |items             | |         | |
|  | 3 formats   | | validat. | | +1 vote   | | top-N voted      | |         | |
|  | categories  | | per cat. | |           | | create action    | |         | |
|  +------+------+ +----+-----+ +-----+-----+ +--------+---------+ +----+----+ |
|         |             |             |                |                |      |
|         v             v             v                v                v      |
|  +----------------------------------------------------------------------+    |
|  |                   RetroStore (SQLite)                                |    |
|  |                                                                      |    |
|  |  +----------+         +-------------+          +------------------+  |    |
|  |  | retros   |         | retro_items |          | action_items     |  |    |
|  |  | id       |         | id          |          | id               |  |    |
|  |  | sprintId |         | retroId(FK) |          | retroId (FK)     |  |    |
|  |  | format   |         | category    |          | description      |  |    |
|  |  | status   |         | content     |          | assignee         |  |    |
|  |  | createdAt|         | votes       |          | dueDate, status  |  |    |
|  |  +----------+         | authorId    |          | createdAt        |  |    |
|  |                       +-------------+          +------------------+  |    |
|  +----------------------------------------------------------------------+    |
|                                                                              |
|  Publishes: retro:action-item-created                                        |
|  Subscribes: scrum:sprint-completed, cicd:build-failed                       |
+------------------------------------------------------------------------------+
```

**Version:** 0.1.0
**Entry point:** `servers/retrospective-manager/src/index.ts`
**Dependencies:** `@mcp-suite/core`, `@mcp-suite/event-bus`, `@mcp-suite/database`

---

## Tool Table

| Tool | Description | Parameters |
|------|-------------|-----------|
| `create-retro` | Creates a new retrospective with a specific format | `format` (enum: `mad-sad-glad`, `4ls`, `start-stop-continue`); `sprintId` (string, optional) |
| `add-retro-item` | Adds an item to the retrospective (with category validation) | `retroId` (number); `category` (string): must be valid for the format; `content` (string); `authorId` (string, optional) |
| `vote-retro-item` | Adds a vote to an item | `itemId` (number) |
| `generate-action-items` | Generates action items from the most voted items | `retroId` (number); `topN` (number, default: 3): how many items to consider |
| `get-retro` | Retrieves the complete retrospective with items and action items | `retroId` (number) |

---

## Tool Details

### create-retro

Creates a new retrospective with the specified format. Valid categories are
automatically determined by the format:

| Format | Valid Categories |
|---------|-----------------|
| `mad-sad-glad` | `mad`, `sad`, `glad` |
| `4ls` | `liked`, `learned`, `lacked`, `longed-for` |
| `start-stop-continue` | `start`, `stop`, `continue` |

```json
{
  "tool": "create-retro",
  "arguments": {
    "format": "mad-sad-glad",
    "sprintId": "sprint-14"
  }
}
```

### add-retro-item

Adds an item to the retrospective. The server **validates the category** by verifying
that it is consistent with the retrospective format. If the category is not valid,
it returns an error with the list of allowed categories.

```
  add-retro-item(retroId: 1, category: "happy", content: "...")
       |
       v
  Check retro #1 format = "mad-sad-glad"
  Valid categories: ["mad", "sad", "glad"]
  "happy" is NOT valid
       |
       v
  Error: 'Invalid category "happy" for format "mad-sad-glad".
           Valid categories: mad, sad, glad'
```

### vote-retro-item

Increments the `votes` counter of an item by 1. There is no limit to the number of
votes an item can receive (open voting).

### generate-action-items

Selects the top-N most voted items of the retrospective and generates an action item
for each one. The action item description includes the original category as a
prefix: `[category] content`.

```
  Top 3 voted --> Action Items:
  1. [mad] Deploy too slow (8 votes)
  2. [sad] Missing documentation (6 votes)
  3. [glad] Code review improves quality (5 votes)
```

Each generated action item publishes the `retro:action-item-created` event, which is
intercepted by the scrum-board to create tasks in the backlog.

### get-retro

Returns the complete retrospective in `FullRetro` format:

```json
{
  "retro": { "id": 1, "format": "mad-sad-glad", "status": "active" },
  "categories": {
    "mad": [{ "id": 1, "content": "Slow deploy", "votes": 8 }],
    "sad": [{ "id": 2, "content": "Missing documentation", "votes": 6 }],
    "glad": [{ "id": 3, "content": "Effective code reviews", "votes": 5 }]
  },
  "actionItems": [{ "id": 1, "description": "[mad] Slow deploy", "status": "open" }]
}
```

---

## Architecture

```
index.ts
  |
  +-- server.ts (createRetrospectiveManagerServer)
  |     |
  |     +-- creates RetroStore
  |     +-- registers 5 tools
  |     +-- setupCollaborationHandlers(eventBus, store)
  |
  +-- services/
  |     +-- retro-store.ts  --> RetroStore
  |
  +-- tools/
  |     +-- create-retro.ts
  |     +-- add-item.ts
  |     +-- vote-item.ts
  |     +-- generate-action-items.ts
  |     +-- get-retro.ts
  |
  +-- collaboration.ts  --> cross-server event handlers
```

### RetroStore

**`retros` table schema:**

| Column | Type | Notes |
|---------|------|------|
| `id` | INTEGER PK | Auto-increment |
| `sprintId` | TEXT | Nullable, sprint link |
| `format` | TEXT NN | 'mad-sad-glad', '4ls', 'start-stop-continue' |
| `status` | TEXT NN | Default 'active' |
| `createdAt` | TEXT NN | datetime('now') |

**`retro_items` table schema:**

| Column | Type | Notes |
|---------|------|------|
| `id` | INTEGER PK | Auto-increment |
| `retroId` | INTEGER FK NN | Reference to retros(id) |
| `category` | TEXT NN | Validated by format |
| `content` | TEXT NN | Item text |
| `votes` | INTEGER NN | Default 0 |
| `authorId` | TEXT | Nullable |

**`action_items` table schema:**

| Column | Type | Notes |
|---------|------|------|
| `id` | INTEGER PK | Auto-increment |
| `retroId` | INTEGER FK NN | Reference to retros(id) |
| `description` | TEXT NN | Action item description |
| `assignee` | TEXT | Nullable |
| `dueDate` | TEXT | Nullable |
| `status` | TEXT NN | Default 'open' |
| `createdAt` | TEXT NN | datetime('now') |

The `FORMAT_CATEGORIES` constant maps each format to its valid categories, used
for validation in `addItem()`.

---

## Event Bus Integration

### Published Events

| Event | Payload | Emitted by |
|--------|---------|-----------|
| `retro:action-item-created` | `{ retroId, actionItemId, description, assignee }` | `generate-action-items` |

### Subscribed Events

| Event | Source | Action |
|--------|----------|--------|
| `scrum:sprint-completed` | scrum-board | Automatically creates a new retrospective for the just-completed sprint |
| `cicd:build-failed` | cicd-monitor | Automatically adds a "build failed" item in the appropriate category of the active retro |

---

## Interactions with Other Servers

```
                scrum:sprint-completed
  scrum-board --------------------------> retrospective-manager
                                                |
                retro:action-item-created       |
  scrum-board <--------------------------       |
  (creates task                                 |
   in backlog)                                  |
                                                |
                cicd:build-failed               |
  cicd-monitor --------------------------->     |
```

The bidirectional flow with scrum-board is one of the most important feedback loops
of the MCP Suite:

1. The sprint completes --> scrum-board publishes `scrum:sprint-completed`
2. The retrospective-manager automatically creates a retro
3. The team adds items and votes
4. The generated action items are published as `retro:action-item-created`
5. The scrum-board receives the event and creates tasks in the backlog

---

## Usage Examples

### Complete retrospective workflow

```json
// 1. Create the retrospective
{ "tool": "create-retro", "arguments": { "format": "start-stop-continue", "sprintId": "sprint-14" } }

// 2. Collect feedback
{ "tool": "add-retro-item", "arguments": { "retroId": 1, "category": "start", "content": "Weekly pair programming" } }
{ "tool": "add-retro-item", "arguments": { "retroId": 1, "category": "stop", "content": "Deploying on Fridays" } }
{ "tool": "add-retro-item", "arguments": { "retroId": 1, "category": "continue", "content": "Systematic code reviews" } }

// 3. Vote
{ "tool": "vote-retro-item", "arguments": { "itemId": 2 } }
{ "tool": "vote-retro-item", "arguments": { "itemId": 2 } }
{ "tool": "vote-retro-item", "arguments": { "itemId": 1 } }

// 4. Generate action items (top 2)
{ "tool": "generate-action-items", "arguments": { "retroId": 1, "topN": 2 } }

// 5. View the complete result
{ "tool": "get-retro", "arguments": { "retroId": 1 } }
```

---

## Future Developments

- **Customizable formats:** definition of custom formats with arbitrary categories
- **Guaranteed anonymity:** anonymous mode without authorId tracking
- **Phase timers:** configurable timer for collection, voting, and discussion phases
- **Retrospective history:** compare action items across different sprints
- **Sentiment analysis:** tone analysis of feedback for team emotional trends
- **Standup integration:** open action items mentioned in standup reports
- **Metrics:** track how many action items are completed between sprints
