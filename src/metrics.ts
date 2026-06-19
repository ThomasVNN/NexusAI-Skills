/**
 * NexusAI Skills - Metrics
 * 
 * Simple metrics without external dependencies.
 * Provides basic counter and gauge functionality.
 */

// Simple metrics registry
class SimpleMetrics {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();

  incCounter(name: string, value: number = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  getCounter(name: string): number {
    return this.counters.get(name) || 0;
  }

  getGauge(name: string): number {
    return this.gauges.get(name) || 0;
  }

  formatPrometheus(): string {
    const lines: string[] = [];
    
    // Format counters
    for (const [name, value] of this.counters) {
      lines.push(`# HELP ${name} Counter metric`);
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${value}`);
    }
    
    // Format gauges
    for (const [name, value] of this.gauges) {
      lines.push(`# HELP ${name} Gauge metric`);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    }
    
    return lines.join('\n');
  }
}

// Singleton instance
export const metrics = new SimpleMetrics();

// Export helper functions
export function recordSkillExecution(params: {
  skillId: string;
  toolName: string;
  status: 'success' | 'failed' | 'forbidden';
}): void {
  metrics.incCounter(`skill_executions_total{skill_id="${params.skillId}",status="${params.status}"}`);
}

export function recordHttpRequest(params: {
  method: string;
  route: string;
  statusCode: number;
}): void {
  metrics.incCounter(`http_requests_total{method="${params.method}",route="${params.route}",status="${params.statusCode}"}`);
}

export async function getMetrics(): Promise<string> {
  return metrics.formatPrometheus();
}
