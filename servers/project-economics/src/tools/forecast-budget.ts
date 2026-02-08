/**
 * Tool: forecast-budget
 * Forecast when a project budget will run out based on historical spending.
 * Cross-server: can fetch time data from time-tracking via ClientManager.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpClientManager } from '@mcp-suite/client-manager';
import type { EconomicsStore } from '../services/economics-store.js';

export function registerForecastBudget(server: McpServer, store: EconomicsStore, clientManager?: McpClientManager): void {
  server.tool(
    'forecast-budget',
    'Forecast when the project budget will run out based on daily burn rate. Optionally include time-tracking labor cost data.',
    {
      projectName: z.string().describe('The name of the project'),
      includeTimeData: z
        .boolean()
        .optional()
        .describe('If true, fetch time-tracking data to include actual labor hours in the forecast'),
      hourlyRate: z
        .number()
        .optional()
        .describe('Hourly rate for labor cost calculation (used with includeTimeData, default: 50)'),
    },
    async ({ projectName, includeTimeData, hourlyRate }) => {
      try {
        const forecast = store.forecastBudget(projectName);
        const result: Record<string, unknown> = { ...forecast };

        // Enrich with time-tracking labor cost data
        if (includeTimeData && clientManager) {
          const timeResult = await clientManager.callTool('time-tracking', 'get-timesheet', {});
          const content = (timeResult as { content: Array<{ type: string; text: string }> }).content;
          const timesheet = JSON.parse(content[0].text);
          const rate = hourlyRate ?? 50;
          const trackedHours = timesheet.totalMinutes / 60;
          const laborCost = Math.round(trackedHours * rate * 100) / 100;
          result.laborAnalysis = {
            trackedHours: Math.round(trackedHours * 100) / 100,
            hourlyRate: rate,
            estimatedLaborCost: laborCost,
            timesheetEntries: timesheet.entryCount,
          };
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to forecast budget: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
