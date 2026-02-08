#!/usr/bin/env node

/**
 * Entry point for the Environment Manager MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createEnvironmentManagerServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createEnvironmentManagerServer({ eventBus });
startServer(suite).catch((error) => {
  console.error('Failed to start environment-manager server:', error);
  process.exit(1);
});
