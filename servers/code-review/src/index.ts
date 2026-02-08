#!/usr/bin/env node

/**
 * Entry point for the Code Review MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createCodeReviewServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createCodeReviewServer({ eventBus });
startServer(suite).catch((error) => {
  console.error('Failed to start code-review server:', error);
  process.exit(1);
});
