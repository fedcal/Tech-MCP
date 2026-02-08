#!/usr/bin/env node

/**
 * Entry point for the Decision Log MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createDecisionLogServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createDecisionLogServer({ eventBus });
startServer(suite).catch((error) => {
  console.error('Failed to start decision-log server:', error);
  process.exit(1);
});
