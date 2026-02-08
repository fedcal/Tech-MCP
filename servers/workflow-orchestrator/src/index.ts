#!/usr/bin/env node

/**
 * Entry point for the Workflow Orchestrator MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { McpClientManager } from '@mcp-suite/client-manager';
import { createWorkflowOrchestratorServer } from './server.js';

const eventBus = new LocalEventBus();
const clientManager = new McpClientManager();
clientManager.registerMany([
  { name: 'agile-metrics', transport: 'http', url: process.env.MCP_SUITE_AGILE_METRICS_URL || 'http://localhost:3001/mcp' },
  { name: 'time-tracking', transport: 'http', url: process.env.MCP_SUITE_TIME_TRACKING_URL || 'http://localhost:3022/mcp' },
  { name: 'scrum-board', transport: 'http', url: process.env.MCP_SUITE_SCRUM_BOARD_URL || 'http://localhost:3018/mcp' },
  { name: 'decision-log', transport: 'http', url: process.env.MCP_SUITE_DECISION_LOG_URL || 'http://localhost:3008/mcp' },
  { name: 'incident-manager', transport: 'http', url: process.env.MCP_SUITE_INCIDENT_MANAGER_URL || 'http://localhost:3011/mcp' },
  { name: 'retrospective-manager', transport: 'http', url: process.env.MCP_SUITE_RETRO_MANAGER_URL || 'http://localhost:3017/mcp' },
]);
const suite = createWorkflowOrchestratorServer({ eventBus, clientManager });
startServer(suite).catch((error) => {
  console.error('Failed to start workflow-orchestrator server:', error);
  process.exit(1);
});
