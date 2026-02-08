/**
 * Mock EventBus for testing event emission and subscription.
 */

import type { EventBus, EventHandler, PatternHandler } from '@mcp-suite/event-bus';
import type { EventName, EventPayload } from '@mcp-suite/event-bus';

interface PublishedEvent {
  event: string;
  payload: unknown;
  timestamp: Date;
}

export class MockEventBus implements EventBus {
  public published: PublishedEvent[] = [];
  private handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  private patternHandlers: Array<{ pattern: string; handler: PatternHandler }> = [];

  async publish<E extends EventName>(event: E, payload: EventPayload<E>): Promise<void> {
    this.published.push({ event, payload, timestamp: new Date() });

    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        await handler(payload);
      }
    }
  }

  subscribe<E extends EventName>(event: E, handler: EventHandler<E>): () => void {
    const handlers = this.handlers.get(event) || [];
    handlers.push(handler as (...args: unknown[]) => void);
    this.handlers.set(event, handlers);

    return () => {
      const list = this.handlers.get(event);
      if (list) {
        const index = list.indexOf(handler as (...args: unknown[]) => void);
        if (index >= 0) list.splice(index, 1);
      }
    };
  }

  subscribePattern(pattern: string, handler: PatternHandler): () => void {
    const sub = { pattern, handler };
    this.patternHandlers.push(sub);
    return () => {
      const index = this.patternHandlers.indexOf(sub);
      if (index >= 0) this.patternHandlers.splice(index, 1);
    };
  }

  clear(): void {
    this.published = [];
    this.handlers.clear();
    this.patternHandlers = [];
  }

  getPublishedEvents(eventName?: string): PublishedEvent[] {
    if (eventName) {
      return this.published.filter((e) => e.event === eventName);
    }
    return this.published;
  }

  wasPublished(eventName: string): boolean {
    return this.published.some((e) => e.event === eventName);
  }
}
