/**
 * Docker Compose MCP Server
 * Tools for managing Docker Compose stacks: parsing, analyzing, listing, and generating.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { registerParseCompose } from './tools/parse-compose.js';
import { registerAnalyzeDockerfile } from './tools/analyze-dockerfile.js';
import { registerListServices } from './tools/list-services.js';
import { registerGenerateCompose } from './tools/generate-compose.js';
import { DockerStore } from './services/docker-store.js';

export function createDockerComposeServer(
  options?: { eventBus?: EventBus; storeOptions?: { inMemory?: boolean } },
): McpSuiteServer {
  const suite = createMcpServer({
    name: 'docker-compose',
    version: '0.1.0',
    description: 'MCP server for managing Docker Compose stacks',
    eventBus: options?.eventBus,
  });

  const store = new DockerStore(options?.storeOptions);

  // Register all tools
  registerParseCompose(suite.server, store);
  registerAnalyzeDockerfile(suite.server, store);
  registerListServices(suite.server, store);
  registerGenerateCompose(suite.server, store);

  suite.logger.info('All docker-compose tools registered');

  return suite;
}
