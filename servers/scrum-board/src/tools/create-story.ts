/**
 * Tool: create-story
 * Creates a new user story.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ScrumStore } from '../services/scrum-store.js';

export function registerCreateStory(server: McpServer, store: ScrumStore): void {
  server.tool(
    'create-story',
    'Create a new user story, optionally assigning it to a sprint',
    {
      title: z.string().describe('Story title'),
      description: z.string().describe('Story description'),
      acceptanceCriteria: z.array(z.string()).describe('List of acceptance criteria'),
      storyPoints: z.number().describe('Story point estimate'),
      priority: z.string().describe('Priority level (e.g. "high", "medium", "low")'),
      sprintId: z.number().optional().describe('Sprint ID to assign this story to'),
    },
    async ({ title, description, acceptanceCriteria, storyPoints, priority, sprintId }) => {
      try {
        const story = store.createStory({
          title,
          description,
          acceptanceCriteria,
          storyPoints,
          priority,
          sprintId,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(story, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to create story: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
