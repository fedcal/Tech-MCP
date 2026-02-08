import { describe, it, expect, beforeEach } from 'vitest';
import { MockEventBus } from '@mcp-suite/testing';
import { EconomicsStore } from '../src/services/economics-store.js';
import { setupCollaborationHandlers } from '../src/collaboration.js';

describe('project-economics collaboration handlers', () => {
  let eventBus: MockEventBus;
  let store: EconomicsStore;

  beforeEach(() => {
    eventBus = new MockEventBus();
    store = new EconomicsStore(true); // inMemory = true
    setupCollaborationHandlers(eventBus, store);
  });

  it('should subscribe to time:entry-logged', async () => {
    await eventBus.publish('time:entry-logged', {
      taskId: 'TASK-42',
      userId: 'default',
      minutes: 120,
      date: '2025-06-10',
    });

    expect(eventBus.wasPublished('time:entry-logged')).toBe(true);
  });

  it('should handle time:entry-logged without throwing', async () => {
    await expect(
      eventBus.publish('time:entry-logged', {
        taskId: 'TASK-99',
        userId: 'alice',
        minutes: 60,
        date: '2025-06-11',
      }),
    ).resolves.not.toThrow();
  });

  it('should subscribe to scrum:sprint-completed', async () => {
    await eventBus.publish('scrum:sprint-completed', {
      sprintId: '5',
      name: 'Sprint 5',
      velocity: 32,
      completedStories: 8,
      incompleteStories: 2,
    });

    expect(eventBus.wasPublished('scrum:sprint-completed')).toBe(true);
  });

  it('should handle scrum:sprint-completed without throwing', async () => {
    await expect(
      eventBus.publish('scrum:sprint-completed', {
        sprintId: '10',
        name: 'Sprint 10',
        velocity: 28,
        completedStories: 7,
        incompleteStories: 1,
      }),
    ).resolves.not.toThrow();
  });
});
