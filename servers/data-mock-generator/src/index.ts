#!/usr/bin/env node

/**
 * Entry point for the Data Mock Generator MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { McpClientManager } from '@mcp-suite/client-manager';
import { createDataMockGeneratorServer } from './server.js';

const eventBus = new LocalEventBus();
const clientManager = new McpClientManager();
clientManager.register({
  name: 'db-schema-explorer',
  transport: 'http',
  url: process.env.MCP_SUITE_DB_SCHEMA_EXPLORER_URL || 'http://localhost:3007/mcp',
});
const suite = createDataMockGeneratorServer({ eventBus, clientManager });
startServer(suite).catch((error) => {
  console.error('Failed to start data-mock-generator server:', error);
  process.exit(1);
});
