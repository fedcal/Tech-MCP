#!/usr/bin/env node

/**
 * Entry point for the Log Analyzer MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createLogAnalyzerServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createLogAnalyzerServer({ eventBus });
startServer(suite).catch((error) => {
  console.error('Failed to start log-analyzer server:', error);
  process.exit(1);
});
