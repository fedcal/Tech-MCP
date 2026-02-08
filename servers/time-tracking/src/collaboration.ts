/**
 * Cross-server collaboration handlers for Time Tracking.
 */

import type { EventBus } from '@mcp-suite/core';
import type { TimeStore } from './services/time-store.js';

export function setupCollaborationHandlers(eventBus: EventBus, _store: TimeStore): void {
  // When a scrum task moves to in_progress, log awareness for auto-timer potential
  eventBus.subscribe('scrum:task-updated', (payload) => {
    // Future: auto-start timer when task moves to in_progress
    // Future: auto-stop timer when task moves to done
    void payload;
  });
}
