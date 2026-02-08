/**
 * Stateless correlation engine that aggregates data from multiple MCP servers.
 * Uses graceful degradation when servers are unavailable.
 */

import type { McpClientManager } from '@mcp-suite/client-manager';

export class CorrelationEngine {
  constructor(private clientManager?: McpClientManager) {}

  /**
   * Call a server tool safely. Returns null if unreachable.
   */
  async safeCall(
    server: string,
    tool: string,
    args: Record<string, unknown> = {},
  ): Promise<Record<string, unknown> | null> {
    if (!this.clientManager) return null;
    try {
      const result = await this.clientManager.callTool(server, tool, args);
      const content = (result as { content: Array<{ type: string; text: string }> }).content;
      return JSON.parse(content[0].text);
    } catch {
      return null;
    }
  }

  /**
   * Aggregate project health from multiple servers.
   * Returns object with sections per area + dataSources field.
   */
  async getProjectHealth(): Promise<Record<string, unknown>> {
    const dataSources: Record<string, string> = {};

    // Call agile-metrics for velocity
    const velocity = await this.safeCall('agile-metrics', 'calculate-velocity', {
      sprints: [{ name: 'current', completedPoints: 0, totalPoints: 0 }],
    });
    dataSources['agile-metrics'] = velocity ? 'available' : 'unavailable';

    // Call time-tracking for timesheet
    const timesheet = await this.safeCall('time-tracking', 'get-timesheet', {});
    dataSources['time-tracking'] = timesheet ? 'available' : 'unavailable';

    // Call project-economics for budget
    const budget = await this.safeCall('project-economics', 'get-budget-status', {
      projectName: 'default',
    });
    dataSources['project-economics'] = budget ? 'available' : 'unavailable';

    // Calculate health score (simple: count available servers / total)
    const availableCount = Object.values(dataSources).filter(
      (s) => s === 'available',
    ).length;
    const totalServers = Object.keys(dataSources).length;
    const healthScore =
      totalServers > 0 ? Math.round((availableCount / totalServers) * 100) : 0;

    return {
      healthScore,
      velocity: velocity || { status: 'unavailable' },
      timeTracking: timesheet || { status: 'unavailable' },
      budget: budget || { status: 'unavailable' },
      dataSources,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Correlate metrics from different servers.
   */
  async correlateMetrics(metrics: string[]): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};
    const dataSources: Record<string, string> = {};

    // Mapping metric -> server/tool
    const metricMap: Record<
      string,
      { server: string; tool: string; args?: Record<string, unknown> }
    > = {
      velocity: {
        server: 'agile-metrics',
        tool: 'calculate-velocity',
        args: {
          sprints: [{ name: 'current', completedPoints: 0, totalPoints: 0 }],
        },
      },
      'time-logged': { server: 'time-tracking', tool: 'get-timesheet' },
      'budget-spent': {
        server: 'project-economics',
        tool: 'get-budget-status',
        args: { projectName: 'default' },
      },
    };

    for (const metric of metrics) {
      const mapping = metricMap[metric];
      if (mapping) {
        const data = await this.safeCall(
          mapping.server,
          mapping.tool,
          mapping.args || {},
        );
        results[metric] = data || { status: 'unavailable' };
        dataSources[metric] = data ? 'available' : 'unavailable';
      } else {
        results[metric] = { status: 'unknown-metric' };
        dataSources[metric] = 'unknown';
      }
    }

    return { metrics: results, dataSources, analyzedAt: new Date().toISOString() };
  }

  /**
   * Explain a trend for a metric.
   */
  async explainTrend(
    metric: string,
    direction?: string,
  ): Promise<Record<string, unknown>> {
    const metricData = await this.correlateMetrics([metric]);
    return {
      metric,
      direction: direction || 'unknown',
      analysis: metricData,
      explanation: `Trend analysis for ${metric}${direction ? ` (${direction})` : ''}. Review the correlated data for insights.`,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Query insight based on keyword matching.
   */
  async queryInsight(question: string): Promise<Record<string, unknown>> {
    const lowerQ = question.toLowerCase();
    const relevantMetrics: string[] = [];

    if (
      lowerQ.includes('velocity') ||
      lowerQ.includes('sprint') ||
      lowerQ.includes('agile')
    ) {
      relevantMetrics.push('velocity');
    }
    if (
      lowerQ.includes('time') ||
      lowerQ.includes('hours') ||
      lowerQ.includes('logged')
    ) {
      relevantMetrics.push('time-logged');
    }
    if (
      lowerQ.includes('budget') ||
      lowerQ.includes('cost') ||
      lowerQ.includes('spend')
    ) {
      relevantMetrics.push('budget-spent');
    }

    if (relevantMetrics.length === 0) {
      relevantMetrics.push('velocity', 'time-logged', 'budget-spent');
    }

    const data = await this.correlateMetrics(relevantMetrics);
    return {
      question,
      relevantMetrics,
      data,
      generatedAt: new Date().toISOString(),
    };
  }
}
