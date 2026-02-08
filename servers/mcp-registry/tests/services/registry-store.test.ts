import { describe, it, expect } from 'vitest';
import { RegistryStore } from '../../src/services/registry-store.js';

describe('RegistryStore', () => {
  function createStore() {
    return new RegistryStore({ inMemory: true });
  }

  it('should register and retrieve a server', () => {
    const store = createStore();
    const server = store.registerServer({
      name: 'test-server',
      url: 'http://localhost:3000',
      transport: 'http',
      capabilities: ['tools', 'resources'],
    });

    expect(server.id).toBeDefined();
    expect(server.name).toBe('test-server');
    expect(server.url).toBe('http://localhost:3000');
    expect(server.transport).toBe('http');
    expect(server.capabilities).toEqual(['tools', 'resources']);
    expect(server.status).toBe('unknown');

    const retrieved = store.getServer(server.id);
    expect(retrieved).toEqual(server);
  });

  it('should retrieve a server by name', () => {
    const store = createStore();
    store.registerServer({ name: 'my-server', url: 'stdio://local' });

    const found = store.getServerByName('my-server');
    expect(found).toBeDefined();
    expect(found!.name).toBe('my-server');

    const notFound = store.getServerByName('nonexistent');
    expect(notFound).toBeUndefined();
  });

  it('should use default transport and capabilities', () => {
    const store = createStore();
    const server = store.registerServer({ name: 'minimal', url: 'stdio://local' });

    expect(server.transport).toBe('stdio');
    expect(server.capabilities).toEqual([]);
  });

  it('should list servers with filters', () => {
    const store = createStore();
    store.registerServer({ name: 'srv-1', url: 'http://a', transport: 'http' });
    store.registerServer({ name: 'srv-2', url: 'stdio://b', transport: 'stdio' });
    store.registerServer({ name: 'srv-3', url: 'http://c', transport: 'http' });

    const all = store.listServers();
    expect(all).toHaveLength(3);

    const httpOnly = store.listServers({ transport: 'http' });
    expect(httpOnly).toHaveLength(2);

    const stdioOnly = store.listServers({ transport: 'stdio' });
    expect(stdioOnly).toHaveLength(1);
  });

  it('should update server status', () => {
    const store = createStore();
    const server = store.registerServer({ name: 'srv', url: 'http://a' });
    expect(server.status).toBe('unknown');

    const updated = store.updateServerStatus(server.id, 'healthy');
    expect(updated).toBeDefined();
    expect(updated!.status).toBe('healthy');
  });

  it('should record a health check and update server', () => {
    const store = createStore();
    const server = store.registerServer({ name: 'srv', url: 'http://a' });

    const hc = store.recordHealthCheck({
      serverId: server.id,
      status: 'healthy',
      responseTimeMs: 150,
    });

    expect(hc.id).toBeDefined();
    expect(hc.serverId).toBe(server.id);
    expect(hc.status).toBe('healthy');
    expect(hc.responseTimeMs).toBe(150);

    // Server status should be updated
    const updatedServer = store.getServer(server.id);
    expect(updatedServer!.status).toBe('healthy');
    expect(updatedServer!.lastHealthCheck).toBeDefined();
  });

  it('should get health history with limit', () => {
    const store = createStore();
    const server = store.registerServer({ name: 'srv', url: 'http://a' });

    store.recordHealthCheck({ serverId: server.id, status: 'healthy', responseTimeMs: 100 });
    store.recordHealthCheck({ serverId: server.id, status: 'healthy', responseTimeMs: 200 });
    store.recordHealthCheck({ serverId: server.id, status: 'unhealthy', error: 'timeout' });

    const allChecks = store.getHealthHistory(server.id);
    expect(allChecks).toHaveLength(3);

    const limited = store.getHealthHistory(server.id, 2);
    expect(limited).toHaveLength(2);
  });

  it('should remove a server and its health checks', () => {
    const store = createStore();
    const server = store.registerServer({ name: 'srv', url: 'http://a' });
    store.recordHealthCheck({ serverId: server.id, status: 'healthy', responseTimeMs: 100 });

    const removed = store.removeServer(server.id);
    expect(removed).toBe(true);

    expect(store.getServer(server.id)).toBeUndefined();
    expect(store.getHealthHistory(server.id)).toHaveLength(0);
  });

  it('should return false when removing non-existent server', () => {
    const store = createStore();
    expect(store.removeServer(999)).toBe(false);
  });

  it('should return undefined for non-existent server', () => {
    const store = createStore();
    expect(store.getServer(999)).toBeUndefined();
    expect(store.updateServerStatus(999, 'healthy')).toBeUndefined();
  });
});
