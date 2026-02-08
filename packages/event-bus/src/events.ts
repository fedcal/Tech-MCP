/**
 * Central typed event definitions for inter-server collaboration.
 * All cross-server events are defined in this EventMap.
 */

export interface EventMap {
  // --- Code & Git events ---
  'code:commit-analyzed': {
    commitHash: string;
    files: string[];
    stats: Record<string, number>;
  };
  'code:review-completed': {
    files: string[];
    issues: number;
    suggestions: string[];
  };
  'code:dependency-alert': {
    package: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    advisory: string;
  };

  // --- CI/CD events ---
  'cicd:pipeline-completed': {
    pipelineId: string;
    status: 'success' | 'failed';
    branch: string;
    duration: number;
  };
  'cicd:build-failed': {
    pipelineId: string;
    error: string;
    stage: string;
    branch: string;
  };

  // --- Scrum/Project Management events ---
  'scrum:sprint-started': {
    sprintId: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  'scrum:sprint-completed': {
    sprintId: string;
    name: string;
    velocity: number;
    completedStories: number;
    incompleteStories: number;
  };
  'scrum:task-updated': {
    taskId: string;
    previousStatus: string;
    newStatus: string;
    assignee?: string;
    sprintId?: string;
  };
  'scrum:story-completed': {
    storyId: string;
    title: string;
    storyPoints: number;
    sprintId: string;
  };

  // --- Time Tracking events ---
  'time:entry-logged': {
    taskId: string;
    userId: string;
    minutes: number;
    date: string;
  };
  'time:timesheet-generated': {
    userId: string;
    period: string;
    totalHours: number;
  };

  // --- Database events ---
  'db:schema-changed': {
    database: string;
    table: string;
    changeType: 'created' | 'altered' | 'dropped';
  };
  'db:index-suggestion': {
    database: string;
    table: string;
    columns: string[];
    reason: string;
  };

  // --- Test events ---
  'test:generated': {
    filePath: string;
    testCount: number;
    framework: string;
  };
  'test:coverage-report': {
    filePath: string;
    coverage: number;
    uncoveredLines: number[];
  };

  // --- Documentation events ---
  'docs:api-updated': {
    endpoint: string;
    method: string;
    changes: string[];
  };
  'docs:stale-detected': {
    filePath: string;
    lastUpdated: string;
    reason: string;
  };

  // --- Performance events ---
  'perf:bottleneck-found': {
    location: string;
    metric: string;
    value: number;
    threshold: number;
  };
  'perf:profile-completed': {
    target: string;
    durationMs: number;
    results: Record<string, number>;
  };

  // --- Retrospective events ---
  'retro:action-item-created': {
    retroId: string;
    item: string;
    assignee: string;
    dueDate?: string;
  };
  'retro:completed': {
    sprintId: string;
    retroId: string;
    actionItems: number;
    participants: number;
  };

  // --- Economics events ---
  'economics:budget-alert': {
    project: string;
    percentUsed: number;
    threshold: number;
    remaining: number;
  };
  'economics:cost-updated': {
    category: string;
    amount: number;
    totalSpent: number;
  };

  // --- Standup events ---
  'standup:report-generated': {
    userId: string;
    date: string;
    tasksDone: number;
    tasksInProgress: number;
    blockers: number;
  };

  // --- Decision events ---
  'decision:created': {
    decisionId: string;
    title: string;
    status: string;
  };
  'decision:superseded': {
    decisionId: string;
    supersededBy: string;
    title: string;
  };

  // --- Incident events ---
  'incident:opened': {
    incidentId: string;
    title: string;
    severity: string;
    affectedSystems: string[];
  };
  'incident:resolved': {
    incidentId: string;
    title: string;
    resolution: string;
    durationMinutes: number;
  };
  'incident:escalated': {
    incidentId: string;
    title: string;
    previousSeverity: string;
    newSeverity: string;
  };

  // --- Workflow events ---
  'workflow:triggered': {
    workflowId: string;
    name: string;
    triggeredBy: string;
  };
  'workflow:completed': {
    workflowId: string;
    runId: string;
    name: string;
    durationMs: number;
  };
  'workflow:failed': {
    workflowId: string;
    runId: string;
    name: string;
    error: string;
  };

  // --- Access events ---
  'access:denied': {
    userId: string;
    server: string;
    tool: string;
    reason: string;
  };
  'access:policy-updated': {
    policyId: string;
    name: string;
    effect: string;
  };

  // --- Quality Gate events ---
  'quality:gate-passed': {
    gateName: string;
    project: string;
    results: Record<string, unknown>;
  };
  'quality:gate-failed': {
    gateName: string;
    project: string;
    failures: string[];
  };

  // --- Registry events ---
  'registry:server-registered': {
    serverName: string;
    url: string;
    capabilities: string[];
  };
  'registry:server-unhealthy': {
    serverName: string;
    lastHealthy: string;
    error: string;
  };

  // --- Extended Time Tracking events ---
  'time:anomaly-detected': {
    userId: string;
    taskId: string;
    anomalyType: string;
    details: string;
  };

  // --- Knowledge events ---
  'knowledge:index-updated': {
    directory: string;
    filesIndexed: number;
    timestamp: string;
  };
  'knowledge:dependency-changed': {
    packageName: string;
    previousVersion: string;
    newVersion: string;
  };

  // --- Extended Metrics events ---
  'metrics:risk-predicted': {
    sprintId: string;
    riskLevel: string;
    factors: string[];
  };

  // --- Extended Economics events ---
  'economics:feature-costed': {
    featureId: string;
    totalCost: number;
    currency: string;
  };

  // --- Extended Retrospective events ---
  'retro:pattern-detected': {
    pattern: string;
    occurrences: number;
    retroIds: string[];
  };
}

export type EventName = keyof EventMap;
export type EventPayload<E extends EventName> = EventMap[E];
