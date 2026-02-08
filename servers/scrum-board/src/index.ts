#!/usr/bin/env node

/**
 * Entry point for the Scrum Board MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createScrumBoardServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createScrumBoardServer({ eventBus });
startServer(suite).catch((error) => {
  console.error('Failed to start scrum-board server:', error);
  process.exit(1);
});
