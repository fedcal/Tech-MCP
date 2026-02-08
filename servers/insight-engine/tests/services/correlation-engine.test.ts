import { describe, it, expect, vi } from 'vitest';
import { CorrelationEngine } from '../../src/services/correlation-engine.js';

describe('CorrelationEngine', () => {
  it('should return null from safeCall when clientManager is undefined', async () => {
    const engine = new CorrelationEngine(undefined);
    const result = await engine.safeCall('agile-metrics', 'calculate-velocity');
    expect(result).toBeNull();
  });

  it('should return null from safeCall when server throws', async () => {
    const mockClientManager = {
      callTool: vi.fn().mockRejectedValue(new Error('Connection refused')),
      register: vi.fn(),
      registerMany: vi.fn(),
      getClient: vi.fn(),
      disconnect: vi.fn(),
      disconnectAll: vi.fn(),
    };
    const engine = new CorrelationEngine(mockClientManager as never);
    const result = await engine.safeCall('agile-metrics', 'calculate-velocity');
    expect(result).toBeNull();
  });

  it('should return health structure with all unavailable when no clientManager', async () => {
    const engine = new CorrelationEngine(undefined);
    const health = await engine.getProjectHealth();

    expect(health).toHaveProperty('healthScore', 0);
    expect(health).toHaveProperty('dataSources');
    expect(health).toHaveProperty('generatedAt');

    const ds = health.dataSources as Record<string, string>;
    expect(ds['agile-metrics']).toBe('unavailable');
    expect(ds['time-tracking']).toBe('unavailable');
    expect(ds['project-economics']).toBe('unavailable');

    expect((health.velocity as Record<string, unknown>).status).toBe('unavailable');
    expect((health.timeTracking as Record<string, unknown>).status).toBe('unavailable');
    expect((health.budget as Record<string, unknown>).status).toBe('unavailable');
  });

  it('should correlate known and unknown metrics', async () => {
    const engine = new CorrelationEngine(undefined);
    const result = await engine.correlateMetrics(['velocity', 'unknown-metric']);

    expect(result).toHaveProperty('metrics');
    expect(result).toHaveProperty('dataSources');
    expect(result).toHaveProperty('analyzedAt');

    const metrics = result.metrics as Record<string, Record<string, unknown>>;
    // velocity is a known metric but no clientManager -> unavailable
    expect(metrics.velocity).toEqual({ status: 'unavailable' });
    // unknown-metric is not in the map
    expect(metrics['unknown-metric']).toEqual({ status: 'unknown-metric' });

    const ds = result.dataSources as Record<string, string>;
    expect(ds.velocity).toBe('unavailable');
    expect(ds['unknown-metric']).toBe('unknown');
  });
});
