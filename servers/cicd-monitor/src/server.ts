/**
 * CI/CD Monitor MCP Server
 * Tools for monitoring GitHub Actions pipelines, viewing logs, and detecting flaky tests.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { registerListPipelines } from './tools/list-pipelines.js';
import { registerGetPipelineStatus } from './tools/get-pipeline-status.js';
import { registerGetBuildLogs } from './tools/get-build-logs.js';
import { registerGetFlakyTests } from './tools/get-flaky-tests.js';
import { CicdStore } from './services/cicd-store.js';

export function createCicdMonitorServer(
  options?: { eventBus?: EventBus; storeOptions?: { inMemory?: boolean } },
): McpSuiteServer {
  const suite = createMcpServer({
    name: 'cicd-monitor',
    version: '0.1.0',
    description: 'MCP server for monitoring CI/CD pipelines (GitHub Actions)',
    eventBus: options?.eventBus,
  });

  const store = new CicdStore(options?.storeOptions);

  // Register all tools
  registerListPipelines(suite.server, store);
  registerGetPipelineStatus(suite.server, suite.eventBus, store);
  registerGetBuildLogs(suite.server, store);
  registerGetFlakyTests(suite.server, store);

  suite.logger.info('All cicd-monitor tools registered');

  return suite;
}
