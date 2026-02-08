/**
 * Shared domain types used across multiple MCP Suite servers.
 */

// --- Tool Result Types ---

export interface ToolSuccess<T = unknown> {
  success: true;
  data: T;
  metadata?: Record<string, unknown>;
}

export interface ToolError {
  success: false;
  error: string;
  code: string;
  details?: unknown;
}

export type ToolResult<T = unknown> = ToolSuccess<T> | ToolError;

// --- Code & Git Types ---

export interface FileReference {
  path: string;
  language?: string;
  startLine?: number;
  endLine?: number;
}

export interface GitCommitInfo {
  hash: string;
  author: string;
  date: string;
  message: string;
  files: string[];
}

export interface CodeIssue {
  file: string;
  line: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  rule?: string;
  suggestion?: string;
}

// --- Project Management Types ---

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked';

export interface TaskReference {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assignee?: string;
  storyPoints?: number;
  sprintId?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  storyPoints: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: TaskStatus;
  tasks: string[];
  sprintId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SprintInfo {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  goals: string[];
  status: 'planning' | 'active' | 'completed';
  storyIds: string[];
}

// --- Time Tracking Types ---

export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  startTime: string;
  endTime?: string;
  durationMinutes: number;
  description?: string;
  date: string;
}

// --- Agile Metrics Types ---

export interface ProjectMetrics {
  velocity: number;
  burndownData: BurndownPoint[];
  cycleTime: number;
  leadTime: number;
}

export interface BurndownPoint {
  date: string;
  remaining: number;
  ideal: number;
}

// --- Economics Types ---

export interface BudgetInfo {
  totalBudget: number;
  spent: number;
  remaining: number;
  currency: string;
  breakdown: BudgetCategory[];
}

export interface BudgetCategory {
  category: string;
  amount: number;
  description?: string;
}

export interface CostEntry {
  id: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  taskId?: string;
}

// --- Retrospective Types ---

export type RetroFormat = 'mad-sad-glad' | '4ls' | 'start-stop-continue';

export interface RetroItem {
  id: string;
  retroId: string;
  category: string;
  content: string;
  votes: number;
  authorId?: string;
}

export interface ActionItem {
  id: string;
  retroId: string;
  description: string;
  assignee: string;
  dueDate?: string;
  status: 'open' | 'in_progress' | 'done';
}

// --- Environment Types ---

export interface EnvVariable {
  key: string;
  value: string;
  isSecret: boolean;
  description?: string;
}

export interface EnvironmentConfig {
  name: string;
  variables: EnvVariable[];
}

// --- Snippet Types ---

export interface CodeSnippet {
  id: string;
  title: string;
  code: string;
  language: string;
  description?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// --- HTTP Client Types ---

export interface HttpRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  queryParams?: Record<string, string>;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  durationMs: number;
}

// --- Docker Types ---

export interface DockerService {
  name: string;
  image: string;
  status: 'running' | 'stopped' | 'error';
  ports?: string[];
  health?: 'healthy' | 'unhealthy' | 'starting' | 'none';
}

// --- CI/CD Types ---

export type PipelineStatus = 'running' | 'success' | 'failed' | 'cancelled' | 'pending';

export interface PipelineRun {
  id: string;
  name: string;
  status: PipelineStatus;
  branch: string;
  commit: string;
  startedAt: string;
  finishedAt?: string;
  durationSeconds?: number;
  stages: PipelineStage[];
}

export interface PipelineStage {
  name: string;
  status: PipelineStatus;
  durationSeconds?: number;
}

// --- Database Types ---

export interface TableInfo {
  name: string;
  schema: string;
  columns: ColumnInfo[];
  rowCount?: number;
  indexes?: IndexInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: string;
  foreignKey?: ForeignKeyInfo;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface ForeignKeyInfo {
  table: string;
  column: string;
}

// --- Decision Log Types ---

export type DecisionStatus = 'proposed' | 'accepted' | 'deprecated' | 'superseded';

export interface DecisionRecord {
  id: string;
  title: string;
  context: string;
  decision: string;
  alternatives: string[];
  consequences: string;
  status: DecisionStatus;
  relatedTickets: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DecisionLink {
  id: string;
  decisionId: string;
  linkType: 'ticket' | 'commit' | 'impact' | 'related';
  targetId: string;
  description?: string;
}

// --- Incident Management Types ---

export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentStatus = 'open' | 'investigating' | 'mitigating' | 'resolved' | 'postmortem';

export interface IncidentRecord {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  affectedSystems: string[];
  resolution?: string;
  rootCause?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface TimelineEntry {
  id: string;
  incidentId: string;
  description: string;
  source?: string;
  timestamp: string;
}

// --- Workflow Types ---

export interface WorkflowTrigger {
  event: string;
  conditions?: Record<string, unknown>;
}

export interface WorkflowStep {
  server: string;
  tool: string;
  arguments: Record<string, unknown>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  active: boolean;
  createdAt: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  payload?: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

// --- Access Policy Types ---

export interface AccessRule {
  server: string;
  tool?: string;
  roles: string[];
}

export interface AccessPolicy {
  id: string;
  name: string;
  effect: 'allow' | 'deny';
  rules: AccessRule[];
  createdAt: string;
}

// --- Quality Gate Types ---

export type GateOperator = '>=' | '<=' | '>' | '<' | '==' | '!=';

export interface GateCheck {
  metric: string;
  operator: GateOperator;
  threshold: number;
}

export interface QualityGate {
  id: string;
  name: string;
  projectName?: string;
  checks: GateCheck[];
  createdAt: string;
}

export interface GateEvaluation {
  id: string;
  gateId: string;
  passed: boolean;
  results: Record<string, unknown>;
  evaluatedAt: string;
}

// --- Server Registry Types ---

export interface ServerRegistration {
  id: string;
  name: string;
  url: string;
  transport: string;
  capabilities: string[];
  status: 'healthy' | 'unhealthy' | 'unknown';
  createdAt: string;
}
