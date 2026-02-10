# Project Economics Server

## Overview

The **project-economics** server manages project budget and costs, providing
visibility into spending, breakdown by category, and budget depletion forecasts.
It includes an automatic alert system that publishes an event when the budget usage
reaches or exceeds 80%.

```
+------------------------------------------------------------------------+
|                   project-economics server                             |
|                                                                        |
|  +-----------+  +----------+  +-----------------+  +-----------------+ |
|  |set-budget |  |log-cost  |  |get-budget-status|  |forecast-budget  | |
|  |           |  |          |  |                 |  |                 | |
|  | name,     |  | category |  | total/spent/    |  | burn rate       | |
|  | total,    |  | amount   |  | remaining/%     |  | days remain.    | |
|  | currency  |  | descript.|  | breakdown       |  | depletion date  | |
|  | EUR       |  |          |  |                 |  |                 | |
|  +-----+-----+  +----+-----+  +--------+--------+  +--------+--------+ |
|        |             |                 |                    |          |
|        v             v                 v                    v          |
|  +-----------------------------------------------------------+         |
|  |                 EconomicsStore (SQLite)                   |         |
|  |                                                           |         |
|  |  +-------------------+    +---------------------------+   |         |
|  |  | budgets           |    | costs                     |   |         |
|  |  | id, projectName   |    | id, budgetId (FK)         |   |         |
|  |  | totalBudget       |    | category, amount          |   |         |
|  |  | currency (EUR)    |    | description, date, taskId |   |         |
|  |  | createdAt         |    | createdAt                 |   |         |
|  |  +-------------------+    +---------------------------+   |         |
|  +-----------------------------------------------------------+         |
|                                                                        |
|  Publishes: economics:cost-updated, economics:budget-alert (>=80%)     |
|  Subscribes: time:entry-logged, scrum:sprint-completed                 |
+------------------------------------------------------------------------+
```

**Version:** 0.1.0
**Entry point:** `servers/project-economics/src/index.ts`
**Dependencies:** `@mcp-suite/core`, `@mcp-suite/event-bus`, `@mcp-suite/database`

---

## Tool Table

| Tool | Description | Parameters |
|------|-------------|-----------|
| `set-budget` | Defines or updates the budget for a project | `projectName` (string): project name; `totalBudget` (number): total budget; `currency` (string, default: 'EUR'): currency |
| `log-cost` | Records a cost in the project | `projectName` (string): project name; `category` (string): expense category; `amount` (number): amount; `description` (string): description; `date` (string, optional); `taskId` (string, optional) |
| `get-budget-status` | Shows complete budget status with breakdown | `projectName` (string): project name |
| `forecast-budget` | Budget depletion forecast based on burn rate | `projectName` (string): project name |

---

## Tool Details

### set-budget

Creates or updates the budget for a project. If the project already exists, it updates the
total budget and currency via `ON CONFLICT ... DO UPDATE`.

```json
{
  "tool": "set-budget",
  "arguments": {
    "projectName": "MCP Suite v2",
    "totalBudget": 50000,
    "currency": "EUR"
  }
}
```

The default currency is EUR (Euro). The project is uniquely identified by its name
(`projectName UNIQUE`).

### log-cost

Records a cost associated with a project. Requires that the budget has been
previously created with `set-budget`.

```json
{
  "tool": "log-cost",
  "arguments": {
    "projectName": "MCP Suite v2",
    "category": "development",
    "amount": 2500,
    "description": "Sprint 14 - 40h frontend development",
    "date": "2025-02-14",
    "taskId": "TASK-42"
  }
}
```

After recording, the tool automatically checks the percentage of budget
used. If it reaches or exceeds 80%, it publishes the `economics:budget-alert` event.

### get-budget-status

Returns a complete view of the budget status:

```
  Budget: MCP Suite v2
  +--------------------------------------------+
  | Total: 50,000 EUR | Spent: 38,500 EUR      |
  | Remaining: 11,500 EUR | Used: 77%          |
  +--------------------------------------------+
  | Breakdown: development 25K | infra 8.5K    |
  |            testing 3K      | design 2K     |
  +--------------------------------------------+
```

**Structured output:**
```json
{
  "projectName": "MCP Suite v2",
  "totalBudget": 50000,
  "currency": "EUR",
  "totalSpent": 38500,
  "remaining": 11500,
  "percentageUsed": 77.0,
  "breakdown": [{ "category": "development", "total": 25000 }, ...]
}
```

### forecast-budget

Calculates the daily burn rate and estimates when the budget will be depleted:

```
  Forecasting algorithm:
  +---------------------------------------------------+
  | 1. Find first and last cost date                  |
  | 2. daysTracked = (lastDate - firstDate) + 1       |
  | 3. dailyBurnRate = totalSpent / daysTracked       |
  | 4. estimatedDaysRemaining = remaining / burnRate  |
  | 5. runOutDate = today + daysRemaining             |
  +---------------------------------------------------+
```

