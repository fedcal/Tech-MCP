#!/usr/bin/env node

/**
 * Entry point for the Docker Compose MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createDockerComposeServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createDockerComposeServer({ eventBus });
startServer(suite).catch((error) => {
  console.error('Failed to start docker-compose server:', error);
  process.exit(1);
});
