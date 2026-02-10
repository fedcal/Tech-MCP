# CI/CD Monitor Server

## Overview

The **cicd-monitor** server is the bridge between MCP Suite and Continuous Integration
and Continuous Deployment pipelines. It integrates natively with GitHub Actions via the `gh` CLI,
allowing users to monitor workflow runs, view build logs, and identify flaky tests
without leaving the development environment.

The main problem it solves is information fragmentation: developers
need to navigate to the GitHub web interface to check build status, read
error logs, and understand which tests fail intermittently. This server brings
all this information directly into the IDE.

```
+------------------------------------------------------------+
|               cicd-monitor server                          |
|                                                            |
|  +-------------------------------------------------------+ |
|  |                  Tool Layer                           | |
|  |                                                       | |
|  |  list-pipelines       get-pipeline-status             | |
|  |  get-build-logs       get-flaky-tests                 | |
|  +-------------------------------------------------------+ |
|                           |                                |
|                           v                                |
|  +-------------------------------------------------------+ |
|  |          child_process.execSync                       | |
|  |          Commands: gh run list / gh run view          | |
|  +-------------------------------------------------------+ |
|                           |                                |
|                           v                                |
|  +-------------------------------------------------------+ |
|  |   Event Bus                                           | |
|  |   cicd:pipeline-completed                             | |
|  |   cicd:build-failed                                   | |
|  +-------------------------------------------------------+ |
+------------------------------------------------------------+
```

### Prerequisites

- **GitHub CLI (`gh`)** installed and authenticated (`gh auth login`)
- Access to the target GitHub repository (owner or collaborator)

### Key Features

- **Pipeline monitoring**: list and details of recent workflow runs
- **Log viewing**: direct access to build logs up to 10MB
- **Flaky test detection**: statistical analysis of mixed pass/fail results
- **Event publishing**: automatic notification of completed pipelines and failed builds

---

## Tool Table

| Tool | Description | Parameters |
|------|-------------|-----------|
| `list-pipelines` | Lists recent GitHub Actions workflow runs | `repo?` (string, owner/repo); `limit` (number, default: 10) |
| `get-pipeline-status` | Details of a specific workflow run with jobs and steps | `runId` (string); `repo?` (string) |
| `get-build-logs` | Downloads the last N lines of logs from a workflow run | `runId` (string); `repo?` (string); `lines` (number, default: 100) |
| `get-flaky-tests` | Analyzes recent runs to find tests that pass/fail intermittently | `repo?` (string); `branch?` (string); `runs` (number, default: 20) |

---

## Architecture

### GitHub CLI Commands Used

| Tool | Command | Timeout |
|------|---------|---------|
| `list-pipelines` | `gh run list --limit N --json fields` | 30s |
| `get-pipeline-status` | `gh run view <id> --json fields` + `gh run view <id> --json jobs` | 30s |
| `get-build-logs` | `gh run view <id> --log` | 60s |
| `get-flaky-tests` | `gh run list` + `gh run view <id> --json jobs` for each run | 30s per command |

### Flow of list-pipelines

```
  gh run list --json databaseId,displayTitle,headBranch,
                     event,status,conclusion,createdAt,
                     updatedAt,url,workflowName
        |
        v
  JSON.parse(output)
        |
        v
  Mapping to simplified format:
  { id, title, branch, event, status, conclusion,
    workflow, createdAt, updatedAt, url }
```

### Flow of get-pipeline-status

```
  gh run view <runId> --json (run fields)
        |
        v
  Run details: id, title, branch, sha, event, status,
               conclusion, workflow, createdAt, updatedAt

  gh run view <runId> --json jobs
        |
        v
  Jobs array:
    +-- Job 1: { name, status, conclusion, startedAt, completedAt }
    |     +-- Step 1: { name, status, conclusion, number }
    |     +-- Step 2: ...
    +-- Job 2: ...

  If conclusion == 'failure':
    -> Publishes cicd:pipeline-completed (status: 'failed')
    -> Publishes cicd:build-failed with the name of the failed job

  If conclusion == 'success':
    -> Publishes cicd:pipeline-completed (status: 'success')
```

### Flow of get-flaky-tests

The algorithm for identifying flaky tests is as follows:

```
  1. Retrieve the last N runs (default 20)
         |
         v
  2. Group by branch + workflow
         |
         v
  3. For each group with MIXED results (success + failure):
     a. Sample up to 5 runs
     b. For each run, retrieve jobs and steps
     c. For each step, track passes/failures
         |
         v
  4. Identify steps with BOTH passCount > 0 AND failCount > 0
         |
         v
  5. Flakiness rate calculation:
     rate = min(passCount, failCount) / totalRuns * 100
         |
         v
  6. Sort by flakiness rate in descending order
```

