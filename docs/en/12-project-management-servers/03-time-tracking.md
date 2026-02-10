# Time Tracking Server

## Overview

The **time-tracking** server manages the tracking of time worked on tasks, with
support for live timers and manual logging. It maintains a persistent state via
SQLite with two tables: one for recorded time entries and one for active timers.

The server implements a double-start protection: it is not possible to have more
than one active timer simultaneously for the same user.

```
+-----------------------------------------------------------------------+
|                     time-tracking server                              |
|                                                                       |
|  +-------------+  +-----------+  +----------+  +-----------------+    |
|  | start-timer |  | stop-timer|  | log-time |  | get-timesheet   |    |
|  |             |  |           |  |          |  |                 |    |
|  | prevents    |  | calculates|  | manual   |  | filter by       |    |
|  | double      |  | duration  |  | minutes  |  | date range      |    |
|  | start       |  | saves     |  | + date   |  |                 |    |
|  +------+------+  +-----+-----+  +----+-----+  +--------+--------+    |
|         |               |             |                 |             |
|         v               v             v                 v             |
|  +-----------------------------------------------------------+        |
|  |                   TimeStore (SQLite)                      |        |
|  |                                                           |        |
|  |  +--------------------+    +-------------------------+    |        |
|  |  | active_timers      |    | time_entries            |    |        |
|  |  | id, taskId, userId |    | id, taskId, userId      |    |        |
|  |  | startTime, desc    |    | startTime, endTime      |    |        |
|  |  +--------------------+    | durationMinutes, desc   |    |        |
|  |                            | date, createdAt         |    |        |
|  |                            +-------------------------+    |        |
|  +-----------------------------------------------------------+        |
|                                                                       |
|  Publishes: time:entry-logged                                         |
|  Subscribes: scrum:task-updated (future: auto-timer)                  |
+-----------------------------------------------------------------------+
```

**Version:** 0.1.0
**Entry point:** `servers/time-tracking/src/index.ts`
**Dependencies:** `@mcp-suite/core`, `@mcp-suite/event-bus`, `@mcp-suite/database`

---

## Tool Table

| Tool | Description | Parameters |
|------|-------------|-----------|
| `start-timer` | Starts a timer for a task (prevents double start) | `taskId` (string): task ID; `description` (string, optional): activity description; `userId` (string, optional): user ID |
| `stop-timer` | Stops the active timer, calculates the duration, and saves the time entry | `userId` (string, optional): user ID |
| `log-time` | Manually logs time worked | `taskId` (string): task ID; `durationMinutes` (number): duration in minutes; `description` (string, optional); `date` (string, optional): ISO date; `userId` (string, optional) |
| `get-timesheet` | Retrieves the timesheet filtered by date range | `userId` (string, optional); `startDate` (string, optional): start date; `endDate` (string, optional): end date |

---

## Tool Details

### start-timer

Starts a new timer for a specific task. The server implements a protection:
if an active timer already exists for the user, the operation fails with an error
message indicating the currently tracked task.

```
  User invokes start-timer(taskId: "TASK-42")
       |
       v
  Check: is there an active timer?
       |
       +--[YES]--> Error: "Active timer for TASK-15. Stop it first."
       |
       +--[NO]--> Creates record in active_timers
                   startTime = new Date().toISOString()
                   Returns { id, taskId, userId, startTime }
```

### stop-timer

Stops the active timer and creates a time entry with automatically calculated duration:

```
  User invokes stop-timer()
       |
       v
  Search for active timer by userId
       |
       +--[NOT FOUND]--> Error: "No active timer found"
       |
       +--[FOUND]
            |
            v
       endTime = new Date().toISOString()
       durationMinutes = Math.round((endMs - startMs) / 60000)
       date = startTime.split('T')[0]
            |
            v
       INSERT INTO time_entries (...)
       DELETE FROM active_timers WHERE id = ?
            |
            v
       Publishes time:entry-logged
       Returns complete TimeEntry
```

### log-time

Manual logging for when the timer was not used. Useful for recording
time after the fact or for activities that do not require real-time tracking.

```json
{
  "tool": "log-time",
  "arguments": {
    "taskId": "TASK-42",
    "durationMinutes": 90,
    "description": "Code review of PR #15",
    "date": "2025-02-07"
  }
}
```

### get-timesheet

Returns the timesheet with optional filters for dates and user:

