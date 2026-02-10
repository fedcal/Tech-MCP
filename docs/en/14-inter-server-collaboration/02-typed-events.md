# The 29 Typed Events

## Overview

MCP Suite defines 29 typed events organized into 11 domains. Each event has a name in the format `domain:action` and a strongly typed TypeScript payload.

```
EventMap
  |
  +-- code:*          (3 events) - Code and Git
  +-- cicd:*          (2 events) - CI/CD
  +-- scrum:*         (4 events) - Project Management
  +-- time:*          (2 events) - Time Tracking
  +-- db:*            (2 events) - Database
  +-- test:*          (2 events) - Testing
  +-- docs:*          (2 events) - Documentation
  +-- perf:*          (2 events) - Performance
  +-- retro:*         (2 events) - Retrospectives
  +-- economics:*     (2 events) - Project Economics
  +-- standup:*       (1 event)  - Standup
                     --------
                     29 total
```

---

## Complete Reference

### Domain: Code & Git (3 events)

#### `code:commit-analyzed`

Published by **code-review** after analyzing a diff/commit.

```typescript
{
  commitHash: string;    // Hash of the analyzed commit
  files: string[];       // Files involved in the commit
  stats: Record<string, number>;  // Statistics (lines added, removed, etc.)
}
```

#### `code:review-completed`

Published by **code-review** at the end of a complete review.

```typescript
{
  files: string[];       // Reviewed files
  issues: number;        // Number of issues found
  suggestions: string[]; // Improvement suggestions
}
```

#### `code:dependency-alert`

Published by **dependency-manager** when a vulnerability is found.

```typescript
{
  package: string;                              // Package name
  severity: 'critical' | 'high' | 'medium' | 'low';  // Severity level
  advisory: string;                             // Advisory description
}
```

---

### Domain: CI/CD (2 events)

#### `cicd:pipeline-completed`

Published by **cicd-monitor** when a pipeline finishes.

```typescript
{
  pipelineId: string;              // Pipeline ID
  status: 'success' | 'failed';   // Outcome
  branch: string;                  // Branch involved
  duration: number;                // Duration in seconds
}
```

#### `cicd:build-failed`

Published by **cicd-monitor** when a build fails.

```typescript
{
  pipelineId: string;   // Pipeline ID
  error: string;        // Error message
  stage: string;        // Stage where it failed
  branch: string;       // Branch involved
}
```

---

### Domain: Scrum/Project Management (4 events)

#### `scrum:sprint-started`

Published by **scrum-board** when a new sprint is created.

```typescript
{
  sprintId: string;   // Sprint ID
  name: string;       // Sprint name
  startDate: string;  // Start date (ISO 8601)
  endDate: string;    // End date (ISO 8601)
}
```

#### `scrum:sprint-completed`

Published by **scrum-board** when a sprint is closed.

```typescript
{
  sprintId: string;          // Sprint ID
  name: string;              // Sprint name
  velocity: number;          // Completed story points
  completedStories: number;  // Completed stories
  incompleteStories: number; // Incomplete stories
}
```

#### `scrum:task-updated`

Published by **scrum-board** when a task changes status.

```typescript
{
  taskId: string;          // Task ID
  previousStatus: string;  // Previous status
  newStatus: string;       // New status
  assignee?: string;       // Assignee (optional)
  sprintId?: string;       // Parent sprint (optional)
}
```

#### `scrum:story-completed`

Published by **scrum-board** when a user story is completed.

```typescript
{
  storyId: string;      // Story ID
  title: string;        // Story title
  storyPoints: number;  // Story points
  sprintId: string;     // Parent sprint
}
```

---

### Domain: Time Tracking (2 events)

#### `time:entry-logged`

Published by **time-tracking** when time is logged.

```typescript
{
  taskId: string;   // Task ID
  userId: string;   // User ID
  minutes: number;  // Minutes logged
  date: string;     // Date (ISO 8601)
}
```

#### `time:timesheet-generated`

Published by **time-tracking** when a timesheet is generated.

```typescript
{
  userId: string;     // User ID
  period: string;     // Period covered
  totalHours: number; // Total hours
}
```

---

### Domain: Database (2 events)

#### `db:schema-changed`

Published by **db-schema-explorer** when a schema change is detected.

