#!/usr/bin/env node

/**
 * Entry point for the HTTP Client MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createHttpClientServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createHttpClientServer({ eventBus });
startServer(suite).catch((error) => {
  console.error('Failed to start http-client server:', error);
  process.exit(1);
});
