/**
 * EventBus interface for inter-server collaboration.
 */

import type { EventName, EventPayload } from './events.js';

export type EventHandler<E extends EventName> = (payload: EventPayload<E>) => void | Promise<void>;

export type PatternHandler = (event: string, payload: unknown) => void | Promise<void>;

export interface EventBus {
  /**
   * Publish a typed event.
   */
  publish<E extends EventName>(event: E, payload: EventPayload<E>): Promise<void>;

  /**
   * Subscribe to a specific typed event.
   * Returns an unsubscribe function.
   */
  subscribe<E extends EventName>(event: E, handler: EventHandler<E>): () => void;

  /**
   * Subscribe to events matching a pattern (e.g., "scrum:*", "code:*").
   * Returns an unsubscribe function.
   */
  subscribePattern(pattern: string, handler: PatternHandler): () => void;

  /**
   * Remove all subscriptions.
   */
  clear(): void;
}
