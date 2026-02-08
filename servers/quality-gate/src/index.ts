#!/usr/bin/env node

/**
 * Entry point for the Quality Gate MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createQualityGateServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createQualityGateServer({ eventBus });
startServer(suite).catch((error) => {
  console.error('Failed to start quality-gate server:', error);
  process.exit(1);
});
