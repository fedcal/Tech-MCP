# Agile Metrics Server

## Overview

The **agile-metrics** server provides analytical tools for measuring and predicting the
performance of an agile team. It calculates velocity, generates burndown data, analyzes cycle
time, and produces completion forecasts based on Monte Carlo simulations.

The server is **stateless**: it has no database or internal store. It receives data as
input from tools (typically coming from the scrum-board) and returns pure calculations.
It subscribes to events to react to changes in the current sprint.

```
+------------------------------------------------------------------------+
|                     agile-metrics server                               |
|                                                                        |
|  +-------------------+ +------------------+ +------------------------+ |
|  |calculate-velocity | |generate-burndown | |calculate-cycle-time    | |
|  |                   | |                  | |                        | |
|  | - average points  | | - ideal vs       | | - average, median      | |
|  | - trend analysis  | |   actual         | | - p95, min, max        | |
|  | - per sprint      | | - sprint status  | |                        | |
|  +-------------------+ +------------------+ +------------------------+ |
|                                                                        |
|  +-------------------------------------------------------------------+ |
|  |                  forecast-completion                              | |
|  |  1000 Monte Carlo simulations --> p50, p85, p95                   | |
|  +-------------------------------------------------------------------+ |
|                                                                        |
|  Subscribes: scrum:sprint-completed, scrum:task-updated,               |
|              scrum:story-completed                                     |
+------------------------------------------------------------------------+
```

**Version:** 0.1.0
**Entry point:** `servers/agile-metrics/src/index.ts`
**Dependencies:** `@mcp-suite/core`, `@mcp-suite/event-bus`

---

## Tool Table

| Tool | Description | Parameters |
|------|-------------|-----------|
| `calculate-velocity` | Calculates the team's average velocity with trend analysis | `sprints` (array): list of sprints with `{ name, completedPoints, totalPoints }` |
| `generate-burndown` | Generates data for a burndown chart (ideal vs actual) | `totalPoints` (number): total sprint points; `sprintDays` (number): duration in days; `dailyCompleted` (number[]): points completed per day |
| `calculate-cycle-time` | Calculates statistics on task cycle time | `tasks` (array): list of `{ taskId, startDate, endDate }` |
| `forecast-completion` | Predicts the completion date via Monte Carlo simulation | `remainingPoints` (number): remaining points; `velocityHistory` (number[]): velocity history from recent sprints; `sprintLengthDays` (number): sprint duration in days |

---

## Tool Details

### calculate-velocity

Calculates the average velocity (completed points per sprint) and analyzes the trend:

```
  Sprint 10: 21 points     ______
  Sprint 11: 25 points    /      \
  Sprint 12: 23 points   /   TREND \   Average: 23.8
  Sprint 13: 27 points  /   +2.0    \  Trend: increasing (+2.0/sprint)
  Sprint 14: 23 points /    points   \
                      \_____________/
```

**Output:**
```json
{
  "averageVelocity": 23.8,
  "velocities": [21, 25, 23, 27, 23],
  "trend": {
    "direction": "increasing",
    "changePerSprint": 2.0
  },
  "sprintCount": 5
}
```

### generate-burndown

Generates data for a burndown chart comparing the ideal line with the actual
progress:

```
  Points
  40 |*
     | *  .
  30 |  *   .
     |   *     .    * <-- actual (behind schedule)
  20 |    *       .
     |     *         .    *
  10 |      *           .     *
     |       *              .    *
   0 |--------*------------------.--*-----> Days
     1  2  3  4  5  6  7  8  9 10

     * = ideal line     . = actual progress
```

**Output:** array of `{ day, ideal, actual, status }` objects where status is
`on-track`, `behind`, or `ahead`.

### calculate-cycle-time

Analyzes task completion times and produces detailed statistics:

| Metric | Description |
|---------|-------------|
| `average` | Arithmetic mean of the cycle time |
| `median` | Median value (p50) |
| `p95` | 95th percentile |
| `min` | Minimum completion time |
| `max` | Maximum completion time |

```json
{
  "tool": "calculate-cycle-time",
  "arguments": {
    "tasks": [
      { "taskId": "T-1", "startDate": "2025-02-03", "endDate": "2025-02-05" },
      { "taskId": "T-2", "startDate": "2025-02-03", "endDate": "2025-02-07" },
      { "taskId": "T-3", "startDate": "2025-02-04", "endDate": "2025-02-06" },
      { "taskId": "T-4", "startDate": "2025-02-05", "endDate": "2025-02-12" }
    ]
  }
}
```

