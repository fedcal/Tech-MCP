#!/usr/bin/env node

/**
 * Entry point for the DB Schema Explorer MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createDbSchemaExplorerServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createDbSchemaExplorerServer({ eventBus });
startServer(suite).catch((error) => {
  console.error('Failed to start db-schema-explorer server:', error);
  process.exit(1);
});
