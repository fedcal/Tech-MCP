/**
 * Cross-server collaboration handlers for Decision Log.
 */

import type { EventBus } from '@mcp-suite/core';
import type { DecisionStore } from './services/decision-store.js';

export function setupCollaborationHandlers(eventBus: EventBus, _store: DecisionStore): void {
  eventBus.subscribe('code:review-completed', (payload) => {
    // Future: auto-link decisions related to reviewed files
    void payload;
  });
}
