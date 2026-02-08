/**
 * Factory for the MCP Registry MCP server.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { RegistryStore } from './services/registry-store.js';
import { registerRegisterServer } from './tools/register-server.js';
import { registerDiscoverServers } from './tools/discover-servers.js';
import { registerHealthCheck } from './tools/health-check.js';
import { registerGetCapabilities } from './tools/get-capabilities.js';

export function createMcpRegistryServer(
  options?: {
    eventBus?: EventBus;
    storeOptions?: { inMemory?: boolean };
  },
): McpSuiteServer {
  const suite = createMcpServer({
    name: 'mcp-registry',
    version: '0.1.0',
    description: 'MCP server for server discovery and health monitoring',
    eventBus: options?.eventBus,
  });

  const store = new RegistryStore(options?.storeOptions);

  registerRegisterServer(suite.server, store, suite.eventBus);
  registerDiscoverServers(suite.server, store);
  registerHealthCheck(suite.server, store, suite.eventBus);
  registerGetCapabilities(suite.server, store);

  suite.logger.info('All mcp-registry tools registered');
  return suite;
}
