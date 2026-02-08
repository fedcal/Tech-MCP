#!/usr/bin/env node

/**
 * Entry point for the MCP Registry MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createMcpRegistryServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createMcpRegistryServer({ eventBus });
startServer(suite).catch((error) => {
  console.error('Failed to start mcp-registry server:', error);
  process.exit(1);
});
