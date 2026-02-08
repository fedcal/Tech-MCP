#!/usr/bin/env node

/**
 * Entry point for the Codebase Knowledge MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createCodebaseKnowledgeServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createCodebaseKnowledgeServer({ eventBus });
startServer(suite).catch((error) => {
  console.error('Failed to start codebase-knowledge server:', error);
  process.exit(1);
});
