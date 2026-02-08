/**
 * Dependency Manager MCP Server
 * Tools for analyzing project dependencies: vulnerability scanning, unused
 * dependency detection, and license auditing.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { DependencyStore } from './services/dependency-store.js';
import { registerCheckVulnerabilities } from './tools/check-vulnerabilities.js';
import { registerFindUnused } from './tools/find-unused.js';
import { registerLicenseAudit } from './tools/license-audit.js';

export function createDependencyManagerServer(
  options?: { eventBus?: EventBus; storeOptions?: { inMemory?: boolean } },
): McpSuiteServer {
  const suite = createMcpServer({
    name: 'dependency-manager',
    version: '0.1.0',
    description: 'MCP server for analyzing project dependencies, vulnerabilities, and licenses',
    eventBus: options?.eventBus,
  });

  const store = new DependencyStore(options?.storeOptions);

  // Register all tools
  registerCheckVulnerabilities(suite.server, store, suite.eventBus);
  registerFindUnused(suite.server, store);
  registerLicenseAudit(suite.server, store);

  suite.logger.info('All dependency-manager tools registered');

  return suite;
}
