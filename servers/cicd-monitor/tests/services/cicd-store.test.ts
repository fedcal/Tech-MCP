import { describe, it, expect, beforeEach } from 'vitest';
import { CicdStore } from '../../src/services/cicd-store.js';

describe('CicdStore', () => {
  let store: CicdStore;

  beforeEach(() => {
    store = new CicdStore({ inMemory: true });
  });

  // ---------- Pipeline Runs ----------

  describe('savePipelineRun', () => {
    it('should save a pipeline run and return it with an id', () => {
      const run = store.savePipelineRun({
        runId: 'run-123',
        repo: 'org/repo',
        branch: 'main',
        status: 'completed',
        conclusion: 'success',
        workflow: 'ci.yml',
      });

      expect(run.id).toBe(1);
      expect(run.runId).toBe('run-123');
      expect(run.repo).toBe('org/repo');
      expect(run.branch).toBe('main');
      expect(run.status).toBe('completed');
      expect(run.conclusion).toBe('success');
      expect(run.workflow).toBe('ci.yml');
      expect(run.createdAt).toBeDefined();
    });

    it('should allow optional fields to be null', () => {
      const run = store.savePipelineRun({
        runId: 'run-456',
        status: 'queued',
      });

      expect(run.repo).toBeNull();
      expect(run.branch).toBeNull();
      expect(run.conclusion).toBeNull();
      expect(run.workflow).toBeNull();
    });
  });

  describe('getPipelineRun', () => {
    it('should retrieve a pipeline run by id', () => {
      const saved = store.savePipelineRun({
        runId: 'run-789',
        status: 'in_progress',
      });

      const found = store.getPipelineRun(saved.id);
      expect(found).toBeDefined();
      expect(found!.runId).toBe('run-789');
    });

    it('should return undefined for non-existent id', () => {
      const result = store.getPipelineRun(999);
      expect(result).toBeUndefined();
    });
  });

  describe('listPipelineRuns', () => {
    it('should return an empty array when no runs exist', () => {
      expect(store.listPipelineRuns()).toEqual([]);
    });

    it('should filter by repo when provided', () => {
      store.savePipelineRun({ runId: 'r1', repo: 'org/a', status: 'done' });
      store.savePipelineRun({ runId: 'r2', repo: 'org/b', status: 'done' });
      store.savePipelineRun({ runId: 'r3', repo: 'org/a', status: 'done' });

      const filtered = store.listPipelineRuns('org/a');
      expect(filtered).toHaveLength(2);
      expect(filtered.every((r) => r.repo === 'org/a')).toBe(true);
    });

    it('should respect the limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        store.savePipelineRun({ runId: `r-${i}`, status: 'done' });
      }

      const limited = store.listPipelineRuns(undefined, 3);
      expect(limited).toHaveLength(3);
    });
  });

  // ---------- Flaky Tests ----------

  describe('saveFlakyTest', () => {
    it('should save a flaky test record and return it', () => {
      const ft = store.saveFlakyTest({
        repo: 'org/repo',
        workflow: 'test.yml',
        job: 'unit-tests',
        step: 'Run tests',
        flakinessRate: 0.15,
        passCount: 85,
        failCount: 15,
      });

      expect(ft.id).toBe(1);
      expect(ft.workflow).toBe('test.yml');
      expect(ft.flakinessRate).toBe(0.15);
      expect(ft.passCount).toBe(85);
      expect(ft.failCount).toBe(15);
      expect(ft.detectedAt).toBeDefined();
    });

    it('should allow repo to be omitted (null)', () => {
      const ft = store.saveFlakyTest({
        workflow: 'ci.yml',
        job: 'build',
        step: 'compile',
        flakinessRate: 0.05,
        passCount: 95,
        failCount: 5,
      });

      expect(ft.repo).toBeNull();
    });
  });

  describe('getFlakyTest', () => {
    it('should return undefined for non-existent id', () => {
      expect(store.getFlakyTest(999)).toBeUndefined();
    });
  });

  describe('listFlakyTests', () => {
    it('should return an empty array when no flaky tests exist', () => {
      expect(store.listFlakyTests()).toEqual([]);
    });

    it('should filter by repo when provided', () => {
      store.saveFlakyTest({
        repo: 'org/a',
        workflow: 'ci.yml',
        job: 'j1',
        step: 's1',
        flakinessRate: 0.1,
        passCount: 90,
        failCount: 10,
      });
      store.saveFlakyTest({
        repo: 'org/b',
        workflow: 'ci.yml',
        job: 'j2',
        step: 's2',
        flakinessRate: 0.2,
        passCount: 80,
        failCount: 20,
      });

      const filtered = store.listFlakyTests('org/a');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].repo).toBe('org/a');
    });
  });
});
