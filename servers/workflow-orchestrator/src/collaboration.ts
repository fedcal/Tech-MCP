/**
 * Cross-server collaboration handlers for Workflow Orchestrator.
 * Subscribes to all events and triggers matching workflows.
 */

import type { EventBus } from '@mcp-suite/core';
import type { WorkflowEngine } from './services/workflow-engine.js';

export function setupCollaborationHandlers(eventBus: EventBus, engine: WorkflowEngine): void {
  eventBus.subscribePattern('*', async (event: string, payload: unknown) => {
    try {
      await engine.handleEvent(event, payload);
    } catch {
      // Errors in workflow execution should not block the event bus
    }
  });
}
