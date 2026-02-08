/**
 * Workflow execution engine.
 * Resolves templates, evaluates triggers, and executes workflow steps via ClientManager.
 */

import type { McpClientManager } from '@mcp-suite/client-manager';
import type { EventBus } from '@mcp-suite/core';
import type { WorkflowStore, Workflow, WorkflowRunRecord } from './workflow-store.js';

export class WorkflowEngine {
  constructor(
    private store: WorkflowStore,
    private clientManager?: McpClientManager,
    private eventBus?: EventBus,
  ) {}

  /**
   * Resolve template strings like {{payload.field}} and {{steps[0].result.field}}.
   * If the entire string is a single template, preserves the original type.
   * If mixed text, interpolates as string.
   */
  resolveTemplates(
    template: Record<string, unknown>,
    context: { payload: Record<string, unknown>; steps: Array<{ result: Record<string, unknown> | null }> },
  ): Record<string, unknown> {
    const resolve = (value: unknown): unknown => {
      if (typeof value === 'string') {
        // Check if the entire string is a single template expression
        const fullMatch = /^\{\{(.+?)\}\}$/.exec(value);
        if (fullMatch) {
          const resolved = this.getNestedValue(fullMatch[1].trim(), context as unknown as Record<string, unknown>);
          return resolved !== undefined ? resolved : '';
        }
        // Mixed text: interpolate all {{...}} occurrences as strings
        return value.replace(/\{\{(.+?)\}\}/g, (_match, path: string) => {
          const resolved = this.getNestedValue(path.trim(), context as unknown as Record<string, unknown>);
          return resolved !== undefined ? String(resolved) : '';
        });
      }
      if (Array.isArray(value)) {
        return value.map(resolve);
      }
      if (value !== null && typeof value === 'object') {
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          result[k] = resolve(v);
        }
        return result;
      }
      return value;
    };

    return resolve(template) as Record<string, unknown>;
  }

  private getNestedValue(path: string, context: Record<string, unknown>): unknown {
    const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let current: unknown = context;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  /**
   * Evaluate trigger conditions against a payload.
   * Every key in conditions must have a matching value (===) in payload.
   */
  evaluateTrigger(conditions: Record<string, unknown>, payload: Record<string, unknown>): boolean {
    for (const [key, expected] of Object.entries(conditions)) {
      if (payload[key] !== expected) return false;
    }
    return true;
  }

  /**
   * Execute a workflow: create a run, iterate through steps, call tools via ClientManager.
   */
  async executeWorkflow(workflow: Workflow, triggerPayload: Record<string, unknown>): Promise<WorkflowRunRecord> {
    const run = this.store.createRun(workflow.id, triggerPayload);
    const startTime = Date.now();

    this.eventBus?.publish('workflow:triggered', {
      workflowId: String(workflow.id),
      name: workflow.name,
      triggeredBy: workflow.triggerEvent,
    });

    const stepResults: Array<{ result: Record<string, unknown> | null }> = [];

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        const stepDef = workflow.steps[i];
        const step = this.store.createStep(run.id, i, stepDef.server, stepDef.tool, stepDef.arguments);
        this.store.updateStep(step.id, { status: 'running', startedAt: new Date().toISOString() });

        const resolvedArgs = this.resolveTemplates(stepDef.arguments, { payload: triggerPayload, steps: stepResults });

        if (!this.clientManager) {
          throw new Error(`ClientManager not available, cannot call ${stepDef.server}/${stepDef.tool}`);
        }

        const toolResult = await this.clientManager.callTool(stepDef.server, stepDef.tool, resolvedArgs);
        const content = (toolResult as { content: Array<{ type: string; text: string }> }).content;
        let parsedResult: Record<string, unknown> = {};
        try {
          parsedResult = JSON.parse(content[0].text);
        } catch {
          parsedResult = { raw: content[0].text };
        }

        stepResults.push({ result: parsedResult });
        this.store.updateStep(step.id, { status: 'completed', result: parsedResult, completedAt: new Date().toISOString() });
      }

      const durationMs = Date.now() - startTime;
      this.store.updateRun(run.id, { status: 'completed', completedAt: new Date().toISOString(), durationMs });

      this.eventBus?.publish('workflow:completed', {
        workflowId: String(workflow.id),
        runId: String(run.id),
        name: workflow.name,
        durationMs,
      });

      return this.store.getRun(run.id)!;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - startTime;
      this.store.updateRun(run.id, { status: 'failed', error: errorMsg, completedAt: new Date().toISOString(), durationMs });

      this.eventBus?.publish('workflow:failed', {
        workflowId: String(workflow.id),
        runId: String(run.id),
        name: workflow.name,
        error: errorMsg,
      });

      return this.store.getRun(run.id)!;
    }
  }

  /**
   * Handle an incoming event: find matching active workflows and execute them.
   */
  async handleEvent(event: string, payload: unknown): Promise<void> {
    const workflows = this.store.getActiveWorkflowsByTrigger(event);
    const payloadObj = (payload && typeof payload === 'object') ? payload as Record<string, unknown> : {};
    for (const workflow of workflows) {
      if (Object.keys(workflow.triggerConditions).length === 0 || this.evaluateTrigger(workflow.triggerConditions, payloadObj)) {
        await this.executeWorkflow(workflow, payloadObj);
      }
    }
  }
}
