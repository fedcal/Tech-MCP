#!/usr/bin/env node

/**
 * Entry point for the Agile Metrics MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { McpClientManager } from '@mcp-suite/client-manager';
import { createAgileMetricsServer } from './server.js';

const eventBus = new LocalEventBus();
const clientManager = new McpClientManager();
clientManager.registerMany([
  { name: 'scrum-board', transport: 'http', url: process.env.MCP_SUITE_SCRUM_BOARD_URL || 'http://localhost:3018/mcp' },
  { name: 'time-tracking', transport: 'http', url: process.env.MCP_SUITE_TIME_TRACKING_URL || 'http://localhost:3022/mcp' },
]);
const suite = createAgileMetricsServer({ eventBus, clientManager });
startServer(suite).catch((error) => {
  console.error('Failed to start agile-metrics server:', error);
  process.exit(1);
});
