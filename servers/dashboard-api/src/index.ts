#!/usr/bin/env node

/**
 * Entry point for the Dashboard API MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { McpClientManager } from '@mcp-suite/client-manager';
import { createDashboardApiServer } from './server.js';

const eventBus = new LocalEventBus();
const clientManager = new McpClientManager();

clientManager.registerMany([
  { name: 'agile-metrics', transport: 'http', url: process.env.MCP_SUITE_AGILE_METRICS_URL || 'http://localhost:3001/mcp' },
  { name: 'time-tracking', transport: 'http', url: process.env.MCP_SUITE_TIME_TRACKING_URL || 'http://localhost:3022/mcp' },
  { name: 'project-economics', transport: 'http', url: process.env.MCP_SUITE_PROJECT_ECONOMICS_URL || 'http://localhost:3016/mcp' },
  { name: 'scrum-board', transport: 'http', url: process.env.MCP_SUITE_SCRUM_BOARD_URL || 'http://localhost:3018/mcp' },
  { name: 'decision-log', transport: 'http', url: process.env.MCP_SUITE_DECISION_LOG_URL || 'http://localhost:3006/mcp' },
  { name: 'incident-manager', transport: 'http', url: process.env.MCP_SUITE_INCIDENT_MANAGER_URL || 'http://localhost:3011/mcp' },
  { name: 'retrospective-manager', transport: 'http', url: process.env.MCP_SUITE_RETROSPECTIVE_MANAGER_URL || 'http://localhost:3017/mcp' },
  { name: 'mcp-registry', transport: 'http', url: process.env.MCP_SUITE_MCP_REGISTRY_URL || 'http://localhost:3013/mcp' },
  { name: 'quality-gate', transport: 'http', url: process.env.MCP_SUITE_QUALITY_GATE_URL || 'http://localhost:3019/mcp' },
  { name: 'code-review', transport: 'http', url: process.env.MCP_SUITE_CODE_REVIEW_URL || 'http://localhost:3004/mcp' },
]);

const suite = createDashboardApiServer({ eventBus, clientManager });
startServer(suite).catch((error) => {
  console.error('Failed to start dashboard-api server:', error);
  process.exit(1);
});
