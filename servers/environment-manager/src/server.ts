/**
 * Environment Manager MCP Server
 * Tools for managing .env files and environment variables across environments.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { EnvStore } from './services/env-store.js';
import { registerListEnvironments } from './tools/list-environments.js';
import { registerGetEnvVars } from './tools/get-env-vars.js';
import { registerCompareEnvironments } from './tools/compare-environments.js';
import { registerValidateEnv } from './tools/validate-env.js';
import { registerGenerateEnvTemplate } from './tools/generate-env-template.js';

export function createEnvironmentManagerServer(
  options?: { eventBus?: EventBus; storeOptions?: { inMemory?: boolean } },
): McpSuiteServer {
  const suite = createMcpServer({
    name: 'environment-manager',
    version: '0.1.0',
    description: 'MCP server for managing .env files and environment variables across environments',
    eventBus: options?.eventBus,
  });

  const store = new EnvStore(options?.storeOptions);

  // Register all tools
  registerListEnvironments(suite.server, store);
  registerGetEnvVars(suite.server, store);
  registerCompareEnvironments(suite.server, store);
  registerValidateEnv(suite.server, store);
  registerGenerateEnvTemplate(suite.server, store);

  suite.logger.info('All environment-manager tools registered');

  return suite;
}