**Result:** `{ average: 3.75 days, median: 3.0, p95: 7.0, min: 2, max: 7 }`

### forecast-completion

Runs **1000 Monte Carlo simulations** to predict when the remaining work will be
completed, considering the historical variability of velocity.

```
  Monte Carlo Algorithm:
  +-------------------------------------------------------+
  | For each simulation (1..1000):                        |
  |   remainingWork = remainingPoints                     |
  |   sprints = 0                                         |
  |   while remainingWork > 0:                            |
  |     velocity = random(velocityHistory)                |
  |     remainingWork -= velocity                         |
  |     sprints++                                         |
  |   record(sprints * sprintLengthDays)                  |
  +-------------------------------------------------------+
  | Sort results                                          |
  | p50 = result at 50th percentile                       |
  | p85 = result at 85th percentile                       |
  | p95 = result at 95th percentile                       |
  +-------------------------------------------------------+
```

**Output:**
```json
{
  "remainingPoints": 50,
  "simulations": 1000,
  "forecast": {
    "p50": { "sprints": 2, "days": 28, "date": "2025-03-14" },
    "p85": { "sprints": 3, "days": 42, "date": "2025-03-28" },
    "p95": { "sprints": 3, "days": 42, "date": "2025-03-28" }
  },
  "confidence": "With 85% probability, completion within 42 days"
}
```

---

## Architecture

```
index.ts
  |
  +-- server.ts (createAgileMetricsServer)
  |     |
  |     +-- registers 4 tools
  |     +-- setupCollaborationHandlers(eventBus)
  |
  +-- tools/
  |     +-- calculate-velocity.ts
  |     +-- generate-burndown.ts
  |     +-- calculate-cycle-time.ts
  |     +-- forecast-completion.ts
  |
  +-- collaboration.ts  --> subscribed event handlers
```

The server has no store. All calculations are pure functions that receive data
as input and return results. The data typically comes from the MCP client, which
obtains it from the scrum-board.

---

## Event Bus Integration

### Published Events

None. The server is a pure data consumer.

### Subscribed Events

| Event | Source | Action |
|--------|----------|--------|
| `scrum:sprint-completed` | scrum-board | Trigger for velocity recalculation and end-of-sprint report generation |
| `scrum:task-updated` | scrum-board | Real-time burndown data update |
| `scrum:story-completed` | scrum-board | Update of completed points for velocity tracking |

---

## Interactions with Other Servers

```
+------------------+     scrum:sprint-completed     +------------------+
| scrum-board      | -----------------------------> | agile-metrics    |
|                  |     scrum:task-updated         |                  |
|                  | -----------------------------> |                  |
|                  |     scrum:story-completed      |                  |
|                  | -----------------------------> |                  |
+------------------+                                +------------------+
                                                           |
                                                           v
                                                    Pure calculations
                                                    (velocity, burndown,
                                                     cycle time, forecast)
```

- **scrum-board (main input):** provides all data about sprints, stories, and tasks
- **project-economics (future output):** completion forecasts could
  feed budget projections

---

## Usage Examples

### Calculate velocity for recent sprints

```json
{
  "tool": "calculate-velocity",
  "arguments": {
    "sprints": [
      { "name": "Sprint 10", "completedPoints": 21, "totalPoints": 25 },
      { "name": "Sprint 11", "completedPoints": 25, "totalPoints": 28 },
      { "name": "Sprint 12", "completedPoints": 23, "totalPoints": 26 },
      { "name": "Sprint 13", "completedPoints": 27, "totalPoints": 30 }
    ]
  }
}
```

### Monte Carlo Forecast

```json
{
  "tool": "forecast-completion",
  "arguments": {
    "remainingPoints": 50,
    "velocityHistory": [21, 25, 23, 27, 23],
    "sprintLengthDays": 14
  }
}
```

---

## Future Developments

- **Real-time dashboard:** automatic metrics update on every received event
- **Throughput analysis:** throughput metrics (items completed per week)
- **Lead time vs cycle time:** distinction between total time and working time
- **Cumulative flow diagram:** data for generating an interactive CFD
- **Sprint comparison:** visualize the evolution of metrics across sprints
- **Automatic alerts:** notify when velocity drops below the historical average
- **Data export:** export metrics in CSV format for external analysis
