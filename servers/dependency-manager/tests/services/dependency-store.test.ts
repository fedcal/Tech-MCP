import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyStore } from '../../src/services/dependency-store.js';

describe('DependencyStore', () => {
  let store: DependencyStore;

  beforeEach(() => {
    store = new DependencyStore({ inMemory: true });
  });

  // ---------- Vulnerability Scans ----------

  describe('saveScan', () => {
    it('should save a vulnerability scan and return it with an id', () => {
      const scan = store.saveScan({
        projectPath: '/app',
        vulnerabilityCount: 5,
        criticalCount: 1,
        highCount: 2,
        results: JSON.stringify([{ name: 'CVE-2024-001', severity: 'critical' }]),
      });

      expect(scan.id).toBe(1);
      expect(scan.projectPath).toBe('/app');
      expect(scan.vulnerabilityCount).toBe(5);
      expect(scan.criticalCount).toBe(1);
      expect(scan.highCount).toBe(2);
      expect(scan.scannedAt).toBeDefined();
    });

    it('should auto-increment ids across multiple saves', () => {
      const s1 = store.saveScan({
        projectPath: '/a',
        vulnerabilityCount: 0,
        criticalCount: 0,
        highCount: 0,
        results: '[]',
      });
      const s2 = store.saveScan({
        projectPath: '/b',
        vulnerabilityCount: 1,
        criticalCount: 0,
        highCount: 1,
        results: '[]',
      });

      expect(s2.id).toBe(s1.id + 1);
    });
  });

  describe('getLatestScan', () => {
    it('should return a scan for a given project path', () => {
      const s1 = store.saveScan({
        projectPath: '/app',
        vulnerabilityCount: 3,
        criticalCount: 0,
        highCount: 1,
        results: '[]',
      });
      store.saveScan({
        projectPath: '/other',
        vulnerabilityCount: 99,
        criticalCount: 0,
        highCount: 0,
        results: '[]',
      });

      const latest = store.getLatestScan('/app');
      expect(latest).toBeDefined();
      expect(latest!.id).toBe(s1.id);
      expect(latest!.projectPath).toBe('/app');
      expect(latest!.vulnerabilityCount).toBe(3);
    });

    it('should return undefined when no scan exists for path', () => {
      const result = store.getLatestScan('/nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('listScans', () => {
    it('should return an empty array when no scans exist', () => {
      expect(store.listScans()).toEqual([]);
    });

    it('should respect the limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        store.saveScan({
          projectPath: `/project-${i}`,
          vulnerabilityCount: i,
          criticalCount: 0,
          highCount: 0,
          results: '[]',
        });
      }

      const limited = store.listScans(3);
      expect(limited).toHaveLength(3);
    });
  });

  // ---------- License Audits ----------

  describe('saveLicenseAudit', () => {
    it('should save and return a license audit', () => {
      const audit = store.saveLicenseAudit({
        projectPath: '/app',
        packageCount: 42,
        results: JSON.stringify([{ pkg: 'lodash', license: 'MIT' }]),
      });

      expect(audit.id).toBe(1);
      expect(audit.projectPath).toBe('/app');
      expect(audit.packageCount).toBe(42);
      expect(audit.auditedAt).toBeDefined();
    });
  });

  describe('listAudits', () => {
    it('should return an empty array when no audits exist', () => {
      expect(store.listAudits()).toEqual([]);
    });

    it('should respect the limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        store.saveLicenseAudit({
          projectPath: `/project-${i}`,
          packageCount: i * 10,
          results: '[]',
        });
      }

      const limited = store.listAudits(2);
      expect(limited).toHaveLength(2);
    });
  });

  // ---------- JSON serialization ----------

  describe('JSON serialization', () => {
    it('should preserve JSON results string in vulnerability scans', () => {
      const payload = JSON.stringify([
        { name: 'CVE-2024-001', severity: 'critical' },
        { name: 'CVE-2024-002', severity: 'high' },
      ]);
      const scan = store.saveScan({
        projectPath: '/app',
        vulnerabilityCount: 2,
        criticalCount: 1,
        highCount: 1,
        results: payload,
      });

      expect(scan.results).toBe(payload);
      expect(JSON.parse(scan.results)).toHaveLength(2);
    });

    it('should preserve JSON results string in license audits', () => {
      const payload = JSON.stringify([{ pkg: 'express', license: 'MIT' }]);
      const audit = store.saveLicenseAudit({
        projectPath: '/app',
        packageCount: 1,
        results: payload,
      });

      expect(audit.results).toBe(payload);
      expect(JSON.parse(audit.results)).toHaveLength(1);
    });
  });
});
