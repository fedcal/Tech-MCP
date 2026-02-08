import { describe, it, expect, beforeEach } from 'vitest';
import { DockerStore } from '../../src/services/docker-store.js';

describe('DockerStore', () => {
  let store: DockerStore;

  beforeEach(() => {
    store = new DockerStore({ inMemory: true });
  });

  // ---------- Compose Analyses ----------

  describe('saveAnalysis', () => {
    it('should save an analysis and return it with an id', () => {
      const analysis = store.saveAnalysis({
        filePath: '/app/docker-compose.yml',
        serviceCount: 3,
        services: ['web', 'db', 'redis'],
      });

      expect(analysis.id).toBe(1);
      expect(analysis.filePath).toBe('/app/docker-compose.yml');
      expect(analysis.serviceCount).toBe(3);
      expect(analysis.services).toEqual(['web', 'db', 'redis']);
      expect(analysis.createdAt).toBeDefined();
    });

    it('should auto-increment ids', () => {
      const a1 = store.saveAnalysis({
        filePath: '/a/docker-compose.yml',
        serviceCount: 1,
        services: ['web'],
      });
      const a2 = store.saveAnalysis({
        filePath: '/b/docker-compose.yml',
        serviceCount: 2,
        services: ['web', 'db'],
      });

      expect(a2.id).toBe(a1.id + 1);
    });
  });

  describe('getAnalysis', () => {
    it('should retrieve an analysis by id', () => {
      const saved = store.saveAnalysis({
        filePath: '/app/docker-compose.yml',
        serviceCount: 2,
        services: ['api', 'postgres'],
      });

      const found = store.getAnalysis(saved.id);
      expect(found).toBeDefined();
      expect(found!.filePath).toBe('/app/docker-compose.yml');
      expect(found!.services).toEqual(['api', 'postgres']);
    });

    it('should return undefined for non-existent id', () => {
      expect(store.getAnalysis(999)).toBeUndefined();
    });
  });

  describe('listAnalyses', () => {
    it('should return an empty array when no analyses exist', () => {
      expect(store.listAnalyses()).toEqual([]);
    });

    it('should respect the limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        store.saveAnalysis({
          filePath: `/project-${i}/docker-compose.yml`,
          serviceCount: i + 1,
          services: [`svc-${i}`],
        });
      }

      const limited = store.listAnalyses(3);
      expect(limited).toHaveLength(3);
    });
  });

  // ---------- Generated Composes ----------

  describe('saveGenerated', () => {
    it('should save a generated compose and return it', () => {
      const gen = store.saveGenerated({
        name: 'MERN Stack',
        services: ['mongo', 'express', 'react', 'node'],
        output: 'version: "3"\nservices:\n  mongo:\n    image: mongo:7',
      });

      expect(gen.id).toBe(1);
      expect(gen.name).toBe('MERN Stack');
      expect(gen.services).toEqual(['mongo', 'express', 'react', 'node']);
      expect(gen.output).toContain('mongo');
      expect(gen.createdAt).toBeDefined();
    });
  });

  describe('getGenerated', () => {
    it('should retrieve a generated compose by id', () => {
      const saved = store.saveGenerated({
        name: 'Test Stack',
        services: ['web'],
        output: 'services:\n  web:\n    image: nginx',
      });

      const found = store.getGenerated(saved.id);
      expect(found).toBeDefined();
      expect(found!.name).toBe('Test Stack');
    });

    it('should return undefined for non-existent id', () => {
      expect(store.getGenerated(999)).toBeUndefined();
    });
  });

  describe('listGenerated', () => {
    it('should return an empty array when no generated composes exist', () => {
      expect(store.listGenerated()).toEqual([]);
    });

    it('should respect the limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        store.saveGenerated({
          name: `Stack ${i}`,
          services: [`svc-${i}`],
          output: `output-${i}`,
        });
      }

      const limited = store.listGenerated(2);
      expect(limited).toHaveLength(2);
    });
  });

  // ---------- JSON serialization ----------

  describe('JSON serialization', () => {
    it('should serialize and deserialize services as JSON string array in analyses', () => {
      const services = ['nginx', 'app', 'postgres', 'redis', 'worker'];
      const analysis = store.saveAnalysis({
        filePath: '/complex/docker-compose.yml',
        serviceCount: 5,
        services,
      });

      expect(analysis.services).toEqual(services);
      expect(Array.isArray(analysis.services)).toBe(true);
    });

    it('should serialize and deserialize services as JSON string array in generated composes', () => {
      const services = ['frontend', 'backend', 'database'];
      const gen = store.saveGenerated({
        name: 'Full Stack',
        services,
        output: 'yaml content',
      });

      expect(gen.services).toEqual(services);
      expect(Array.isArray(gen.services)).toBe(true);
    });

    it('should handle empty services array', () => {
      const analysis = store.saveAnalysis({
        filePath: '/empty/docker-compose.yml',
        serviceCount: 0,
        services: [],
      });

      expect(analysis.services).toEqual([]);
    });
  });
});
