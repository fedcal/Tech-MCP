# Collaboration Matrix

## Overview

This section documents all event flows between the 22 MCP Suite servers. The matrix shows who publishes, who subscribes, and the end-to-end flows that emerge from composing events.

---

## Publisher/Subscriber Matrix

### Who Publishes What

| Server | Event | Trigger (Tool) |
|--------|-------|-----------------|
| **scrum-board** | `scrum:sprint-started` | `create-sprint` |
| **scrum-board** | `scrum:sprint-completed` | `close-sprint` |
| **scrum-board** | `scrum:task-updated` | `update-task-status` |
| **scrum-board** | `scrum:story-completed` | `close-sprint` (completed stories) |
| **time-tracking** | `time:entry-logged` | `log-time`, `stop-timer` |
| **cicd-monitor** | `cicd:pipeline-completed` | `get-pipeline-status` |
| **cicd-monitor** | `cicd:build-failed` | `get-pipeline-status` |
| **code-review** | `code:commit-analyzed` | `analyze-diff` |
| **code-review** | `code:review-completed` | `suggest-improvements` |
| **dependency-manager** | `code:dependency-alert` | `check-vulnerabilities` |
| **db-schema-explorer** | `db:index-suggestion` | `suggest-indexes` |
| **test-generator** | `test:generated` | `generate-unit-tests` |
| **test-generator** | `test:coverage-report` | `analyze-coverage` |
| **api-documentation** | `docs:api-updated` | `extract-endpoints` |
| **api-documentation** | `docs:stale-detected` | `find-undocumented` |
| **performance-profiler** | `perf:bottleneck-found` | `find-bottlenecks` |
| **performance-profiler** | `perf:profile-completed` | `benchmark-compare` |
| **project-economics** | `economics:budget-alert` | `get-budget-status` (>80%) |
| **project-economics** | `economics:cost-updated` | `log-cost` |
| **retrospective-manager** | `retro:action-item-created` | `generate-action-items` |
| **standup-notes** | `standup:report-generated` | `log-standup` |

### Who Subscribes to What

| Server | Subscribed Event | Reaction |
|--------|-----------------|----------|
| **agile-metrics** | `scrum:sprint-completed` | Cache velocity data |
| **agile-metrics** | `scrum:task-updated` | Track transitions for cycle time |
| **agile-metrics** | `scrum:story-completed` | Update throughput |
| **time-tracking** | `scrum:task-updated` | Auto-start/stop timer (future) |
| **project-economics** | `time:entry-logged` | Convert time to cost |
| **project-economics** | `scrum:sprint-completed` | Sprint cost snapshot |
| **scrum-board** | `retro:action-item-created` | Auto-create task (future) |
| **retrospective-manager** | `scrum:sprint-completed` | Auto-create pending retro (future) |
| **retrospective-manager** | `cicd:build-failed` | Add discussion item (future) |
| **standup-notes** | `scrum:task-updated` | Progress context for standup (future) |
| **standup-notes** | `cicd:build-failed` | Add potential blocker (future) |

---

## Server Classification

### Servers with Full Collaboration (Publish + Subscribe)

These servers actively participate in the event network in both directions:

```
+------------------+         +------------------+
| scrum-board      |-------->| agile-metrics    |
| (4 events out)   |         | (3 events in)    |
| (1 event in)     |<--------| retrospective    |
+------------------+         +------------------+

+------------------+         +------------------+
| time-tracking    |-------->| project-economics|
| (1 event out)    |         | (2 events in)    |
| (1 event in)     |         | (2 events out)   |
+------------------+         +------------------+
```

| Server | Publishes | Subscribes | collaboration.ts file |
|--------|-----------|------------|----------------------|
| scrum-board | 4 events | 1 event | Yes |
| time-tracking | 1 event | 1 event | Yes |
| project-economics | 2 events | 2 events | Yes |
| retrospective-manager | 1 event | 2 events | Yes |
| standup-notes | 1 event | 2 events | Yes |

### Publisher-Only Servers (Publish, do not subscribe)

These servers generate events but do not react to external events:

| Server | Publishes | Notes |
|--------|-----------|-------|
| cicd-monitor | 2 events | DevOps event hub |
| code-review | 2 events | Code analysis notifications |
| dependency-manager | 1 event | Vulnerability alerts |
| db-schema-explorer | 1 event | Index suggestions |
| test-generator | 2 events | Test generation notifications |
| api-documentation | 2 events | Documentation updates |
| performance-profiler | 2 events | Performance reports |

### Subscriber-Only Servers (Subscribe, do not publish directly from tools)

| Server | Subscribes | Notes |
|--------|------------|-------|
| agile-metrics | 3 events | Computes metrics from scrum events |

### Pass-Through Servers (Prepared for the future)

These 9 servers accept the EventBus in the factory but currently neither publish nor subscribe:

