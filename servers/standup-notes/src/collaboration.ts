/**
 * Cross-server collaboration handlers for standup-notes.
 * Subscribes to events from other servers to enable automatic workflows.
 */

import type { EventBus } from '@mcp-suite/core';
import type { StandupStore } from './services/standup-store.js';

export function setupCollaborationHandlers(eventBus: EventBus, _store: StandupStore): void {
  eventBus.subscribe('scrum:task-updated', (payload) => {
    // Future: auto-populate "today's progress" context for next standup
    void payload;
  });

  eventBus.subscribe('cicd:build-failed', (payload) => {
    // Future: auto-add as a potential blocker in next standup
    void payload;
  });
}
