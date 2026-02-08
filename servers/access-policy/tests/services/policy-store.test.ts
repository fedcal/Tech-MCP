import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyStore } from '../../src/services/policy-store.js';

describe('PolicyStore', () => {
  let store: PolicyStore;

  beforeEach(() => {
    store = new PolicyStore({ inMemory: true });
  });

  // ── createPolicy & retrieve ─────────────────────────────────────────────

  describe('createPolicy and retrieve', () => {
    it('should create a policy and retrieve it by id', () => {
      const policy = store.createPolicy({
        name: 'allow-devs-scrum',
        effect: 'allow',
        rules: [{ server: 'scrum-board', roles: ['developer'] }],
      });

      expect(policy.id).toBeDefined();
      expect(policy.name).toBe('allow-devs-scrum');
      expect(policy.effect).toBe('allow');
      expect(policy.rules).toEqual([{ server: 'scrum-board', roles: ['developer'] }]);
      expect(policy.createdAt).toBeDefined();

      const retrieved = store.getPolicy(policy.id);
      expect(retrieved).toEqual(policy);
    });

    it('should retrieve a policy by name', () => {
      store.createPolicy({
        name: 'deny-interns',
        effect: 'deny',
        rules: [{ server: '*', roles: ['intern'] }],
      });

      const found = store.getPolicyByName('deny-interns');
      expect(found).toBeDefined();
      expect(found!.name).toBe('deny-interns');
    });

    it('should return undefined for non-existent policy', () => {
      expect(store.getPolicy(999)).toBeUndefined();
      expect(store.getPolicyByName('no-such-policy')).toBeUndefined();
    });
  });

  // ── listPolicies ────────────────────────────────────────────────────────

  describe('listPolicies', () => {
    it('should list all policies', () => {
      store.createPolicy({ name: 'p1', effect: 'allow', rules: [{ server: 'a', roles: ['r1'] }] });
      store.createPolicy({ name: 'p2', effect: 'deny', rules: [{ server: 'b', roles: ['r2'] }] });

      const policies = store.listPolicies();
      expect(policies).toHaveLength(2);
    });
  });

  // ── deletePolicy ────────────────────────────────────────────────────────

  describe('deletePolicy', () => {
    it('should delete an existing policy', () => {
      const policy = store.createPolicy({ name: 'temp', effect: 'allow', rules: [] });
      expect(store.deletePolicy(policy.id)).toBe(true);
      expect(store.getPolicy(policy.id)).toBeUndefined();
    });

    it('should return false for non-existent policy', () => {
      expect(store.deletePolicy(999)).toBe(false);
    });
  });

  // ── createRole & assign to user ─────────────────────────────────────────

  describe('createRole and assign to user', () => {
    it('should create a role and assign it to a user', () => {
      const role = store.createRole('developer', 'Software developer');
      expect(role.id).toBeDefined();
      expect(role.name).toBe('developer');
      expect(role.description).toBe('Software developer');

      store.assignRole('alice', role.id);

      const roles = store.getUserRoles('alice');
      expect(roles).toHaveLength(1);
      expect(roles[0].name).toBe('developer');
    });

    it('should not duplicate role assignments', () => {
      const role = store.createRole('admin');
      store.assignRole('bob', role.id);
      store.assignRole('bob', role.id); // duplicate

      const roles = store.getUserRoles('bob');
      expect(roles).toHaveLength(1);
    });
  });

  // ── getUserRoles ────────────────────────────────────────────────────────

  describe('getUserRoles', () => {
    it('should return all roles for a user', () => {
      const devRole = store.createRole('developer');
      const adminRole = store.createRole('admin');
      store.assignRole('charlie', devRole.id);
      store.assignRole('charlie', adminRole.id);

      const roles = store.getUserRoles('charlie');
      expect(roles).toHaveLength(2);
      const names = roles.map((r) => r.name).sort();
      expect(names).toEqual(['admin', 'developer']);
    });

    it('should return empty array for user with no roles', () => {
      expect(store.getUserRoles('nobody')).toEqual([]);
    });
  });

  // ── removeRole ──────────────────────────────────────────────────────────

  describe('removeRole', () => {
    it('should remove a role assignment from a user', () => {
      const role = store.createRole('tester');
      store.assignRole('dave', role.id);
      expect(store.getUserRoles('dave')).toHaveLength(1);

      store.removeRole('dave', role.id);
      expect(store.getUserRoles('dave')).toHaveLength(0);
    });
  });

  // ── checkAccess: allow ──────────────────────────────────────────────────

  describe('checkAccess with allow policy', () => {
    it('should allow access when policy matches', () => {
      const role = store.createRole('developer');
      store.assignRole('alice', role.id);
      store.createPolicy({
        name: 'allow-devs',
        effect: 'allow',
        rules: [{ server: 'scrum-board', roles: ['developer'] }],
      });

      const result = store.checkAccess('alice', 'scrum-board');
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('allow-devs');
    });

    it('should allow access with tool-specific rule', () => {
      const role = store.createRole('reviewer');
      store.assignRole('bob', role.id);
      store.createPolicy({
        name: 'allow-review-tool',
        effect: 'allow',
        rules: [{ server: 'code-review', tool: 'analyze-diff', roles: ['reviewer'] }],
      });

      const result = store.checkAccess('bob', 'code-review', 'analyze-diff');
      expect(result.allowed).toBe(true);
    });
  });

  // ── checkAccess: deny precedence ────────────────────────────────────────

  describe('checkAccess with deny policy (deny precedence)', () => {
    it('should deny when both allow and deny policies match (deny takes precedence)', () => {
      const role = store.createRole('developer');
      store.assignRole('eve', role.id);

      store.createPolicy({
        name: 'allow-all',
        effect: 'allow',
        rules: [{ server: '*', roles: ['developer'] }],
      });
      store.createPolicy({
        name: 'deny-prod',
        effect: 'deny',
        rules: [{ server: 'production-deploy', roles: ['developer'] }],
      });

      const result = store.checkAccess('eve', 'production-deploy');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('deny-prod');
    });
  });

  // ── checkAccess: default deny ───────────────────────────────────────────

  describe('checkAccess with no matching policy (default deny)', () => {
    it('should deny access when no policies match', () => {
      const role = store.createRole('guest');
      store.assignRole('frank', role.id);

      const result = store.checkAccess('frank', 'scrum-board');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('default deny');
    });

    it('should deny access when user has no roles', () => {
      store.createPolicy({
        name: 'allow-admins',
        effect: 'allow',
        rules: [{ server: 'scrum-board', roles: ['admin'] }],
      });

      const result = store.checkAccess('nobody', 'scrum-board');
      expect(result.allowed).toBe(false);
    });
  });

  // ── logAccess & getAuditLog ─────────────────────────────────────────────

  describe('logAccess and getAuditLog', () => {
    it('should log an access check and retrieve it', () => {
      const entry = store.logAccess('alice', 'scrum-board', 'create-sprint', 'allowed', 'Policy match');
      expect(entry.id).toBeDefined();
      expect(entry.userId).toBe('alice');
      expect(entry.server).toBe('scrum-board');
      expect(entry.tool).toBe('create-sprint');
      expect(entry.result).toBe('allowed');
      expect(entry.reason).toBe('Policy match');
      expect(entry.timestamp).toBeDefined();

      const log = store.getAuditLog();
      expect(log).toHaveLength(1);
      expect(log[0]).toEqual(entry);
    });

    it('should filter audit log by userId', () => {
      store.logAccess('alice', 'server-a', 'tool-1', 'allowed', 'ok');
      store.logAccess('bob', 'server-b', 'tool-2', 'denied', 'no match');
      store.logAccess('alice', 'server-c', 'tool-3', 'allowed', 'ok');

      const aliceLog = store.getAuditLog({ userId: 'alice' });
      expect(aliceLog).toHaveLength(2);
      expect(aliceLog.every((e) => e.userId === 'alice')).toBe(true);
    });

    it('should filter audit log by server', () => {
      store.logAccess('alice', 'server-a', 'tool-1', 'allowed', 'ok');
      store.logAccess('alice', 'server-b', 'tool-2', 'denied', 'no');

      const log = store.getAuditLog({ server: 'server-a' });
      expect(log).toHaveLength(1);
      expect(log[0].server).toBe('server-a');
    });

    it('should respect limit filter', () => {
      store.logAccess('alice', 'a', 't', 'allowed', 'ok');
      store.logAccess('alice', 'b', 't', 'allowed', 'ok');
      store.logAccess('alice', 'c', 't', 'allowed', 'ok');

      const log = store.getAuditLog({ limit: 2 });
      expect(log).toHaveLength(2);
    });
  });

  // ── listRoles ───────────────────────────────────────────────────────────

  describe('listRoles', () => {
    it('should list all roles', () => {
      store.createRole('admin');
      store.createRole('developer');
      store.createRole('viewer');

      const roles = store.listRoles();
      expect(roles).toHaveLength(3);
    });
  });
});
