/**
 * Project Scaffolding MCP Server
 * Tools for generating project boilerplate from built-in templates.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { ScaffoldingStore } from './services/scaffolding-store.js';
import { registerListTemplates } from './tools/list-templates.js';
import { registerScaffoldProject } from './tools/scaffold-project.js';
import { registerScaffoldComponent } from './tools/scaffold-component.js';

export function createProjectScaffoldingServer(
  options?: { eventBus?: EventBus; storeOptions?: { inMemory?: boolean } },
): McpSuiteServer {
  const suite = createMcpServer({
    name: 'project-scaffolding',
    version: '0.1.0',
    description: 'MCP server for generating project boilerplate from templates',
    eventBus: options?.eventBus,
  });

  const store = new ScaffoldingStore(options?.storeOptions);

  // Register all tools
  registerListTemplates(suite.server);
  registerScaffoldProject(suite.server, store);
  registerScaffoldComponent(suite.server, store);

  suite.logger.info('All project-scaffolding tools registered');

  return suite;
}
