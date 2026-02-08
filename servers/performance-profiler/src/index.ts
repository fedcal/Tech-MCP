#!/usr/bin/env node

/**
 * Entry point for the Performance Profiler MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createPerformanceProfilerServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createPerformanceProfilerServer({ eventBus });
startServer(suite).catch((error) => {
  console.error('Failed to start performance-profiler server:', error);
  process.exit(1);
});