```json
{
  "entries": [
    {
      "id": 1,
      "taskId": "TASK-42",
      "durationMinutes": 45,
      "description": "API implementation",
      "date": "2025-02-07"
    },
    {
      "id": 2,
      "taskId": "TASK-43",
      "durationMinutes": 90,
      "description": "Code review",
      "date": "2025-02-07"
    }
  ],
  "totalMinutes": 135
}
```

---

## Architecture

```
index.ts
  |
  +-- server.ts (createTimeTrackingServer)
  |     |
  |     +-- creates TimeStore
  |     +-- registers 4 tools
  |     +-- setupCollaborationHandlers(eventBus, store)
  |
  +-- services/
  |     +-- time-store.ts  --> TimeStore
  |
  +-- tools/
  |     +-- start-timer.ts
  |     +-- stop-timer.ts
  |     +-- log-time.ts
  |     +-- get-timesheet.ts
  |
  +-- collaboration.ts  --> event handlers
```

### TimeStore

**`time_entries` table schema:**

| Column | Type | Notes |
|---------|------|------|
| `id` | INTEGER PK | Auto-increment |
| `taskId` | TEXT NN | Task ID |
| `userId` | TEXT | Default 'default' |
| `startTime` | TEXT | Nullable (null for manual logs) |
| `endTime` | TEXT | Nullable (null for manual logs) |
| `durationMinutes` | INTEGER NN | Duration in minutes |
| `description` | TEXT | Nullable |
| `date` | TEXT NN | ISO date (YYYY-MM-DD) |
| `createdAt` | TEXT NN | datetime('now') |

**`active_timers` table schema:**

| Column | Type | Notes |
|---------|------|------|
| `id` | INTEGER PK | Auto-increment |
| `taskId` | TEXT NN | Task ID |
| `userId` | TEXT | Default 'default' |
| `startTime` | TEXT NN | ISO start timestamp |
| `description` | TEXT | Nullable |

The TimeStore also offers additional methods not exposed as tools:
- `getTaskTime(taskId)` - total time for a specific task
- `editEntry(id, updates)` - modifies an existing time entry
- `deleteEntry(id)` - deletes a time entry

---

## Event Bus Integration

### Published Events

| Event | Payload | Emitted by |
|--------|---------|-----------|
| `time:entry-logged` | `{ taskId, userId, durationMinutes, date }` | `stop-timer`, `log-time` |

### Subscribed Events

| Event | Source | Action |
|--------|----------|--------|
| `scrum:task-updated` | scrum-board | (Future) Automatic timer start/stop on task status change |

---

## Interactions with Other Servers

```
+------------------+     scrum:task-updated       +------------------+
| scrum-board      | ---------------------------> | time-tracking    |
+------------------+                              |                  |
                                                  |  time:entry-     |
+------------------+     time:entry-logged        |  logged          |
| project-economics| <--------------------------- |                  |
+------------------+                              +------------------+
```

- **scrum-board (input):** a task status change could in the future automatically
  start/stop the timer
- **project-economics (output):** time entries feed the project cost calculation
  when the economics server subscribes to `time:entry-logged`

---

## Usage Examples

### Complete flow with timer

```json
// 1. Start the timer
{ "tool": "start-timer", "arguments": { "taskId": "TASK-42", "description": "Login feature development" } }

// 2. ... work on the task ...

// 3. Stop the timer
{ "tool": "stop-timer", "arguments": {} }

// 4. Check the weekly timesheet
{ "tool": "get-timesheet", "arguments": { "startDate": "2025-02-03", "endDate": "2025-02-07" } }
```

### Manual logging

```json
{
  "tool": "log-time",
  "arguments": {
    "taskId": "TASK-50",
    "durationMinutes": 120,
    "description": "Sprint planning meeting",
    "date": "2025-02-03"
  }
}
```

---

## Future Developments

- **Auto-timer on task status:** automatically start the timer when a task moves
  to `in_progress` and stop it when it moves to `in_review` or `done`
- **Automatic weekly reports:** generate aggregated reports by user and project
- **Integration with project-economics:** convert minutes to costs based on the hourly
  rate defined in the budget
- **Pomodoro mode:** support for Pomodoro timers with scheduled breaks
- **Overtime notifications:** alert when time on a task exceeds the estimate
- **Productivity analysis:** time distribution charts by activity category
- **Multi-user:** full team support with comparative reports
- **Timesheet export:** export in CSV format or compatible with billing tools