- docker-compose
- log-analyzer
- data-mock-generator
- codebase-knowledge
- regex-builder
- http-client
- snippet-manager
- project-scaffolding
- environment-manager

---

## End-to-End Flows

### Flow 1: Sprint Lifecycle

```
[Sprint Creation]
scrum-board:create-sprint
    |
    +-- scrum:sprint-started -----> (informational, future expansion)

[Work During the Sprint]
scrum-board:update-task-status
    |
    +-- scrum:task-updated -------> agile-metrics  (cycle time)
    |                           +-> time-tracking  (auto-timer future)
    |                           +-> standup-notes  (standup context)

[Sprint Closure]
scrum-board:close-sprint
    |
    +-- scrum:sprint-completed ---> agile-metrics       (velocity)
    |                           +-> project-economics   (cost snapshot)
    |                           +-> retrospective-mgr   (auto-create retro)
    |
    +-- scrum:story-completed ----> agile-metrics       (throughput)
```

### Flow 2: Time and Cost Tracking

```
[Time Logging]
time-tracking:log-time / stop-timer
    |
    +-- time:entry-logged --------> project-economics  (cost conversion)

[Direct Cost Logging]
project-economics:log-cost
    |
    +-- economics:cost-updated ---> (informational)

[Budget Check]
project-economics:get-budget-status
    |
    +-- economics:budget-alert ---> (notification if >80%)
```

### Flow 3: DevOps Cycle

```
[Pipeline Monitoring]
cicd-monitor:get-pipeline-status
    |
    +-- cicd:pipeline-completed --> (informational)
    |
    +-- cicd:build-failed -------> retrospective-mgr  (discussion item)
                                +-> standup-notes      (blocker)
```

### Flow 4: Quality & Review

```
[Code Analysis]
code-review:analyze-diff
    |
    +-- code:commit-analyzed -----> (informational)

code-review:suggest-improvements
    |
    +-- code:review-completed ----> (informational, codebase-knowledge future)

[Vulnerabilities]
dependency-manager:check-vulnerabilities
    |
    +-- code:dependency-alert ----> (informational)
```

### Flow 5: Retrospective and Improvement

```
[Sprint Completed]
scrum:sprint-completed -----------> retrospective-mgr (auto-create retro)

[Action Item Generation]
retrospective-mgr:generate-action-items
    |
    +-- retro:action-item-created -> scrum-board (auto-create task future)
```

---

## Complete Diagram

```
                            +----------------+
                            | cicd-monitor   |
                            | (2 pub, 0 sub) |
                            +-------+--------+
                                    |
                     cicd:build-failed
                     cicd:pipeline-completed
                                    |
                    +---------------+---------------+
                    v                               v
           +--------+--------+            +---------+---------+
           | retrospective   |            | standup-notes     |
           | (1 pub, 2 sub)  |            | (1 pub, 2 sub)    |
           +--------+--------+            +-------------------+
                    |
      retro:action-item-created
                    |
                    v
           +--------+---------+
           | scrum-board      |
           | (4 pub, 1 sub)   |
           +--------+---------+
                    |
     scrum:sprint-completed
     scrum:task-updated
     scrum:story-completed
                    |
     +--------------+--------------+
     v              v              v
+----+------+ +-----+------+ +----+----------+
| agile-    | | time-      | | project-      |
| metrics   | | tracking   | | economics     |
| (0p, 3s)  | | (1p, 1s)   | | (2p, 2s)      |
+-----------+ +-----+------+ +---------------+
                    |
             time:entry-logged
                    |
                    v
              +-----+----------+
              | project-       |
              | economics      |
              +----------------+
```

---

## Future Collaboration Developments

### Pending Implementations in Collaboration Handlers

Many handlers currently contain placeholders (`void payload`) awaiting full implementation:

| Server | Event | Future Action |
|--------|-------|---------------|
| scrum-board | `retro:action-item-created` | Auto-create task from retro |
| time-tracking | `scrum:task-updated` | Auto-start timer on "in_progress" status |
| agile-metrics | `scrum:sprint-completed` | Cache velocity data |
| agile-metrics | `scrum:task-updated` | Record transition timestamps |
| project-economics | `time:entry-logged` | Automatic time-to-cost conversion |
| retrospective-manager | `scrum:sprint-completed` | Auto-create pending retro |
| standup-notes | `scrum:task-updated` | Populate standup context |

### Redis EventBus

For multi-process deployments, the `RedisEventBus` implementation will enable collaboration between servers in separate processes:

```
Process A               Redis             Process B
  |                       |                   |
  |-- PUBLISH event ----->|                   |
  |                       |-- SUBSCRIBE ----->|
  |                       |    (delivery)     |
```

### Planned New Events

- `scrum:backlog-prioritized` - When the backlog is reordered
- `time:timer-started` / `time:timer-stopped` - Real-time timer notifications
- `deploy:release-created` - Integration with deploy pipeline
- `docs:readme-updated` - Documentation change tracking
