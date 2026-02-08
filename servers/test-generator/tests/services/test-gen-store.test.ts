import { describe, it, expect, beforeEach } from 'vitest';
import { TestGenStore } from '../../src/services/test-gen-store.js';

describe('TestGenStore', () => {
  let store: TestGenStore;

  beforeEach(() => {
    store = new TestGenStore({ inMemory: true });
  });

  // ---------- Generated Tests ----------

  describe('saveGeneratedTest', () => {
    it('should save a generated test and return it with an id', () => {
      const test = store.saveGeneratedTest({
        sourceFilePath: '/src/utils/math.ts',
        framework: 'vitest',
        testCount: 5,
        generatedCode: 'describe("math", () => { it("adds", () => {}) });',
      });

      expect(test.id).toBe(1);
      expect(test.sourceFilePath).toBe('/src/utils/math.ts');
      expect(test.framework).toBe('vitest');
      expect(test.testCount).toBe(5);
      expect(test.generatedCode).toContain('describe');
      expect(test.createdAt).toBeDefined();
    });

    it('should auto-increment ids', () => {
      const t1 = store.saveGeneratedTest({
        sourceFilePath: '/a.ts',
        framework: 'vitest',
        testCount: 1,
        generatedCode: 'code1',
      });
      const t2 = store.saveGeneratedTest({
        sourceFilePath: '/b.ts',
        framework: 'jest',
        testCount: 2,
        generatedCode: 'code2',
      });

      expect(t2.id).toBe(t1.id + 1);
    });
  });

  describe('listGeneratedTests', () => {
    it('should return an empty array when no tests exist', () => {
      expect(store.listGeneratedTests()).toEqual([]);
    });

    it('should filter by sourceFilePath when provided', () => {
      store.saveGeneratedTest({
        sourceFilePath: '/src/a.ts',
        framework: 'vitest',
        testCount: 3,
        generatedCode: 'code-a',
      });
      store.saveGeneratedTest({
        sourceFilePath: '/src/b.ts',
        framework: 'vitest',
        testCount: 2,
        generatedCode: 'code-b',
      });
      store.saveGeneratedTest({
        sourceFilePath: '/src/a.ts',
        framework: 'jest',
        testCount: 4,
        generatedCode: 'code-a-jest',
      });

      const filtered = store.listGeneratedTests('/src/a.ts');
      expect(filtered).toHaveLength(2);
      expect(filtered.every((t) => t.sourceFilePath === '/src/a.ts')).toBe(true);
    });

    it('should return all tests when no filter is given', () => {
      store.saveGeneratedTest({
        sourceFilePath: '/x.ts',
        framework: 'vitest',
        testCount: 1,
        generatedCode: 'c1',
      });
      store.saveGeneratedTest({
        sourceFilePath: '/y.ts',
        framework: 'jest',
        testCount: 1,
        generatedCode: 'c2',
      });

      expect(store.listGeneratedTests()).toHaveLength(2);
    });
  });

  // ---------- Coverage Reports ----------

  describe('saveCoverage', () => {
    it('should save a coverage report and return it with an id', () => {
      const report = store.saveCoverage({
        filePath: '/src/utils/math.ts',
        coverage: 85.5,
        uncoveredLines: [12, 15, 28, 33],
      });

      expect(report.id).toBe(1);
      expect(report.filePath).toBe('/src/utils/math.ts');
      expect(report.coverage).toBe(85.5);
      expect(report.uncoveredLines).toEqual([12, 15, 28, 33]);
      expect(report.createdAt).toBeDefined();
    });

    it('should handle empty uncoveredLines array', () => {
      const report = store.saveCoverage({
        filePath: '/src/simple.ts',
        coverage: 100,
        uncoveredLines: [],
      });

      expect(report.uncoveredLines).toEqual([]);
      expect(report.coverage).toBe(100);
    });
  });

  describe('listCoverageReports', () => {
    it('should return an empty array when no reports exist', () => {
      expect(store.listCoverageReports()).toEqual([]);
    });

    it('should return all coverage reports', () => {
      store.saveCoverage({
        filePath: '/a.ts',
        coverage: 90,
        uncoveredLines: [10],
      });
      store.saveCoverage({
        filePath: '/b.ts',
        coverage: 75,
        uncoveredLines: [5, 10, 15],
      });

      const reports = store.listCoverageReports();
      expect(reports).toHaveLength(2);
    });
  });

  // ---------- JSON serialization ----------

  describe('JSON serialization', () => {
    it('should serialize and deserialize uncoveredLines as number array', () => {
      const lines = [1, 5, 10, 42, 100, 255];
      const report = store.saveCoverage({
        filePath: '/test.ts',
        coverage: 70,
        uncoveredLines: lines,
      });

      expect(report.uncoveredLines).toEqual(lines);
      expect(Array.isArray(report.uncoveredLines)).toBe(true);
      expect(report.uncoveredLines.every((n) => typeof n === 'number')).toBe(true);
    });

    it('should preserve generatedCode string exactly', () => {
      const code = `import { describe, it, expect } from 'vitest';\n\ndescribe('MyModule', () => {\n  it('works', () => {\n    expect(true).toBe(true);\n  });\n});`;
      const test = store.saveGeneratedTest({
        sourceFilePath: '/module.ts',
        framework: 'vitest',
        testCount: 1,
        generatedCode: code,
      });

      expect(test.generatedCode).toBe(code);
    });
  });
});
