import { describe, it, expect } from 'vitest';
import { createMcpServer } from '../src/server-factory.js';

describe('createMcpServer', () => {
  it('should create a server with required options', () => {
    const suite = createMcpServer({ name: 'test-server', version: '1.0.0' });
    expect(suite.server).toBeDefined();
    expect(suite.config).toBeDefined();
    expect(suite.logger).toBeDefined();
  });

  it('should include eventBus when provided', () => {
    const mockBus = { publish: async () => {}, subscribe: () => () => {}, subscribePattern: () => () => {}, clear: () => {} };
    const suite = createMcpServer({ name: 'test', version: '1.0.0', eventBus: mockBus as any });
    expect(suite.eventBus).toBe(mockBus);
  });

  it('should have undefined eventBus when not provided', () => {
    const suite = createMcpServer({ name: 'test', version: '1.0.0' });
    expect(suite.eventBus).toBeUndefined();
  });
});
