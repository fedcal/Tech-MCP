/**
 * Cross-server collaboration handlers for Incident Manager.
 */

import type { EventBus } from '@mcp-suite/core';
import type { IncidentStore } from './services/incident-store.js';

export function setupCollaborationHandlers(eventBus: EventBus, _store: IncidentStore): void {
  eventBus.subscribe('perf:bottleneck-found', (payload) => {
    // Future: auto-add timeline entry when a performance bottleneck is detected
    void payload;
  });

  eventBus.subscribe('cicd:build-failed', (payload) => {
    // Future: auto-add timeline entry when a CI/CD build fails
    void payload;
  });
}
