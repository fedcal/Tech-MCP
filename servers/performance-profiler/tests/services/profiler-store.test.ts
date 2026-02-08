import { describe, it, expect, beforeEach } from 'vitest';
import { ProfilerStore } from '../../src/services/profiler-store.js';

describe('ProfilerStore', () => {
  let store: ProfilerStore;

  beforeEach(() => {
    store = new ProfilerStore({ inMemory: true });
  });

  // -- Bundle Analyses -------------------------------------------------------

  describe('saveBundleAnalysis', () => {
    it('should save and return a bundle analysis with an id', () => {
      const record = store.saveBundleAnalysis({
        filePath: '/app/dist/bundle.js',
        totalSize: 245_000,
        result: { chunks: 5, gzipSize: 78_000 },
      });

      expect(record.id).toBe(1);
      expect(record.filePath).toBe('/app/dist/bundle.js');
      expect(record.totalSize).toBe(245_000);
      expect(record.analyzedAt).toBeDefined();
    });

    it('should serialize and deserialize the result JSON field', () => {
      const result = { chunks: 3, assets: ['main.js', 'vendor.js'] };
      const record = store.saveBundleAnalysis({
        filePath: '/app/dist/bundle.js',
        totalSize: 100_000,
        result,
      });

      expect(record.result).toEqual(result);
      expect(typeof record.result).toBe('object');
      expect(Array.isArray((record.result as Record<string, unknown>).assets)).toBe(true);
    });
  });

  describe('listBundleAnalyses', () => {
    it('should return an empty array when no analyses exist', () => {
      expect(store.listBundleAnalyses()).toEqual([]);
    });

    it('should list all bundle analyses', () => {
      store.saveBundleAnalysis({ filePath: 'a.js', totalSize: 100, result: {} });
      store.saveBundleAnalysis({ filePath: 'b.js', totalSize: 200, result: {} });

      const list = store.listBundleAnalyses();
      expect(list).toHaveLength(2);
    });

    it('should filter bundle analyses by filePath', () => {
      store.saveBundleAnalysis({ filePath: 'a.js', totalSize: 100, result: {} });
      store.saveBundleAnalysis({ filePath: 'b.js', totalSize: 200, result: {} });
      store.saveBundleAnalysis({ filePath: 'a.js', totalSize: 150, result: {} });

      const filtered = store.listBundleAnalyses('a.js');
      expect(filtered).toHaveLength(2);
      filtered.forEach((r) => expect(r.filePath).toBe('a.js'));
    });
  });

  // -- Bottleneck Reports ----------------------------------------------------

  describe('saveBottleneck', () => {
    it('should save and return a bottleneck report', () => {
      const record = store.saveBottleneck({
        target: 'api/users',
        bottlenecks: [{ type: 'n+1', severity: 'high' }],
      });

      expect(record.id).toBe(1);
      expect(record.target).toBe('api/users');
      expect(record.createdAt).toBeDefined();
    });

    it('should serialize and deserialize the bottlenecks JSON array', () => {
      const bottlenecks = [
        { type: 'n+1', severity: 'high' },
        { type: 'slow-query', severity: 'medium' },
      ];
      const record = store.saveBottleneck({ target: 'api/orders', bottlenecks });

      expect(record.bottlenecks).toEqual(bottlenecks);
      expect(Array.isArray(record.bottlenecks)).toBe(true);
      expect(record.bottlenecks).toHaveLength(2);
    });
  });

  // -- Benchmark Results -----------------------------------------------------

  describe('saveBenchmark', () => {
    it('should save and return a benchmark result', () => {
      const record = store.saveBenchmark({
        name: 'render-list',
        results: { avgMs: 12.5, p99Ms: 45.0 },
      });

      expect(record.id).toBe(1);
      expect(record.name).toBe('render-list');
      expect(record.createdAt).toBeDefined();
    });

    it('should serialize and deserialize the results JSON field', () => {
      const results = { iterations: 1000, avgMs: 5.2, samples: [4.8, 5.1, 5.7] };
      const record = store.saveBenchmark({ name: 'sort-algo', results });

      expect(record.results).toEqual(results);
    });
  });

  describe('listBenchmarks', () => {
    it('should return an empty array when no benchmarks exist', () => {
      expect(store.listBenchmarks()).toEqual([]);
    });

    it('should list all benchmarks', () => {
      store.saveBenchmark({ name: 'bench-a', results: {} });
      store.saveBenchmark({ name: 'bench-b', results: {} });

      expect(store.listBenchmarks()).toHaveLength(2);
    });

    it('should filter benchmarks by name', () => {
      store.saveBenchmark({ name: 'bench-a', results: { run: 1 } });
      store.saveBenchmark({ name: 'bench-b', results: { run: 2 } });
      store.saveBenchmark({ name: 'bench-a', results: { run: 3 } });

      const filtered = store.listBenchmarks('bench-a');
      expect(filtered).toHaveLength(2);
      filtered.forEach((r) => expect(r.name).toBe('bench-a'));
    });
  });
});
