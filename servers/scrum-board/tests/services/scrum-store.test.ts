import { describe, it, expect, beforeEach } from 'vitest';
import { ScrumStore } from '../../src/services/scrum-store.js';

describe('ScrumStore', () => {
  let store: ScrumStore;

  beforeEach(() => {
    store = new ScrumStore({ inMemory: true });
  });

  // ── Sprints ───────────────────────────────────────────────────────────

  describe('createSprint / getSprint', () => {
    it('should create a sprint and retrieve it by id', () => {
      const sprint = store.createSprint({
        name: 'Sprint 1',
        startDate: '2025-01-01',
        endDate: '2025-01-14',
        goals: ['Deliver MVP', 'Fix critical bugs'],
      });

      expect(sprint.id).toBeDefined();
      expect(sprint.name).toBe('Sprint 1');
      expect(sprint.goals).toEqual(['Deliver MVP', 'Fix critical bugs']);
      expect(sprint.status).toBe('planning');

      const fetched = store.getSprint(sprint.id);
      expect(fetched).toBeDefined();
      expect(fetched!.name).toBe('Sprint 1');
      expect(fetched!.goals).toEqual(['Deliver MVP', 'Fix critical bugs']);
    });

    it('should return undefined for a non-existent sprint', () => {
      expect(store.getSprint(9999)).toBeUndefined();
    });
  });

  describe('listSprints', () => {
    it('should return all sprints', () => {
      store.createSprint({ name: 'Sprint A', startDate: '2025-01-01', endDate: '2025-01-14', goals: [] });
      store.createSprint({ name: 'Sprint B', startDate: '2025-01-15', endDate: '2025-01-28', goals: [] });

      const sprints = store.listSprints();
      expect(sprints).toHaveLength(2);
      const names = sprints.map((s) => s.name);
      expect(names).toContain('Sprint A');
      expect(names).toContain('Sprint B');
    });

    it('should return an empty array when there are no sprints', () => {
      expect(store.listSprints()).toEqual([]);
    });
  });

  describe('closeSprint', () => {
    it('should mark a sprint as completed', () => {
      const sprint = store.createSprint({
        name: 'Sprint 1',
        startDate: '2025-01-01',
        endDate: '2025-01-14',
        goals: ['Ship it'],
      });

      const closed = store.closeSprint(sprint.id);
      expect(closed).toBeDefined();
      expect(closed!.status).toBe('completed');
    });
  });

  // ── Stories ───────────────────────────────────────────────────────────

  describe('createStory / getStory', () => {
    it('should create a story and retrieve it by id', () => {
      const story = store.createStory({
        title: 'User Login',
        description: 'As a user I want to log in',
        acceptanceCriteria: ['Shows login form', 'Validates credentials'],
        storyPoints: 5,
        priority: 'high',
      });

      expect(story.id).toBeDefined();
      expect(story.title).toBe('User Login');
      expect(story.acceptanceCriteria).toEqual(['Shows login form', 'Validates credentials']);
      expect(story.storyPoints).toBe(5);
      expect(story.sprintId).toBeNull();

      const fetched = store.getStory(story.id);
      expect(fetched).toBeDefined();
      expect(fetched!.acceptanceCriteria).toEqual(['Shows login form', 'Validates credentials']);
    });

    it('should return undefined for a non-existent story', () => {
      expect(store.getStory(9999)).toBeUndefined();
    });

    it('should assign a story to a sprint', () => {
      const sprint = store.createSprint({
        name: 'Sprint 1',
        startDate: '2025-01-01',
        endDate: '2025-01-14',
        goals: [],
      });

      const story = store.createStory({
        title: 'Feature X',
        description: 'Implement Feature X',
        acceptanceCriteria: [],
        storyPoints: 3,
        priority: 'medium',
        sprintId: sprint.id,
      });

      expect(story.sprintId).toBe(sprint.id);
    });
  });

  describe('getBacklog', () => {
    it('should return stories not assigned to any sprint', () => {
      const sprint = store.createSprint({
        name: 'Sprint 1',
        startDate: '2025-01-01',
        endDate: '2025-01-14',
        goals: [],
      });

      store.createStory({
        title: 'Assigned Story',
        description: '',
        acceptanceCriteria: [],
        storyPoints: 2,
        priority: 'low',
        sprintId: sprint.id,
      });

      store.createStory({
        title: 'Backlog Story',
        description: '',
        acceptanceCriteria: [],
        storyPoints: 1,
        priority: 'high',
      });

      const backlog = store.getBacklog();
      expect(backlog).toHaveLength(1);
      expect(backlog[0].title).toBe('Backlog Story');
    });
  });

  // ── Tasks ─────────────────────────────────────────────────────────────

  describe('createTask / getTask', () => {
    it('should create a task linked to a story', () => {
      const story = store.createStory({
        title: 'Story A',
        description: '',
        acceptanceCriteria: [],
        storyPoints: 3,
        priority: 'medium',
      });

      const task = store.createTask({
        title: 'Implement endpoint',
        description: 'POST /api/login',
        storyId: story.id,
        assignee: 'alice',
      });

      expect(task.id).toBeDefined();
      expect(task.title).toBe('Implement endpoint');
      expect(task.storyId).toBe(story.id);
      expect(task.assignee).toBe('alice');
      expect(task.status).toBe('todo');

      const fetched = store.getTask(task.id);
      expect(fetched).toBeDefined();
      expect(fetched!.title).toBe('Implement endpoint');
    });

    it('should return undefined for a non-existent task', () => {
      expect(store.getTask(9999)).toBeUndefined();
    });

    it('should inherit sprintId from the parent story', () => {
      const sprint = store.createSprint({
        name: 'Sprint 1',
        startDate: '2025-01-01',
        endDate: '2025-01-14',
        goals: [],
      });

      const story = store.createStory({
        title: 'Story B',
        description: '',
        acceptanceCriteria: [],
        storyPoints: 2,
        priority: 'high',
        sprintId: sprint.id,
      });

      const task = store.createTask({
        title: 'Sub-task',
        description: '',
        storyId: story.id,
      });

      expect(task.sprintId).toBe(sprint.id);
    });
  });

  describe('updateTaskStatus', () => {
    it('should change the status of a task', () => {
      const story = store.createStory({
        title: 'Story',
        description: '',
        acceptanceCriteria: [],
        storyPoints: 1,
        priority: 'low',
      });

      const task = store.createTask({
        title: 'Task 1',
        description: '',
        storyId: story.id,
      });

      const updated = store.updateTaskStatus(task.id, 'in_progress');
      expect(updated).toBeDefined();
      expect(updated!.status).toBe('in_progress');

      const done = store.updateTaskStatus(task.id, 'done');
      expect(done!.status).toBe('done');
    });
  });

  // ── Board View ────────────────────────────────────────────────────────

  describe('getSprintBoard', () => {
    it('should return a board with tasks grouped by status', () => {
      const sprint = store.createSprint({
        name: 'Sprint 1',
        startDate: '2025-01-01',
        endDate: '2025-01-14',
        goals: ['Goal A'],
      });

      // Mark sprint as active so getSprintBoard can find it
      // closeSprint sets 'completed'; we need to test with explicit sprintId
      const story = store.createStory({
        title: 'Story',
        description: '',
        acceptanceCriteria: [],
        storyPoints: 3,
        priority: 'high',
        sprintId: sprint.id,
      });

      const t1 = store.createTask({ title: 'T1', description: '', storyId: story.id });
      const t2 = store.createTask({ title: 'T2', description: '', storyId: story.id });
      store.updateTaskStatus(t2.id, 'in_progress');

      const board = store.getSprintBoard(sprint.id);
      expect(board).toBeDefined();
      expect(board!.sprint.id).toBe(sprint.id);
      expect(board!.columns.todo).toHaveLength(1);
      expect(board!.columns.in_progress).toHaveLength(1);
      expect(board!.columns.done).toHaveLength(0);
    });

    it('should return undefined when sprint does not exist', () => {
      expect(store.getSprintBoard(9999)).toBeUndefined();
    });
  });

  // ── JSON Serialization ────────────────────────────────────────────────

  describe('JSON serialization', () => {
    it('should serialize/deserialize sprint goals as arrays', () => {
      const sprint = store.createSprint({
        name: 'Sprint G',
        startDate: '2025-02-01',
        endDate: '2025-02-14',
        goals: ['Alpha', 'Beta', 'Gamma'],
      });

      const fetched = store.getSprint(sprint.id)!;
      expect(Array.isArray(fetched.goals)).toBe(true);
      expect(fetched.goals).toEqual(['Alpha', 'Beta', 'Gamma']);
    });

    it('should serialize/deserialize story acceptanceCriteria as arrays', () => {
      const story = store.createStory({
        title: 'AC Test',
        description: '',
        acceptanceCriteria: ['Criterion 1', 'Criterion 2'],
        storyPoints: 1,
        priority: 'low',
      });

      const fetched = store.getStory(story.id)!;
      expect(Array.isArray(fetched.acceptanceCriteria)).toBe(true);
      expect(fetched.acceptanceCriteria).toEqual(['Criterion 1', 'Criterion 2']);
    });
  });
});