**Output:**
```json
{
  "projectName": "MCP Suite v2",
  "totalBudget": 50000,
  "currency": "EUR",
  "totalSpent": 38500,
  "remaining": 11500,
  "dailyBurnRate": 550.0,
  "daysTracked": 70,
  "estimatedDaysRemaining": 21,
  "estimatedRunOutDate": "2025-03-07"
}
```

Special cases:
- If there are no recorded costs: `dailyBurnRate: 0`, `estimatedDaysRemaining: null`
- If the budget is already depleted: `estimatedDaysRemaining: 0`, `runOutDate: today`

---

## Architecture

```
index.ts
  |
  +-- server.ts (createProjectEconomicsServer)
  |     |
  |     +-- creates EconomicsStore
  |     +-- registers 4 tools
  |     +-- setupCollaborationHandlers(eventBus, store)
  |
  +-- services/
  |     +-- economics-store.ts  --> EconomicsStore
  |
  +-- tools/
  |     +-- set-budget.ts
  |     +-- log-cost.ts
  |     +-- get-budget-status.ts
  |     +-- forecast-budget.ts
  |
  +-- collaboration.ts  --> cross-server event handlers
```

### EconomicsStore

**`budgets` table schema:**

| Column | Type | Notes |
|---------|------|------|
| `id` | INTEGER PK | Auto-increment |
| `projectName` | TEXT NN UNIQUE | Unique project identifier |
| `totalBudget` | REAL NN | Total budget |
| `currency` | TEXT NN | Default 'EUR' |
| `createdAt` | TEXT NN | datetime('now') |

**`costs` table schema:**

| Column | Type | Notes |
|---------|------|------|
| `id` | INTEGER PK | Auto-increment |
| `budgetId` | INTEGER FK NN | Reference to budgets(id) |
| `category` | TEXT NN | Expense category |
| `amount` | REAL NN | Amount |
| `description` | TEXT NN | Cost description |
| `date` | TEXT NN | ISO date |
| `taskId` | TEXT | Nullable, link to task |
| `createdAt` | TEXT NN | datetime('now') |

The `ON CONFLICT(projectName) DO UPDATE` clause in `set-budget` allows updating
an existing budget without errors.

---

## Event Bus Integration

### Published Events

| Event | Payload | Emitted by | Condition |
|--------|---------|-----------|------------|
| `economics:cost-updated` | `{ projectName, category, amount, totalSpent }` | `log-cost` | Always |
| `economics:budget-alert` | `{ projectName, percentageUsed, remaining, totalBudget }` | `get-budget-status` | When `percentageUsed >= 80%` |

### Subscribed Events

| Event | Source | Action |
|--------|----------|--------|
| `time:entry-logged` | time-tracking | Converts logged time into cost and adds it to the project |
| `scrum:sprint-completed` | scrum-board | Trigger for end-of-sprint report with cost analysis |

### Alert Flow

```
  log-cost("MCP Suite v2", "development", 5000, ...)
       |
       v
  get-budget-status("MCP Suite v2")
       |
       v
  percentageUsed = 82%  --> >= 80%?
       |
       +--[YES]--> Publishes economics:budget-alert
       |           { projectName: "MCP Suite v2",
       |             percentageUsed: 82,
       |             remaining: 9000,
       |             totalBudget: 50000 }
       |
       +--[NO]--> No alert
```

---

## Interactions with Other Servers

```
+------------------+     time:entry-logged        +-------------------+
| time-tracking    | ---------------------------> | project-economics |
+------------------+                              |                   |
                                                  |                   |
+------------------+     scrum:sprint-completed   |                   |
| scrum-board      | ---------------------------> |                   |
+------------------+                              +--------+----------+
                                                           |
                                    economics:budget-alert |
                                    economics:cost-updated |
                                                           v
                                                  +------------------+
                                                  | standup-notes    |
                                                  | (future: alerts  |
                                                  |  in reports)     |
                                                  +------------------+
```

---

## Usage Examples

### Initial project setup

```json
// 1. Define the budget
{ "tool": "set-budget", "arguments": { "projectName": "MCP Suite v2", "totalBudget": 50000, "currency": "EUR" } }

// 2. Record costs
{ "tool": "log-cost", "arguments": { "projectName": "MCP Suite v2", "category": "development", "amount": 2500, "description": "Sprint 14 - backend" } }
{ "tool": "log-cost", "arguments": { "projectName": "MCP Suite v2", "category": "infrastructure", "amount": 500, "description": "Staging server February" } }

// 3. Check the status
{ "tool": "get-budget-status", "arguments": { "projectName": "MCP Suite v2" } }

// 4. Forecast
{ "tool": "forecast-budget", "arguments": { "projectName": "MCP Suite v2" } }
```

---

## Future Developments

- **Automatic time-to-cost conversion:** hourly rate per role, automatic conversion
  of time entries to costs
- **Per-sprint budget:** split the budget into per-sprint allocations
- **Multi-currency:** support for currency conversion
- **Configurable thresholds:** customizable alert thresholds (not just 80%)
- **ROI analysis:** return on investment based on story business value
- **Billing integration:** data export for external billing systems
