/**
 * Cross-server collaboration handlers for Codebase Knowledge.
 */

import type { EventBus } from '@mcp-suite/core';
import type { KnowledgeStore } from './services/knowledge-store.js';

export function setupCollaborationHandlers(eventBus: EventBus, store: KnowledgeStore): void {
  // When a code review is completed, track the change
  eventBus.subscribe('code:review-completed', (payload) => {
    const data = payload as {
      prTitle?: string;
      filesChanged?: number;
      author?: string;
      repository?: string;
    };
    if (data.repository) {
      store.trackChange({
        modulePath: data.repository,
        changeType: 'review-completed',
        description: data.prTitle || 'Code review completed',
        filesChanged: data.filesChanged,
        author: data.author,
      });
    }
  });
}
