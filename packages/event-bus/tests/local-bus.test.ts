import { describe, it, expect, vi } from 'vitest';
import { LocalEventBus } from '../src/local-bus.js';

describe('LocalEventBus', () => {
  it('should publish and subscribe to events', async () => {
    const bus = new LocalEventBus();
    const handler = vi.fn();
    bus.subscribe('scrum:sprint-started', handler);

    await bus.publish('scrum:sprint-started', {
      sprintId: '1', name: 'Sprint 1', startDate: '2026-01-01', endDate: '2026-01-14',
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({
      sprintId: '1', name: 'Sprint 1', startDate: '2026-01-01', endDate: '2026-01-14',
    });
  });

  it('should return unsubscribe function', async () => {
    const bus = new LocalEventBus();
    const handler = vi.fn();
    const unsub = bus.subscribe('scrum:task-updated', handler);
    unsub();

    await bus.publish('scrum:task-updated', {
      taskId: '1', previousStatus: 'todo', newStatus: 'in_progress',
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should support pattern subscriptions', async () => {
    const bus = new LocalEventBus();
    const handler = vi.fn();
    bus.subscribePattern('scrum:*', handler);

    await bus.publish('scrum:sprint-started', {
      sprintId: '1', name: 'Sprint 1', startDate: '2026-01-01', endDate: '2026-01-14',
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith('scrum:sprint-started', expect.any(Object));
  });

  it('should clear all subscriptions', async () => {
    const bus = new LocalEventBus();
    const handler = vi.fn();
    bus.subscribe('scrum:sprint-started', handler);
    bus.clear();

    await bus.publish('scrum:sprint-started', {
      sprintId: '1', name: 'Sprint 1', startDate: '2026-01-01', endDate: '2026-01-14',
    });

    expect(handler).not.toHaveBeenCalled();
  });
});
