#!/usr/bin/env node

/**
 * Entry point for the Insight Engine MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { McpClientManager } from '@mcp-suite/client-manager';
import { createInsightEngineServer } from './server.js';

const eventBus = new LocalEventBus();
const clientManager = new McpClientManager();
clientManager.registerMany([
  { name: 'agile-metrics', transport: 'http', url: process.env.MCP_SUITE_AGILE_METRICS_URL || 'http://localhost:3001/mcp' },
  { name: 'time-tracking', transport: 'http', url: process.env.MCP_SUITE_TIME_TRACKING_URL || 'http://localhost:3022/mcp' },
  { name: 'project-economics', transport: 'http', url: process.env.MCP_SUITE_PROJECT_ECONOMICS_URL || 'http://localhost:3016/mcp' },
  { name: 'code-review', transport: 'http', url: process.env.MCP_SUITE_CODE_REVIEW_URL || 'http://localhost:3005/mcp' },
  { name: 'scrum-board', transport: 'http', url: process.env.MCP_SUITE_SCRUM_BOARD_URL || 'http://localhost:3018/mcp' },
]);
const suite = createInsightEngineServer({ eventBus, clientManager });
startServer(suite).catch((error) => {
  console.error('Failed to start insight-engine server:', error);
  process.exit(1);
});
