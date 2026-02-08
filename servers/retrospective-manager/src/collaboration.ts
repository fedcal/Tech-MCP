/**
 * Cross-server collaboration handlers for retrospective-manager.
 * Subscribes to events from other servers to enable automatic workflows.
 */

import type { EventBus } from '@mcp-suite/core';
import type { RetroStore } from './services/retro-store.js';

export function setupCollaborationHandlers(eventBus: EventBus, store: RetroStore): void {
  eventBus.subscribe('scrum:sprint-completed', (payload) => {
    // Future: auto-create a pending retro for the completed sprint
    void payload;
  });

  eventBus.subscribe('cicd:build-failed', (payload) => {
    // Future: auto-add build failure as a discussion item
    void payload;
  });

  // When a time anomaly is detected, suggest it as a retro item
  eventBus.subscribe('time:anomaly-detected', (payload) => {
    const data = payload as { userId?: string; anomalyType?: string; details?: string };
    if (data.details) {
      store.addEventSuggestion(
        'time:anomaly-detected',
        `Time anomaly: ${data.details}`,
        data as Record<string, unknown>,
      );
    }
  });

  // When a quality gate fails, suggest it as a retro item
  eventBus.subscribe('quality:gate-failed', (payload) => {
    const data = payload as { gateName?: string; failures?: string[] };
    if (data.gateName) {
      store.addEventSuggestion(
        'quality:gate-failed',
        `Quality gate failed: ${data.gateName} - ${(data.failures || []).join(', ')}`,
        data as Record<string, unknown>,
      );
    }
  });

  // When an incident is resolved, suggest it as a retro item
  eventBus.subscribe('incident:resolved', (payload) => {
    const data = payload as { title?: string; resolution?: string; durationMinutes?: number };
    if (data.title) {
      store.addEventSuggestion(
        'incident:resolved',
        `Incident resolved: ${data.title} (${data.durationMinutes ?? '?'} min)`,
        data as Record<string, unknown>,
      );
    }
  });
}
