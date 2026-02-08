#!/usr/bin/env node

/**
 * Entry point for the Access Policy MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createAccessPolicyServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createAccessPolicyServer({ eventBus });
startServer(suite).catch((error) => {
  console.error('Failed to start access-policy server:', error);
  process.exit(1);
});
