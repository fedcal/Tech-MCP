# Scrum Board Server -- CENTRAL HUB

## Overview

The **scrum-board** server is the **operational heart** of the entire MCP Suite. It manages sprints,
user stories, and tasks according to the Scrum methodology, acting as a central hub through
which most collaborative workflows pass. Virtually every other project management server
interacts with scrum-board, either directly or through the events it publishes.

```
                        +---------------------------+
                        |     SCRUM-BOARD SERVER    |
                        |        CENTRAL HUB        |
                        +---------------------------+
                       /     |       |        |      \
                      /      |       |        |       \
                     v       v       v        v        v
              +-------+ +-------+ +------+ +-------+ +-------+
              |agile  | |time   | |retro | |standup| |project|
              |metrics| |track. | |mgr   | |notes  | |econ.  |
              +-------+ +-------+ +------+ +-------+ +-------+

  scrum:task-updated -----> [all subscribed servers]
  scrum:sprint-started ---> [agile-metrics, retro, standup]
  retro:action-item ------> [scrum-board receives]
```

The server is the main **event producer** of the suite and one of the few that
**subscribes** to events from other servers (receives action items from retrospectives).

**Version:** 0.1.0
**Entry point:** `servers/scrum-board/src/index.ts`
**Dependencies:** `@mcp-suite/core`, `@mcp-suite/event-bus`, `@mcp-suite/database`

---

## Tool Table

| Tool | Description | Parameters |
|------|-------------|-----------|
| `create-sprint` | Creates a new sprint | `name` (string): sprint name; `startDate` (string): start date; `endDate` (string): end date; `goals` (string[]): sprint goals |
| `get-sprint` | Retrieves the details of a sprint | `sprintId` (number): sprint ID |
| `create-story` | Creates a new user story | `title` (string); `description` (string); `acceptanceCriteria` (string[]); `storyPoints` (number); `priority` (string); `sprintId` (number, optional) |
| `create-task` | Creates a new task associated with a story | `title` (string); `description` (string); `storyId` (number); `assignee` (string, optional) |
| `update-task-status` | Updates the status of a task | `taskId` (number); `status` (enum: todo/in_progress/in_review/done/blocked) |
| `sprint-board` | Kanban view of the current sprint | `sprintId` (number, optional; default: active sprint) |
| `get-backlog` | Retrieves all stories not assigned to a sprint | No parameters |

---

## Tool Details

### create-sprint

Creates a new sprint in the database with an initial status of `planning`. Goals are stored
as a JSON array.

```json
{
  "tool": "create-sprint",
  "arguments": {
    "name": "Sprint 14 - Authentication",
    "startDate": "2025-02-03",
    "endDate": "2025-02-14",
    "goals": [
      "Implement OAuth login",
      "Add 2FA",
      "Security testing"
    ]
  }
}
```

### update-task-status

Updates the status of a task through the Kanban flow:

```
  +-------+     +-------------+     +-----------+     +------+
  | todo  | --> | in_progress | --> | in_review | --> | done |
  +-------+     +-------------+     +-----------+     +------+
      |               |                   |
      +-------+-------+-------------------+
              |
              v
          +--------+
          | blocked|
          +--------+
```

Each status change publishes the `scrum:task-updated` event, which triggers chain reactions
in the other servers.

### sprint-board

Generates a complete Kanban view of the sprint, organizing tasks into columns:

```
+--------------------------------------------------------------------+
|                   Sprint Board: Sprint 14                          |
+--------------------------------------------------------------------+
| TODO          | IN PROGRESS   | IN REVIEW     | DONE    | BLOCKED  |
|---------------|---------------|---------------|---------|----------|
| Task: Setup   | Task: Login   | Task: Test    | Task:   | Task:    |
|   OAuth       |   form UI     |   OAuth flow  |  DB     |  Deploy  |
|               |               |               | schema  |  (needs  |
| Task: 2FA     | Task: Token   |               |         |  infra)  |
|   research    |   refresh     |               |         |          |
+--------------------------------------------------------------------+
```

If no `sprintId` is specified, it automatically retrieves the sprint with `active` status.

### get-backlog

Returns all stories with `sprintId IS NULL`, sorted by priority and creation date.
Represents the product backlog not yet planned.

---

## Architecture

```
index.ts
  |
  +-- server.ts (createScrumBoardServer)
  |     |
  |     +-- creates ScrumStore
  |     +-- registers 7 tools
  |     +-- setupCollaborationHandlers(eventBus, store)
  |
  +-- services/
  |     +-- scrum-store.ts  --> ScrumStore (manages sprints, stories, tasks)
  |
  +-- tools/
  |     +-- create-sprint.ts
  |     +-- get-sprint.ts
  |     +-- create-story.ts
  |     +-- create-task.ts
  |     +-- update-task-status.ts
  |     +-- sprint-board.ts
  |     +-- get-backlog.ts
  |
  +-- collaboration.ts  --> cross-server event handlers
```

### ScrumStore

The store manages three SQLite tables interconnected through foreign keys:

