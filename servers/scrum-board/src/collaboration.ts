/**
 * Cross-server collaboration handlers for Scrum Board.
 * Subscribes to events from other servers and reacts accordingly.
 */

import type { EventBus } from '@mcp-suite/core';
import type { ScrumStore } from './services/scrum-store.js';

export function setupCollaborationHandlers(eventBus: EventBus, _store: ScrumStore): void {
  // When a retrospective action item is created, log it for awareness
  eventBus.subscribe('retro:action-item-created', (payload) => {
    // Future: auto-create a task from the action item
    void payload;
  });
}
