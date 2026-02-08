/**
 * Integration test: standup-notes → scrum-board (sprint-board)
 * Verifies that generate-status-report can fetch sprint data from scrum-board via ClientManager.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { McpClientManager } from '@mcp-suite/client-manager';
import { createStandupNotesServer } from '../../src/server.js';
import { createScrumBoardServer } from '../../../scrum-board/src/server.js';

describe('generate-status-report → scrum-board wiring', () => {
  let callerHarness: TestHarness;
  let clientManager: McpClientManager;

  afterEach(async () => {
    if (callerHarness) await callerHarness.close();
    if (clientManager) await clientManager.disconnectAll();
  });

  it('should enrich status report with sprint board data from scrum-board', async () => {
    // 1. Create target server (scrum-board)
    const targetSuite = createScrumBoardServer({ storeOptions: { inMemory: true } });

    // 2. Wire target server to clientManager
    clientManager = new McpClientManager();
    const [clientTransport, serverTransport] = McpClientManager.createInMemoryPair();
    await targetSuite.server.connect(serverTransport);
    await clientManager.connectInMemoryWithTransport('scrum-board', clientTransport);

    // 3. Populate test data: create a sprint with tasks
    const sprintResult = await clientManager.callTool('scrum-board', 'create-sprint', {
      name: 'Sprint 5',
      startDate: '2025-07-01',
      endDate: '2025-07-14',
      goals: ['Feature X'],
    });
    const sprint = JSON.parse(
      ((sprintResult as { content: Array<{ text: string }> }).content[0]).text,
    );

    const storyResult = await clientManager.callTool('scrum-board', 'create-story', {
      title: 'Feature X',
      description: 'Implement feature X',
      acceptanceCriteria: ['Works'],
      storyPoints: 8,
      priority: 'high',
      sprintId: sprint.id,
    });
    const story = JSON.parse(
      ((storyResult as { content: Array<{ text: string }> }).content[0]).text,
    );

    // Create 4 tasks, put 2 done, 1 in_progress, 1 todo
    const tasks = [];
    for (let i = 1; i <= 4; i++) {
      const taskResult = await clientManager.callTool('scrum-board', 'create-task', {
        title: `Task ${i}`,
        description: `Task ${i} desc`,
        storyId: story.id,
      });
      tasks.push(
        JSON.parse(((taskResult as { content: Array<{ text: string }> }).content[0]).text),
      );
    }
    await clientManager.callTool('scrum-board', 'update-task-status', {
      taskId: tasks[0].id,
      status: 'done',
    });
    await clientManager.callTool('scrum-board', 'update-task-status', {
      taskId: tasks[1].id,
      status: 'done',
    });
    await clientManager.callTool('scrum-board', 'update-task-status', {
      taskId: tasks[2].id,
      status: 'in_progress',
    });

    // 4. Create caller server (standup-notes) with clientManager
    const callerSuite = createStandupNotesServer({
      clientManager,
      storeOptions: { inMemory: true },
    });
    callerHarness = await createTestHarness(callerSuite.server);

    // 5. Call generate-status-report with includeSprintData
    const result = await callerHarness.client.callTool({
      name: 'generate-status-report',
      arguments: {
        days: 7,
        includeSprintData: true,
        sprintId: sprint.id,
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const report = JSON.parse(content[0].text);

    // Should have sprint board data
    expect(report.sprintBoard).toBeDefined();
    expect(report.sprintBoard.sprintName).toBe('Sprint 5');
    expect(report.sprintBoard.taskCounts.done).toBe(2);
    expect(report.sprintBoard.taskCounts.inProgress).toBe(1);
    expect(report.sprintBoard.taskCounts.todo).toBe(1);
  });
});
