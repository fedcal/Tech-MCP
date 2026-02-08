/**
 * Cross-server collaboration handlers for Project Economics.
 */

import type { EventBus } from '@mcp-suite/core';
import type { EconomicsStore } from './services/economics-store.js';

export function setupCollaborationHandlers(eventBus: EventBus, _store: EconomicsStore): void {
  // When time is logged, optionally convert to cost
  eventBus.subscribe('time:entry-logged', (payload) => {
    // Future: convert time entries to cost using hourly rates
    void payload;
  });

  // When a sprint completes, snapshot the sprint cost
  eventBus.subscribe('scrum:sprint-completed', (payload) => {
    // Future: snapshot sprint cost at completion for tracking
    void payload;
  });

  // When a decision is created, log awareness for cost tracking
  eventBus.subscribe('decision:created', (payload) => {
    const data = payload as {
      decisionId?: string;
      title?: string;
    };
    // Future: auto-create a feature cost entry when a new ADR is created
    void data;
  });
}
