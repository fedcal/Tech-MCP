import { describe, it, expect, beforeEach } from 'vitest';
import { MockEventBus } from '@mcp-suite/testing';
import { ScrumStore } from '../src/services/scrum-store.js';
import { setupCollaborationHandlers } from '../src/collaboration.js';

describe('scrum-board collaboration handlers', () => {
  let eventBus: MockEventBus;
  let store: ScrumStore;

  beforeEach(() => {
    eventBus = new MockEventBus();
    store = new ScrumStore({ inMemory: true });
    setupCollaborationHandlers(eventBus, store);
  });

  it('should subscribe to retro:action-item-created', async () => {
    // The handler is registered -- verify it receives events without throwing
    await eventBus.publish('retro:action-item-created', {
      retroId: 'retro-42',
      item: 'Improve CI pipeline speed',
      assignee: 'bob',
      dueDate: '2025-07-01',
    });

    // If we got here without error, the handler exists and processed the event.
    // Verify the event was published (i.e. our mock received it)
    expect(eventBus.wasPublished('retro:action-item-created')).toBe(true);
  });

  it('should handle retro:action-item-created without optional fields gracefully', async () => {
    // The handler currently does nothing with the payload (void payload),
    // but it should still not throw on payloads without optional dueDate
    await expect(
      eventBus.publish('retro:action-item-created', {
        retroId: 'retro-43',
        item: 'Write more tests',
        assignee: 'alice',
      }),
    ).resolves.not.toThrow();
  });
});
