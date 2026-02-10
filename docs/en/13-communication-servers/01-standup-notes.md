# Standup Notes Server

## Overview

The **standup-notes** server manages the recording and aggregation of daily standup
meetings. It follows the classic Scrum format with three fundamental questions: what did
you do yesterday, what will you do today, are there any blockers? Beyond simple recording,
it offers automatic generation of structured status reports that aggregate standup
information over a configurable period.

```
+------------------------------------------------------------------------+
|                      standup-notes server                              |
|                                                                        |
|  +--------------+   +-------------------+   +------------------------+ |
|  | log-standup  |   | get-standup-      |   | generate-status-report | |
|  |              |   | history           |   |                        | |
|  | yesterday    |   | last N days       |   | accomplishments        | |
|  | today        |   |                   |   | current work           | |
|  | blockers     |   |                   |   | blockers               | |
|  +------+-------+   +--------+----------+   +-----------+------------+ |
|         |                    |                           |             |
|         v                    v                           v             |
|  +------------------------------------------------------------+        |
|  |                  StandupStore (SQLite)                     |        |
|  |                                                            |        |
|  |  +------------------------------------------------------+  |        |
|  |  | standups                                             |  |        |
|  |  | id | userId | date | yesterday | today | blockers    |  |        |
|  |  | createdAt                                            |  |        |
|  |  +------------------------------------------------------+  |        |
|  +------------------------------------------------------------+        |
|                                                                        |
|  Publishes: standup:report-generated                                   |
|  Subscribes: scrum:task-updated, cicd:build-failed                     |
+------------------------------------------------------------------------+
```

**Version:** 0.1.0
**Entry point:** `servers/standup-notes/src/index.ts`
**Dependencies:** `@mcp-suite/core`, `@mcp-suite/event-bus`, `@mcp-suite/database`

---

## Tool Table

| Tool | Description | Parameters |
|------|-------------|-----------|
| `log-standup` | Records the daily standup | `yesterday` (string): what was done yesterday; `today` (string): what will be done today; `blockers` (string, optional): current blockers |
| `get-standup-history` | Retrieves the standup history | `days` (number, default: 7): number of days to retrieve |
| `generate-status-report` | Generates a structured report aggregating standups | `days` (number, default: 7): report period in days |

---

## Tool Details

### log-standup

Records a new standup with an automatic date (current day). The userId is set
to `'default'` for the current version (single-user).

```json
{
  "tool": "log-standup",
  "arguments": {
    "yesterday": "Completed OAuth login API implementation, code review PR #42",
    "today": "Start 2FA integration, fix expired session bug",
    "blockers": "Waiting for OAuth credentials from the infrastructure team"
  }
}
```

The tool publishes the `standup:report-generated` event after recording to notify
other servers.

### get-standup-history

Retrieves standups from the last N days, sorted by date in descending order. The query
filters by `date >= cutoffDate` where the cutoff date is calculated as
`today - N days`.

```json
{
  "tool": "get-standup-history",
  "arguments": { "days": 5 }
}
```

**Output:**
```json
[
  {
    "id": 5,
    "userId": "default",
    "date": "2025-02-07",
    "yesterday": "Fix session bug",
    "today": "2FA integration test",
    "blockers": null,
    "createdAt": "2025-02-07T09:00:00Z"
  },
  {
    "id": 4,
    "userId": "default",
    "date": "2025-02-06",
    "yesterday": "2FA implementation",
    "today": "Fix expired session bug",
    "blockers": "OAuth credentials pending"
  }
]
```

### generate-status-report

Aggregates all standups from a period and generates a structured report with three sections:

```
=== Status Report ===
Period: 2025-02-03 to 2025-02-07 (7 days)
Total standups: 5

--- Accomplishments ---
  - [2025-02-07] 2FA integration test completed
  - [2025-02-06] Fix expired session bug
  - [2025-02-05] 2FA implementation
  - [2025-02-04] Code review PR #42
  - [2025-02-03] OAuth login API implementation

--- Current Work ---
  - [2025-02-07] Staging deploy preparation

--- Blockers ---
  - [2025-02-06] OAuth credentials pending
```

**Programmatic output structure:**

