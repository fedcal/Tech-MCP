#!/usr/bin/env node

/**
 * Entry point for the Dependency Manager MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createDependencyManagerServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createDependencyManagerServer({ eventBus });
startServer(suite).catch((error) => {
  console.error('Failed to start dependency-manager server:', error);
  process.exit(1);
});
