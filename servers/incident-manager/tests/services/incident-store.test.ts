import { describe, it, expect } from 'vitest';
import { IncidentStore } from '../../src/services/incident-store.js';

describe('IncidentStore', () => {
  function createStore() {
    return new IncidentStore({ inMemory: true });
  }

  it('should open an incident and retrieve it', () => {
    const store = createStore();
    const incident = store.openIncident({
      title: 'Database outage',
      severity: 'critical',
      description: 'Primary database cluster is unreachable',
      affectedSystems: ['api-gateway', 'user-service'],
    });

    expect(incident.id).toBeDefined();
    expect(incident.title).toBe('Database outage');
    expect(incident.severity).toBe('critical');
    expect(incident.status).toBe('open');
    expect(incident.affectedSystems).toEqual(['api-gateway', 'user-service']);
    expect(incident.resolution).toBeNull();
    expect(incident.rootCause).toBeNull();
    expect(incident.resolvedAt).toBeNull();

    const retrieved = store.getIncident(incident.id);
    expect(retrieved).toEqual(incident);
  });

  it('should update incident status', () => {
    const store = createStore();
    const incident = store.openIncident({
      title: 'Slow responses',
      severity: 'medium',
      description: 'API response times are elevated',
    });

    const updated = store.updateIncident(incident.id, { status: 'investigating' });
    expect(updated?.status).toBe('investigating');
  });

  it('should add a note via updateIncident and create timeline entry', () => {
    const store = createStore();
    const incident = store.openIncident({
      title: 'Service down',
      severity: 'high',
      description: 'Payment service is down',
    });

    store.updateIncident(incident.id, { note: 'Investigating the root cause' });

    const timeline = store.getTimeline(incident.id);
    // Should have the initial "Incident opened" entry plus the note
    expect(timeline.length).toBeGreaterThanOrEqual(2);
    expect(timeline.some((e) => e.description === 'Investigating the root cause')).toBe(true);
  });

  it('should add a timeline entry', () => {
    const store = createStore();
    const incident = store.openIncident({
      title: 'Network issue',
      severity: 'high',
      description: 'Network connectivity issues in us-east-1',
    });

    const entry = store.addTimelineEntry(incident.id, 'Identified faulty switch', 'network-team');

    expect(entry.id).toBeDefined();
    expect(entry.incidentId).toBe(incident.id);
    expect(entry.description).toBe('Identified faulty switch');
    expect(entry.source).toBe('network-team');
    expect(entry.timestamp).toBeDefined();
  });

  it('should resolve an incident with duration calculation', () => {
    const store = createStore();
    const incident = store.openIncident({
      title: 'Memory leak',
      severity: 'high',
      description: 'Memory leak in worker process',
    });

    const resolved = store.resolveIncident(incident.id, 'Restarted workers and deployed fix', 'Memory leak in image processing module');
    expect(resolved?.status).toBe('resolved');
    expect(resolved?.resolution).toBe('Restarted workers and deployed fix');
    expect(resolved?.rootCause).toBe('Memory leak in image processing module');
    expect(resolved?.resolvedAt).toBeDefined();

    const postmortem = store.generatePostmortemData(incident.id);
    expect(postmortem).toBeDefined();
    expect(postmortem!.incident.status).toBe('resolved');
    expect(postmortem!.timeline.length).toBeGreaterThan(0);
    expect(typeof postmortem!.durationMinutes).toBe('number');
  });

  it('should list incidents with filters', () => {
    const store = createStore();
    store.openIncident({ title: 'Inc-1', severity: 'critical', description: 'd' });
    store.openIncident({ title: 'Inc-2', severity: 'low', description: 'd' });
    store.openIncident({ title: 'Inc-3', severity: 'critical', description: 'd' });

    const all = store.listIncidents();
    expect(all).toHaveLength(3);

    const critical = store.listIncidents({ severity: 'critical' });
    expect(critical).toHaveLength(2);

    const limited = store.listIncidents({ limit: 1 });
    expect(limited).toHaveLength(1);

    // Resolve one and filter by status
    store.resolveIncident(all[0].id, 'Fixed');
    const open = store.listIncidents({ status: 'open' });
    expect(open).toHaveLength(2);

    const resolved = store.listIncidents({ status: 'resolved' });
    expect(resolved).toHaveLength(1);
  });

  it('should generate postmortem data', () => {
    const store = createStore();
    const incident = store.openIncident({
      title: 'DNS failure',
      severity: 'critical',
      description: 'DNS resolution failing for internal services',
      affectedSystems: ['dns', 'service-mesh'],
    });

    store.addTimelineEntry(incident.id, 'DNS queries timing out', 'monitoring');
    store.addTimelineEntry(incident.id, 'Switched to backup DNS', 'ops-team');
    store.resolveIncident(incident.id, 'Switched to backup DNS provider', 'Primary DNS provider had an outage');

    const data = store.generatePostmortemData(incident.id);
    expect(data).toBeDefined();
    expect(data!.incident.title).toBe('DNS failure');
    expect(data!.incident.status).toBe('resolved');
    expect(data!.timeline.length).toBeGreaterThanOrEqual(4); // opened + 2 manual + resolved
    expect(typeof data!.durationMinutes).toBe('number');
  });

  it('should return undefined for non-existent incident', () => {
    const store = createStore();
    expect(store.getIncident(999)).toBeUndefined();
  });

  it('should return undefined when updating non-existent incident', () => {
    const store = createStore();
    expect(store.updateIncident(999, { status: 'investigating' })).toBeUndefined();
  });

  it('should return undefined when resolving non-existent incident', () => {
    const store = createStore();
    expect(store.resolveIncident(999, 'Fixed')).toBeUndefined();
  });

  it('should return undefined when generating postmortem for non-existent incident', () => {
    const store = createStore();
    expect(store.generatePostmortemData(999)).toBeUndefined();
  });
});
