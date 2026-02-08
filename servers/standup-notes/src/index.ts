#!/usr/bin/env node

/**
 * Entry point for the Standup Notes MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { McpClientManager } from '@mcp-suite/client-manager';
import { createStandupNotesServer } from './server.js';

const eventBus = new LocalEventBus();
const clientManager = new McpClientManager();
clientManager.register({
  name: 'scrum-board',
  transport: 'http',
  url: process.env.MCP_SUITE_SCRUM_BOARD_URL || 'http://localhost:3018/mcp',
});
const suite = createStandupNotesServer({ eventBus, clientManager });
startServer(suite).catch((error) => {
  console.error('Failed to start standup-notes server:', error);
  process.exit(1);
});
