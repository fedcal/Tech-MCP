/**
 * Cross-server collaboration handlers for Agile Metrics.
 */

import type { EventBus } from '@mcp-suite/core';
import type { MetricsStore } from './services/metrics-store.js';

export function setupCollaborationHandlers(eventBus: EventBus, store: MetricsStore): void {
  // Track sprint completions for velocity calculations
  eventBus.subscribe('scrum:sprint-completed', (payload) => {
    const data = payload as {
      sprintName?: string;
      completedPoints?: number;
      totalPoints?: number;
    };
    if (data.sprintName && data.completedPoints != null && data.totalPoints != null && data.totalPoints > 0) {
      const completionRate = Math.round((data.completedPoints / data.totalPoints) * 100);
      store.saveVelocity({
        sprintName: data.sprintName,
        completedPoints: data.completedPoints,
        totalPoints: data.totalPoints,
        completionRate,
      });
    }
  });

  // Track task transitions for cycle time calculations
  eventBus.subscribe('scrum:task-updated', (payload) => {
    store.saveSnapshot('task-updated', JSON.stringify(payload));
  });

  // Track story completions for throughput metrics
  eventBus.subscribe('scrum:story-completed', (payload) => {
    // Future: update story point throughput metrics
    void payload;
  });
}