```typescript
{
  database: string;                              // Database name
  table: string;                                 // Table involved
  changeType: 'created' | 'altered' | 'dropped'; // Change type
}
```

#### `db:index-suggestion`

Published by **db-schema-explorer** when an index is suggested.

```typescript
{
  database: string;    // Database name
  table: string;       // Table involved
  columns: string[];   // Columns suggested for the index
  reason: string;      // Reason for the suggestion
}
```

---

### Domain: Testing (2 events)

#### `test:generated`

Published by **test-generator** after test generation.

```typescript
{
  filePath: string;    // Path of the generated test file
  testCount: number;   // Number of tests generated
  framework: string;   // Framework used (jest, vitest, mocha)
}
```

#### `test:coverage-report`

Published by **test-generator** after a coverage analysis.

```typescript
{
  filePath: string;         // Analyzed file
  coverage: number;         // Coverage percentage
  uncoveredLines: number[]; // Uncovered lines
}
```

---

### Domain: Documentation (2 events)

#### `docs:api-updated`

Published by **api-documentation** when endpoint documentation is updated.

```typescript
{
  endpoint: string;    // Endpoint path
  method: string;      // HTTP method (GET, POST, etc.)
  changes: string[];   // Detected changes
}
```

#### `docs:stale-detected`

Published by **api-documentation** when stale documentation is detected.

```typescript
{
  filePath: string;     // File with stale documentation
  lastUpdated: string;  // Last update date
  reason: string;       // Reason it is considered stale
}
```

---

### Domain: Performance (2 events)

#### `perf:bottleneck-found`

Published by **performance-profiler** when a bottleneck is found.

```typescript
{
  location: string;    // Location in the code
  metric: string;      // Measured metric
  value: number;       // Measured value
  threshold: number;   // Exceeded threshold
}
```

#### `perf:profile-completed`

Published by **performance-profiler** at the end of a profiling session.

```typescript
{
  target: string;                   // Profiled target
  durationMs: number;               // Profiling duration in ms
  results: Record<string, number>;  // Results
}
```

---

### Domain: Retrospectives (2 events)

#### `retro:action-item-created`

Published by **retrospective-manager** when an action item is created.

```typescript
{
  retroId: string;    // Retrospective ID
  item: string;       // Action item description
  assignee: string;   // Assignee
  dueDate?: string;   // Due date (optional)
}
```

#### `retro:completed`

Published by **retrospective-manager** at the end of a retrospective.

```typescript
{
  sprintId: string;      // Associated sprint
  retroId: string;       // Retrospective ID
  actionItems: number;   // Number of generated action items
  participants: number;  // Number of participants
}
```

---

### Domain: Economics (2 events)

#### `economics:budget-alert`

Published by **project-economics** when the budget exceeds a threshold.

```typescript
{
  project: string;      // Project name
  percentUsed: number;  // Percentage of budget used
  threshold: number;    // Threshold that triggered the alert (e.g., 80)
  remaining: number;    // Remaining budget
}
```

#### `economics:cost-updated`

Published by **project-economics** after a cost is recorded.

```typescript
{
  category: string;    // Cost category
  amount: number;      // Cost amount
  totalSpent: number;  // Total spent so far
}
```

---

### Domain: Standup (1 event)

#### `standup:report-generated`

Published by **standup-notes** after a standup report is generated.

```typescript
{
  userId: string;          // User ID
  date: string;            // Standup date
  tasksDone: number;       // Completed tasks
  tasksInProgress: number; // Tasks in progress
  blockers: number;        // Number of blockers
}
```

---

## Naming Conventions

| Rule | Example |
|------|---------|
| Format | `domain:action-in-kebab-case` |
| Domain | Corresponds to the server or functional area |
| Past tense action | `sprint-completed`, `entry-logged` |
| Present tense action | `budget-alert`, `dependency-alert` |
| Consistent prefix | All scrum events use `scrum:*` |

## Pattern Matching

Pattern matching via `subscribePattern` allows subscribing to groups of events:

```typescript
// All events in the scrum domain
eventBus.subscribePattern('scrum:*', (event, payload) => {
  console.log(`Scrum event: ${event}`, payload);
});

// All completion events
eventBus.subscribePattern('*:*-completed', (event, payload) => {
  console.log(`Completed: ${event}`, payload);
});
```
