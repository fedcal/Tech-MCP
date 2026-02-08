#!/usr/bin/env node

/**
 * Entry point for the Time Tracking MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createTimeTrackingServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createTimeTrackingServer({ eventBus });
startServer(suite).catch((error) => {
  console.error('Failed to start time-tracking server:', error);
  process.exit(1);
});