```
+------------------+       +-------------------+       +------------------+
|     sprints      |       |      stories      |       |      tasks       |
+------------------+       +-------------------+       +------------------+
| id (PK)          |<------| sprintId (FK)     |       | id (PK)          |
| name             |       | id (PK)           |<------| storyId (FK, NN) |
| startDate        |       | title             |       | sprintId (FK)    |
| endDate          |       | description       |       | title            |
| goals (JSON)     |       | acceptanceCriteria|       | description      |
| status           |       | storyPoints       |       | status           |
| createdAt        |       | priority          |       | assignee         |
+------------------+       | status            |       | createdAt        |
                           | createdAt         |       | updatedAt        |
                           | updatedAt         |       +------------------+
                           +-------------------+
```

**Table schema:**

| Table | Column | Type | Notes |
|---------|---------|------|------|
| sprints | id | INTEGER PK | Auto-increment |
| sprints | name | TEXT NN | Sprint name |
| sprints | startDate | TEXT NN | Start date ISO |
| sprints | endDate | TEXT NN | End date ISO |
| sprints | goals | TEXT NN | JSON array, default '[]' |
| sprints | status | TEXT NN | Default 'planning' |
| sprints | createdAt | TEXT NN | datetime('now') |
| stories | id | INTEGER PK | Auto-increment |
| stories | title | TEXT NN | Story title |
| stories | description | TEXT NN | Default '' |
| stories | acceptanceCriteria | TEXT NN | JSON array |
| stories | storyPoints | INTEGER NN | Default 0 |
| stories | priority | TEXT NN | Default 'medium' |
| stories | status | TEXT NN | Default 'todo' |
| stories | sprintId | INTEGER FK | Reference to sprints(id), nullable |
| tasks | id | INTEGER PK | Auto-increment |
| tasks | title | TEXT NN | Task title |
| tasks | description | TEXT NN | Default '' |
| tasks | status | TEXT NN | Default 'todo' |
| tasks | assignee | TEXT | Nullable |
| tasks | storyId | INTEGER FK NN | Reference to stories(id) |
| tasks | sprintId | INTEGER FK | Derived from the story, nullable |

**Note:** when a task is created, the `sprintId` is automatically derived
from the parent story.

---

## Event Bus Integration

### Published Events

| Event | Payload | Emitted by |
|--------|---------|-----------|
| `scrum:sprint-started` | `{ sprintId, name, startDate, endDate }` | `create-sprint` |
| `scrum:task-updated` | `{ taskId, status, previousStatus, storyId, sprintId }` | `update-task-status` |

### Subscribed Events

| Event | Source | Action |
|--------|----------|--------|
| `retro:action-item-created` | retrospective-manager | Automatically creates a task in the backlog from the retrospective action item |

### Event Flow

```
  scrum-board                    other servers
  -----------                    -------------

  create-sprint
       |
       +---> scrum:sprint-started ---> agile-metrics (new velocity)
                                  ---> retrospective-manager (trigger retro)
                                  ---> standup-notes (contextualize report)

  update-task-status
       |
       +---> scrum:task-updated -----> agile-metrics (recalculate burndown)
                                  ---> time-tracking (future: auto-timer)
                                  ---> standup-notes (auto-log activity)
                                  ---> project-economics (track costs)

  [receives] retro:action-item-created
       |
       +---> automatically creates task in backlog
```

---

## Interactions with Other Servers

The scrum-board is the server with the most interactions:

| Server | Type | Description |
|--------|------|-------------|
| agile-metrics | Publishes to | Provides data for velocity, burndown, cycle time |
| time-tracking | Publishes to | Trigger for auto-timer on task status change |
| retrospective-manager | Bidirectional | Receives action items, publishes sprint completion |
| standup-notes | Publishes to | Task updates feed automatic standups |
| project-economics | Publishes to | Sprint completion triggers cost analysis |

---

## Usage Examples

### Complete sprint workflow

```json
// 1. Create the sprint
{ "tool": "create-sprint", "arguments": { "name": "Sprint 14", "startDate": "2025-02-03", "endDate": "2025-02-14", "goals": ["Login feature"] } }

// 2. Create a story
{ "tool": "create-story", "arguments": { "title": "Google OAuth Login", "description": "As a user I want to...", "acceptanceCriteria": ["Redirect to Google", "Token saved", "Session active"], "storyPoints": 8, "priority": "high", "sprintId": 1 } }

// 3. Create tasks for the story
{ "tool": "create-task", "arguments": { "title": "Configure OAuth credentials", "description": "Setup on Google Cloud Console", "storyId": 1, "assignee": "mario" } }

// 4. Update the status
{ "tool": "update-task-status", "arguments": { "taskId": 1, "status": "in_progress" } }

// 5. View the board
{ "tool": "sprint-board", "arguments": { "sprintId": 1 } }

// 6. Check the backlog
{ "tool": "get-backlog", "arguments": {} }
```

---

## Future Developments

- **Automatic sprint planning:** suggest stories from the backlog based on historical
  velocity calculated by agile-metrics
- **Block notifications:** when a task moves to `blocked`, automatically notify
  the team via standup-notes
- **Integrated velocity tracking:** automatically calculate the velocity of each sprint
  at the time of closure
- **Task dependencies:** support `blocks/blocked-by` relationships between tasks
- **Smart assignment:** suggest the assignee based on current workload
  tracked by time-tracking
- **Automatic burndown:** generate real-time burndown data on every task
  status change
- **GitHub/GitLab integration:** link tasks to pull requests and branches
