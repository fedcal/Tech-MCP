/**
 * Integration test: dashboard-api -> mcp-registry (discover-servers)
 * Verifies that get-server-status can query the mcp-registry via ClientManager.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { McpClientManager } from '@mcp-suite/client-manager';
import { createDashboardApiServer } from '../../src/server.js';
import { createMcpRegistryServer } from '../../../mcp-registry/src/server.js';

describe('get-server-status -> mcp-registry wiring', () => {
  let callerHarness: TestHarness;
  let clientManager: McpClientManager;

  afterEach(async () => {
    if (callerHarness) await callerHarness.close();
    if (clientManager) await clientManager.disconnectAll();
  });

  it('should list registered servers from mcp-registry', async () => {
    // 1. Create mcp-registry in-memory and wire to clientManager
    const registrySuite = createMcpRegistryServer({ storeOptions: { inMemory: true } });
    clientManager = new McpClientManager();
    const [ct, st] = McpClientManager.createInMemoryPair();
    await registrySuite.server.connect(st);
    await clientManager.connectInMemoryWithTransport('mcp-registry', ct);

    // 2. Register a server in the registry via clientManager
    await clientManager.callTool('mcp-registry', 'register-server', {
      name: 'agile-metrics',
      url: 'http://localhost:3017/mcp',
      transport: 'http',
      capabilities: ['calculate-velocity', 'generate-burndown'],
    });

    // 3. Create dashboard-api with clientManager
    const callerSuite = createDashboardApiServer({
      clientManager,
      storeOptions: { inMemory: true },
    });
    callerHarness = await createTestHarness(callerSuite.server);

    // 4. Call get-server-status (no filter)
    const result = await callerHarness.client.callTool({
      name: 'get-server-status',
      arguments: {},
    });
    const status = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );

    // 5. Verify: status should not be 'registry-unavailable'
    expect(status.status).toBe('ok');
    expect(status.serverName).toBe('all');
    expect(status.data).toBeDefined();
  });

  it('should filter servers by name', async () => {
    // 1. Create mcp-registry in-memory and wire to clientManager
    const registrySuite = createMcpRegistryServer({ storeOptions: { inMemory: true } });
    clientManager = new McpClientManager();
    const [ct, st] = McpClientManager.createInMemoryPair();
    await registrySuite.server.connect(st);
    await clientManager.connectInMemoryWithTransport('mcp-registry', ct);

    // 2. Register two servers
    await clientManager.callTool('mcp-registry', 'register-server', {
      name: 'agile-metrics',
      url: 'http://localhost:3017/mcp',
      transport: 'http',
    });
    await clientManager.callTool('mcp-registry', 'register-server', {
      name: 'time-tracking',
      url: 'http://localhost:3018/mcp',
      transport: 'http',
    });

    // 3. Create dashboard-api with clientManager
    const callerSuite = createDashboardApiServer({
      clientManager,
      storeOptions: { inMemory: true },
    });
    callerHarness = await createTestHarness(callerSuite.server);

    // 4. Call get-server-status with serverName filter
    const result = await callerHarness.client.callTool({
      name: 'get-server-status',
      arguments: { serverName: 'agile-metrics' },
    });
    const status = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );

    // 5. Verify: should filter to agile-metrics only
    expect(status.status).toBe('ok');
    expect(status.serverName).toBe('agile-metrics');
  });

  it('should handle registry unavailable', async () => {
    // Create dashboard-api WITHOUT connecting mcp-registry
    clientManager = new McpClientManager();
    const callerSuite = createDashboardApiServer({
      clientManager,
      storeOptions: { inMemory: true },
    });
    callerHarness = await createTestHarness(callerSuite.server);

    // Call get-server-status -> should return registry-unavailable
    const result = await callerHarness.client.callTool({
      name: 'get-server-status',
      arguments: {},
    });
    const status = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );

    expect(status.status).toBe('registry-unavailable');
    expect(status.message).toBeDefined();
  });
});
