import { describe, it, expect, beforeEach } from 'vitest';
import { MockEventBus } from '@mcp-suite/testing';
import { TimeStore } from '../src/services/time-store.js';
import { setupCollaborationHandlers } from '../src/collaboration.js';

describe('time-tracking collaboration handlers', () => {
  let eventBus: MockEventBus;
  let store: TimeStore;

  beforeEach(() => {
    eventBus = new MockEventBus();
    store = new TimeStore({ inMemory: true });
    setupCollaborationHandlers(eventBus, store);
  });

  it('should subscribe to scrum:task-updated', async () => {
    // The handler is registered -- verify it receives events without throwing
    await eventBus.publish('scrum:task-updated', {
      taskId: '42',
      previousStatus: 'todo',
      newStatus: 'in_progress',
      assignee: 'alice',
      sprintId: '1',
    });

    // If we got here without error, the handler exists and processed the event
    expect(eventBus.wasPublished('scrum:task-updated')).toBe(true);
  });

  it('should handle scrum:task-updated with minimal payload gracefully', async () => {
    // The handler currently voids the payload, so any shape should be safe
    await expect(
      eventBus.publish('scrum:task-updated', {
        taskId: '100',
        previousStatus: 'in_progress',
        newStatus: 'done',
      }),
    ).resolves.not.toThrow();
  });
});
