#!/usr/bin/env node

/**
 * Entry point for the Test Generator MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { McpClientManager } from '@mcp-suite/client-manager';
import { createTestGeneratorServer } from './server.js';

const eventBus = new LocalEventBus();
const clientManager = new McpClientManager();
clientManager.register({
  name: 'codebase-knowledge',
  transport: 'http',
  url: process.env.MCP_SUITE_CODEBASE_KNOWLEDGE_URL || 'http://localhost:3005/mcp',
});
const suite = createTestGeneratorServer({ eventBus, clientManager });
startServer(suite).catch((error) => {
  console.error('Failed to start test-generator server:', error);
  process.exit(1);
});
