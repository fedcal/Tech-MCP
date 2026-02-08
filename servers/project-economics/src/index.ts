#!/usr/bin/env node

/**
 * Entry point for the Project Economics MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { McpClientManager } from '@mcp-suite/client-manager';
import { createProjectEconomicsServer } from './server.js';

const eventBus = new LocalEventBus();
const clientManager = new McpClientManager();
clientManager.register({
  name: 'time-tracking',
  transport: 'http',
  url: process.env.MCP_SUITE_TIME_TRACKING_URL || 'http://localhost:3022/mcp',
});
const suite = createProjectEconomicsServer({ eventBus, clientManager });
startServer(suite).catch((error) => {
  console.error('Failed to start project-economics server:', error);
  process.exit(1);
});
