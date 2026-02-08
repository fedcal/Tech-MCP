#!/usr/bin/env node

/**
 * Entry point for the Retrospective Manager MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createRetrospectiveManagerServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createRetrospectiveManagerServer({ eventBus });
startServer(suite).catch((error) => {
  console.error('Failed to start retrospective-manager server:', error);
  process.exit(1);
});
