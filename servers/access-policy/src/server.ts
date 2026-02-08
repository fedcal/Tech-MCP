/**
 * Access Policy MCP Server
 * Tools for RBAC/ABAC access control: policy management, role assignment,
 * access checking, and audit logging.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { PolicyStore } from './services/policy-store.js';
import { registerCreatePolicy } from './tools/create-policy.js';
import { registerCheckAccess } from './tools/check-access.js';
import { registerListPolicies } from './tools/list-policies.js';
import { registerAssignRole } from './tools/assign-role.js';
import { registerAuditAccess } from './tools/audit-access.js';

export function createAccessPolicyServer(
  options?: {
    eventBus?: EventBus;
    storeOptions?: { inMemory?: boolean };
  },
): McpSuiteServer {
  const suite = createMcpServer({
    name: 'access-policy',
    version: '0.1.0',
    description: 'MCP server for RBAC/ABAC access control with policy management and audit logging',
    eventBus: options?.eventBus,
  });

  const store = new PolicyStore(options?.storeOptions);

  // Register all tools
  registerCreatePolicy(suite.server, store, suite.eventBus);
  registerCheckAccess(suite.server, store, suite.eventBus);
  registerListPolicies(suite.server, store);
  registerAssignRole(suite.server, store);
  registerAuditAccess(suite.server, store);

  suite.logger.info('All access-policy tools registered');
  return suite;
}
