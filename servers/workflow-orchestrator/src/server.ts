/**
 * Factory for the Workflow Orchestrator MCP server.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import type { McpClientManager } from '@mcp-suite/client-manager';
import { WorkflowStore } from './services/workflow-store.js';
import { WorkflowEngine } from './services/workflow-engine.js';
import { registerCreateWorkflow } from './tools/create-workflow.js';
import { registerListWorkflows } from './tools/list-workflows.js';
import { registerTriggerWorkflow } from './tools/trigger-workflow.js';
import { registerGetWorkflowRun } from './tools/get-workflow-run.js';
import { registerToggleWorkflow } from './tools/toggle-workflow.js';
import { setupCollaborationHandlers } from './collaboration.js';

export function createWorkflowOrchestratorServer(options?: {
  eventBus?: EventBus;
  clientManager?: McpClientManager;
  storeOptions?: { inMemory?: boolean };
}): McpSuiteServer {
  const suite = createMcpServer({
    name: 'workflow-orchestrator',
    version: '0.1.0',
    description: 'MCP server for event-driven workflow orchestration',
    eventBus: options?.eventBus,
  });

  const store = new WorkflowStore(options?.storeOptions);
  const engine = new WorkflowEngine(store, options?.clientManager, suite.eventBus);

  registerCreateWorkflow(suite.server, store);
  registerListWorkflows(suite.server, store);
  registerTriggerWorkflow(suite.server, store, engine);
  registerGetWorkflowRun(suite.server, store);
  registerToggleWorkflow(suite.server, store);

  if (suite.eventBus) {
    setupCollaborationHandlers(suite.eventBus, engine);
  }

  suite.logger.info('All workflow-orchestrator tools registered');
  return suite;
}
