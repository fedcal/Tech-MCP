#!/usr/bin/env node

/**
 * Entry point for the CI/CD Monitor MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createCicdMonitorServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createCicdMonitorServer({ eventBus });
startServer(suite).catch((error) => {
  console.error('Failed to start cicd-monitor server:', error);
  process.exit(1);
});
