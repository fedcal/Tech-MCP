/**
 * Scrum Board MCP Server
 * Tools for managing sprints, user stories, tasks, and the scrum board.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { ScrumStore } from './services/scrum-store.js';
import { registerCreateSprint } from './tools/create-sprint.js';
import { registerGetSprint } from './tools/get-sprint.js';
import { registerCreateStory } from './tools/create-story.js';
import { registerCreateTask } from './tools/create-task.js';
import { registerUpdateTaskStatus } from './tools/update-task-status.js';
import { registerSprintBoard } from './tools/sprint-board.js';
import { registerGetBacklog } from './tools/get-backlog.js';
import { setupCollaborationHandlers } from './collaboration.js';

export function createScrumBoardServer(options?: { eventBus?: EventBus; storeOptions?: { inMemory?: boolean } }): McpSuiteServer {
  const eventBus = options?.eventBus;
  const suite = createMcpServer({
    name: 'scrum-board',
    version: '0.1.0',
    description: 'MCP server for managing sprints, user stories, tasks, and the scrum board',
    eventBus,
  });

  const store = new ScrumStore(options?.storeOptions);

  // Register all tools
  registerCreateSprint(suite.server, store, suite.eventBus);
  registerGetSprint(suite.server, store);
  registerCreateStory(suite.server, store);
  registerCreateTask(suite.server, store);
  registerUpdateTaskStatus(suite.server, store, suite.eventBus);
  registerSprintBoard(suite.server, store);
  registerGetBacklog(suite.server, store);

  // Setup cross-server collaboration handlers
  if (suite.eventBus) {
    setupCollaborationHandlers(suite.eventBus, store);
  }

  suite.logger.info('All scrum-board tools registered');

  return suite;
}
