/**
 * Factory for the Incident Manager MCP server.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { IncidentStore } from './services/incident-store.js';
import { registerOpenIncident } from './tools/open-incident.js';
import { registerUpdateIncident } from './tools/update-incident.js';
import { registerAddTimelineEntry } from './tools/add-timeline-entry.js';
import { registerResolveIncident } from './tools/resolve-incident.js';
import { registerGeneratePostmortem } from './tools/generate-postmortem.js';
import { registerListIncidents } from './tools/list-incidents.js';
import { setupCollaborationHandlers } from './collaboration.js';

export function createIncidentManagerServer(
  options?: {
    eventBus?: EventBus;
    storeOptions?: { inMemory?: boolean };
  },
): McpSuiteServer {
  const suite = createMcpServer({
    name: 'incident-manager',
    version: '0.1.0',
    description: 'MCP server for incident lifecycle management',
    eventBus: options?.eventBus,
  });

  const store = new IncidentStore(options?.storeOptions);

  registerOpenIncident(suite.server, store, suite.eventBus);
  registerUpdateIncident(suite.server, store, suite.eventBus);
  registerAddTimelineEntry(suite.server, store);
  registerResolveIncident(suite.server, store, suite.eventBus);
  registerGeneratePostmortem(suite.server, store);
  registerListIncidents(suite.server, store);

  if (suite.eventBus) {
    setupCollaborationHandlers(suite.eventBus, store);
  }

  suite.logger.info('All incident-manager tools registered');
  return suite;
}
