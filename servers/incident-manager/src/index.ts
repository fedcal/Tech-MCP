#!/usr/bin/env node

/**
 * Entry point for the Incident Manager MCP server.
 */

import { startServer } from '@mcp-suite/core';
import { LocalEventBus } from '@mcp-suite/event-bus';
import { createIncidentManagerServer } from './server.js';

const eventBus = new LocalEventBus();
const suite = createIncidentManagerServer({ eventBus });
startServer(suite).catch((error) => {
  console.error('Failed to start incident-manager server:', error);
  process.exit(1);
});
