import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestHarness, type TestHarness, MockEventBus } from '@mcp-suite/testing';
import { createScrumBoardServer } from '../../src/server.js';

describe('update-task-status', () => {
  let harness: TestHarness;
  let eventBus: MockEventBus;

  beforeEach(async () => {
    eventBus = new MockEventBus();
    const suite = createScrumBoardServer({ eventBus, storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);
  });

  afterEach(async () => {
    await harness.close();
  });

  /**
   * Helper: create a sprint -> story -> task pipeline so we have a valid task to update.
   */
  async function createTaskPipeline(): Promise<{ sprintId: number; storyId: number; taskId: number }> {
    // 1. Create sprint
    const sprintResult = await harness.client.callTool({
      name: 'create-sprint',
      arguments: {
        name: 'Sprint 1',
        startDate: '2025-06-01',
        endDate: '2025-06-14',
        goals: ['Test goal'],
      },
    });
    const sprint = JSON.parse((sprintResult.content as Array<{ text: string }>)[0].text);

    // 2. Create story in the sprint
    const storyResult = await harness.client.callTool({
      name: 'create-story',
      arguments: {
        title: 'User Login',
        description: 'Implement user login feature',
        acceptanceCriteria: ['Form renders', 'Validates input'],
        storyPoints: 5,
        priority: 'high',
        sprintId: sprint.id,
      },
    });
    const story = JSON.parse((storyResult.content as Array<{ text: string }>)[0].text);

    // 3. Create task under the story
    const taskResult = await harness.client.callTool({
      name: 'create-task',
      arguments: {
        title: 'Implement POST /login',
        description: 'Create the login endpoint',
        storyId: story.id,
        assignee: 'alice',
      },
    });
    const task = JSON.parse((taskResult.content as Array<{ text: string }>)[0].text);

    return { sprintId: sprint.id, storyId: story.id, taskId: task.id };
  }

  it('should update task status and return the updated task', async () => {
    const { taskId } = await createTaskPipeline();

    // Clear events from setup
    eventBus.published = [];

    const result = await harness.client.callTool({
      name: 'update-task-status',
      arguments: {
        taskId,
        status: 'in_progress',
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe('text');

    const parsed = JSON.parse(content[0].text);
    expect(parsed.id).toBe(taskId);
    expect(parsed.status).toBe('in_progress');
    expect(parsed.title).toBe('Implement POST /login');
    expect(parsed.assignee).toBe('alice');
  });

  it('should publish scrum:task-updated event with previous and new status', async () => {
    const { taskId, sprintId } = await createTaskPipeline();

    // Clear events from setup (sprint creation etc.)
    eventBus.published = [];

    await harness.client.callTool({
      name: 'update-task-status',
      arguments: {
        taskId,
        status: 'in_review',
      },
    });

    expect(eventBus.wasPublished('scrum:task-updated')).toBe(true);

    const events = eventBus.getPublishedEvents('scrum:task-updated');
    expect(events).toHaveLength(1);

    const payload = events[0].payload as {
      taskId: string;
      previousStatus: string;
      newStatus: string;
      assignee?: string;
      sprintId?: string;
    };
    expect(payload.taskId).toBe(String(taskId));
    expect(payload.previousStatus).toBe('todo');
    expect(payload.newStatus).toBe('in_review');
    expect(payload.assignee).toBe('alice');
    expect(payload.sprintId).toBe(String(sprintId));
  });

  it('should return error for non-existent task', async () => {
    const result = await harness.client.callTool({
      name: 'update-task-status',
      arguments: {
        taskId: 99999,
        status: 'done',
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain('not found');
    expect(result.isError).toBe(true);
  });
});
