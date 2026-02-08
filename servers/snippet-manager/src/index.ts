#!/usr/bin/env node

/**
 * Entry point for the Snippet Manager MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createSnippetManagerServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createSnippetManagerServer({ eventBus });
startServer(suite).catch((error) => {
  console.error('Failed to start snippet-manager server:', error);
  process.exit(1);
});
