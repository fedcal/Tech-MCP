#!/usr/bin/env node

/**
 * Entry point for the Regex Builder MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createRegexBuilderServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createRegexBuilderServer({ eventBus });
startServer(suite).catch((error) => {
  console.error('Failed to start regex-builder server:', error);
  process.exit(1);
});
