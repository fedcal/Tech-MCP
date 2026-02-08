/**
 * In-process EventBus implementation using Node.js EventEmitter.
 * Ideal for local development and testing where all servers run in one process.
 */

import { EventEmitter } from 'node:events';
import micromatch from 'micromatch';
import type { EventBus, EventHandler, PatternHandler } from './bus.js';
import type { EventName, EventPayload } from './events.js';

interface PatternSubscription {
  pattern: string;
  handler: PatternHandler;
}

export class LocalEventBus implements EventBus {
  private emitter = new EventEmitter();
  private patternSubs: PatternSubscription[] = [];

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  async publish<E extends EventName>(event: E, payload: EventPayload<E>): Promise<void> {
    this.emitter.emit(event, payload);

    // Also check pattern subscribers
    for (const sub of this.patternSubs) {
      if (micromatch.isMatch(event, sub.pattern)) {
        try {
          await sub.handler(event, payload);
        } catch {
          // Pattern handler errors are silently caught to not break publishing
        }
      }
    }
  }

  subscribe<E extends EventName>(event: E, handler: EventHandler<E>): () => void {
    this.emitter.on(event, handler);
    return () => {
      this.emitter.off(event, handler);
    };
  }

  subscribePattern(pattern: string, handler: PatternHandler): () => void {
    const sub: PatternSubscription = { pattern, handler };
    this.patternSubs.push(sub);
    return () => {
      const index = this.patternSubs.indexOf(sub);
      if (index >= 0) this.patternSubs.splice(index, 1);
    };
  }

  clear(): void {
    this.emitter.removeAllListeners();
    this.patternSubs = [];
  }
}
