/**
 * Integration test: agile-metrics → scrum-board (get-sprint)
 * Verifies that calculate-velocity can fetch sprint data from scrum-board via ClientManager.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { McpClientManager } from '@mcp-suite/client-manager';
import { createAgileMetricsServer } from '../../src/server.js';
import { createScrumBoardServer } from '../../../scrum-board/src/server.js';

describe('calculate-velocity → scrum-board wiring', () => {
  let callerHarness: TestHarness;
  let clientManager: McpClientManager;

  afterEach(async () => {
    if (callerHarness) await callerHarness.close();
    if (clientManager) await clientManager.disconnectAll();
  });

  it('should fetch sprint data from scrum-board and calculate velocity', async () => {
    // 1. Create target server (scrum-board)
    const targetSuite = createScrumBoardServer({ storeOptions: { inMemory: true } });

    // 2. Wire target server to clientManager via InMemoryTransport
    clientManager = new McpClientManager();
    const [clientTransport, serverTransport] = McpClientManager.createInMemoryPair();
    await targetSuite.server.connect(serverTransport);
    await clientManager.connectInMemoryWithTransport('scrum-board', clientTransport);

    // 3. Populate test data on scrum-board
    const sprintResult = await clientManager.callTool('scrum-board', 'create-sprint', {
      name: 'Sprint 1',
      startDate: '2025-06-01',
      endDate: '2025-06-14',
      goals: ['Test velocity'],
    });
    const sprint = JSON.parse(
      ((sprintResult as { content: Array<{ text: string }> }).content[0]).text,
    );
    const sprintId = sprint.id;

    // Create a story in the sprint
    const storyResult = await clientManager.callTool('scrum-board', 'create-story', {
      title: 'Test story',
      description: 'A test story',
      acceptanceCriteria: ['It works'],
      storyPoints: 5,
      priority: 'high',
      sprintId,
    });
    const story = JSON.parse(
      ((storyResult as { content: Array<{ text: string }> }).content[0]).text,
    );

    // Create tasks and mark some as done
    const task1 = await clientManager.callTool('scrum-board', 'create-task', {
      title: 'Task 1',
      description: 'First task',
      storyId: story.id,
    });
    const task1Id = JSON.parse(
      ((task1 as { content: Array<{ text: string }> }).content[0]).text,
    ).id;

    await clientManager.callTool('scrum-board', 'create-task', {
      title: 'Task 2',
      description: 'Second task',
      storyId: story.id,
    });

    await clientManager.callTool('scrum-board', 'create-task', {
      title: 'Task 3',
      description: 'Third task',
      storyId: story.id,
    });

    // Mark task 1 as done
    await clientManager.callTool('scrum-board', 'update-task-status', {
      taskId: task1Id,
      status: 'done',
    });

    // 4. Create caller server (agile-metrics) with clientManager
    const callerSuite = createAgileMetricsServer({
      clientManager,
      storeOptions: { inMemory: true },
    });
    callerHarness = await createTestHarness(callerSuite.server);

    // 5. Call calculate-velocity with sprintIds
    const result = await callerHarness.client.callTool({
      name: 'calculate-velocity',
      arguments: { sprintIds: [sprintId] },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].type).toBe('text');
    const velocity = JSON.parse(content[0].text);

    // Sprint 1: 1 done out of 3 tasks
    expect(velocity.sprintCount).toBe(1);
    expect(velocity.sprints[0].name).toBe('Sprint 1');
    expect(velocity.sprints[0].completedPoints).toBe(1);
    expect(velocity.sprints[0].totalPoints).toBe(3);
    expect(velocity.averageVelocity).toBe(1);
  });
});