---

## Event Bus Integration

### Published Events

| Event | Emitted by | Payload | Condition |
|-------|-----------|---------|-----------|
| `cicd:pipeline-completed` | `get-pipeline-status` | `{ pipelineId, status, branch, duration }` | Always, after retrieving run details |
| `cicd:build-failed` | `get-pipeline-status` | `{ pipelineId, error, stage, branch }` | Only if `conclusion == 'failure'` |

### Subscribed Events

None.

### Pipeline Duration Calculation

The duration is calculated as the difference between `updatedAt` and `createdAt` in milliseconds.

---

## Interactions with Other Servers

```
+------------------+   cicd:pipeline-completed   +-----------------+
|  cicd-monitor    | --------------------------> | standup-notes   |
|                  |   cicd:build-failed         | agile-metrics   |
+------------------+ --------------------------> +-----------------+

+------------------+                             +-----------------+
|  log-analyzer    | <--- (build log analysis)   | cicd-monitor    |
+------------------+                             +-----------------+
```

| Related Server | Direction | Description |
|----------------|-----------|-------------|
| `standup-notes` | -> (via event) | Receives notification of completed/failed builds for daily reports |
| `agile-metrics` | -> (via event) | Aggregates pipeline speed metrics and failure rate |
| `log-analyzer` | complementary | Downloaded build logs can be analyzed in detail |
| `code-review` | complementary | Code issues can be correlated with build failures |
| `docker-compose` | complementary | Docker builds can be monitored as part of the pipeline |

---

## Usage Examples

### Listing recent pipelines

**Request:**
```json
{
  "tool": "list-pipelines",
  "arguments": {
    "repo": "my-org/my-project",
    "limit": 5
  }
}
```

**Response:**
```json
{
  "total": 5,
  "runs": [
    {
      "id": 12345678,
      "title": "feat: add user authentication",
      "branch": "feature/auth",
      "event": "push",
      "status": "completed",
      "conclusion": "success",
      "workflow": "CI",
      "createdAt": "2024-06-15T10:00:00Z",
      "url": "https://github.com/my-org/my-project/actions/runs/12345678"
    }
  ]
}
```

### Detailed pipeline status

**Request:**
```json
{
  "tool": "get-pipeline-status",
  "arguments": {
    "runId": "12345678",
    "repo": "my-org/my-project"
  }
}
```

**Response (simplified):**
```json
{
  "id": 12345678,
  "title": "feat: add user authentication",
  "branch": "feature/auth",
  "sha": "abc123def456",
  "conclusion": "failure",
  "jobs": [
    {
      "name": "build",
      "conclusion": "success",
      "steps": [
        { "name": "Checkout", "conclusion": "success", "number": 1 },
        { "name": "Install", "conclusion": "success", "number": 2 },
        { "name": "Build", "conclusion": "success", "number": 3 }
      ]
    },
    {
      "name": "test",
      "conclusion": "failure",
      "steps": [
        { "name": "Run tests", "conclusion": "failure", "number": 1 }
      ]
    }
  ]
}
```

### Flaky test detection

**Request:**
```json
{
  "tool": "get-flaky-tests",
  "arguments": {
    "repo": "my-org/my-project",
    "branch": "main",
    "runs": 20
  }
}
```

**Response:**
```json
{
  "analyzedRuns": 20,
  "branchesAnalyzed": 1,
  "flakyStepsFound": 2,
  "flaky": [
    {
      "branch": "main",
      "workflow": "CI",
      "job": "test",
      "step": "Run integration tests",
      "passCount": 3,
      "failCount": 2,
      "totalRuns": 5,
      "flakinessRate": 40.0
    }
  ]
}
```

---

## Future Developments

- **Multi-platform support**: GitLab CI, Bitbucket Pipelines, Jenkins
- **Intelligent caching**: avoiding repeated API calls for already analyzed runs
- **Real-time alerts**: periodic polling with immediate failure notification
- **Trend analysis**: historical tracking of success rate over time
- **Automatic retry**: ability to re-run a failed workflow run
- **Commit correlation**: automatic linking between failure and specific commit
- **Metrics dashboard**: lead time, cycle time, deployment frequency (DORA metrics)
- **Slack/Teams integration**: push notifications to communication channels
