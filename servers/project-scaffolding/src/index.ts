#!/usr/bin/env node

/**
 * Entry point for the Project Scaffolding MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createProjectScaffoldingServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createProjectScaffoldingServer({ eventBus });
startServer(suite).catch((error) => {
  console.error('Failed to start project-scaffolding server:', error);
  process.exit(1);
});