```json
{
  "period": { "from": "2025-02-03", "to": "2025-02-07", "days": 7 },
  "totalStandups": 5,
  "accomplishments": ["[2025-02-07] 2FA integration test...", "..."],
  "currentWork": ["[2025-02-07] Staging deploy preparation..."],
  "blockers": ["[2025-02-06] OAuth credentials..."],
  "report": "=== Status Report ===\n..."
}
```

The output includes both structured data (arrays for each section) and the
formatted report as a readable string.

---

## Architecture

```
index.ts
  |
  +-- server.ts (createStandupNotesServer)
  |     |
  |     +-- creates StandupStore
  |     +-- registers 3 tools
  |     +-- setupCollaborationHandlers(eventBus, store)
  |
  +-- services/
  |     +-- standup-store.ts  --> StandupStore
  |
  +-- tools/
  |     +-- log-standup.ts
  |     +-- get-standup-history.ts
  |     +-- generate-status-report.ts
  |
  +-- collaboration.ts  --> cross-server event handlers
```

### StandupStore

**`standups` table schema:**

| Column | Type | Notes |
|---------|------|------|
| `id` | INTEGER PK | Auto-increment |
| `userId` | TEXT NN | Default 'default' |
| `date` | TEXT NN | ISO date (YYYY-MM-DD), automatically generated |
| `yesterday` | TEXT NN | What was done yesterday |
| `today` | TEXT NN | What will be done today |
| `blockers` | TEXT | Nullable |
| `createdAt` | TEXT NN | datetime('now') |

The main store methods are:
- `logStandup(yesterday, today, blockers?)` - records and returns the standup
- `getStandupHistory(days)` - retrieves recent standups
- `generateStatusReport(days)` - aggregates and produces the report

---

## Event Bus Integration

### Published Events

| Event | Payload | Emitted by |
|--------|---------|-----------|
| `standup:report-generated` | `{ period, totalStandups, hasBlockers }` | `log-standup` |

### Subscribed Events

| Event | Source | Action |
|--------|----------|--------|
| `scrum:task-updated` | scrum-board | Automatically notes the task status change as an activity in the next standup |
| `cicd:build-failed` | cicd-monitor | Records the build failure as a potential blocker |

### Collaborative Flow

```
  scrum-board                          standup-notes
  -----------                          -------------

  update-task-status(TASK-42, "done")
       |
       +---> scrum:task-updated ------> [records as accomplishment]
                                         "TASK-42 completed"

  cicd-monitor
  ------------

  build #15 failed
       |
       +---> cicd:build-failed -------> [records as potential blocker]
                                         "Build #15 failed on main"
```

---

## Interactions with Other Servers

```
+------------------+     scrum:task-updated       +------------------+
| scrum-board      | ---------------------------> | standup-notes    |
+------------------+                              |                  |
                                                  |                  |
+------------------+     cicd:build-failed        |                  |
| cicd-monitor     | ---------------------------> |                  |
+------------------+                              |                  |
                                                  | standup:report-  |
                                                  | generated        |
                                                  +--------+---------+
                                                           |
                                                           v
                                                  (future consumers)
```

- **scrum-board:** task status changes automatically enrich standup data
- **cicd-monitor:** failed builds are flagged as potential blockers
- **retrospective-manager:** recurring blockers could automatically feed
  retrospectives

---

## Usage Examples

### Daily standup

```json
{
  "tool": "log-standup",
  "arguments": {
    "yesterday": "Completed OAuth login feature (#42), reviewed Luigi's PR (#45)",
    "today": "Start 2FA implementation, meeting with design team at 11",
    "blockers": "Staging server unreachable since last night"
  }
}
```

### Review the week

```json
{
  "tool": "get-standup-history",
  "arguments": { "days": 7 }
}
```

### Generate report for the manager

```json
{
  "tool": "generate-status-report",
  "arguments": { "days": 14 }
}
```

This generates a report for the last two weeks (a full sprint), perfect
for management or product owner updates.

---

## Future Developments

- **Multi-user:** team support with aggregated reports per person
- **Customizable templates:** custom fields beyond yesterday/today/blockers
- **Blocker notifications:** automatic notification to the scrum master
- **Trend analysis:** identify recurring blockers and suggest corrective actions
- **Asynchronous standups:** support for remote teams in different timezones
- **AI summary:** automatic summary of the week's themes
- **Stakeholder export:** PDF or email-ready reports for external communication
