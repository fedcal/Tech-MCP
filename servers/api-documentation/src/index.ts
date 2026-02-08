#!/usr/bin/env node

/**
 * Entry point for the API Documentation MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createApiDocumentationServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createApiDocumentationServer({ eventBus });
startServer(suite).catch((error) => {
  console.error('Failed to start api-documentation server:', error);
  process.exit(1);
});
