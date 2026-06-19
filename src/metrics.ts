/**
 * NexusAI Skills - Prometheus Metrics
 * 
 * Live observability instrumentation for skill execution metrics.
 * Provides /metrics endpoint for Prometheus scraping.
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from "prom-client";

// Create a custom registry
export const metricsRegistry = new Registry();

// Collect default Node.js metrics (memory, CPU, event loop, etc.)
collectDefaultMetrics({ register: metricsRegistry });

// Custom metrics for Skills service

/**
 * Counter: Total number of skill executions
 * Labels: skill_id, status (success/failed/forbidden)
 */
export const skillExecutionsTotal = new Counter({
  name: "skill_executions_total",
  help: "Total number of skill executions",
  labelNames: ["skill_id", "status"],
  registers: [metricsRegistry],
});

/**
 * Histogram: Duration of skill executions in seconds
 * Labels: skill_id, tool_name
 */
export const skillExecutionDurationSeconds = new Histogram({
  name: "skill_execution_duration_seconds",
  help: "Duration of skill executions in seconds",
  labelNames: ["skill_id", "tool_name"],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

/**
 * Counter: Total number of skill execution errors
 * Labels: skill_id, error_type
 */
export const skillExecutionErrorsTotal = new Counter({
  name: "skill_execution_errors_total",
  help: "Total number of skill execution errors",
  labelNames: ["skill_id", "error_type"],
  registers: [metricsRegistry],
});

/**
 * Gauge: Number of currently active skill executions
 */
export const activeSkillExecutions = new Gauge({
  name: "active_skill_executions",
  help: "Number of currently active skill executions",
  registers: [metricsRegistry],
});

/**
 * Counter: Total number of policy evaluations
 * Labels: skill_id, decision (allowed/denied)
 */
export const policyEvaluationsTotal = new Counter({
  name: "policy_evaluations_total",
  help: "Total number of policy evaluations",
  labelNames: ["skill_id", "decision"],
  registers: [metricsRegistry],
});

/**
 * Counter: Total number of skill registrations
 * Labels: status (success/failed)
 */
export const skillRegistrationsTotal = new Counter({
  name: "skill_registrations_total",
  help: "Total number of skill registrations",
  labelNames: ["status"],
  registers: [metricsRegistry],
});

/**
 * Gauge: Current number of registered skills
 */
export const registeredSkillsGauge = new Gauge({
  name: "registered_skills",
  help: "Current number of registered skills",
  registers: [metricsRegistry],
});

/**
 * Counter: Total number of skill revocations
 */
export const skillRevocationsTotal = new Counter({
  name: "skill_revocations_total",
  help: "Total number of skill revocations",
  registers: [metricsRegistry],
});

/**
 * Histogram: HTTP request duration in seconds
 * Labels: method, route, status_code
 */
export const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

/**
 * Counter: Total HTTP requests
 * Labels: method, route, status_code
 */
export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [metricsRegistry],
});

/**
 * Helper function to record skill execution metrics
 */
export function recordSkillExecution(params: {
  skillId: string;
  toolName: string;
  status: "success" | "failed" | "forbidden";
  durationMs: number;
  errorType?: string;
}): void {
  const { skillId, toolName, status, durationMs, errorType } = params;

  // Increment execution counter
  skillExecutionsTotal.inc({ skill_id: skillId, status });

  // Record duration
  skillExecutionDurationSeconds.observe(
    { skill_id: skillId, tool_name: toolName },
    durationMs / 1000 // Convert to seconds
  );

  // Record error if applicable
  if (errorType) {
    skillExecutionErrorsTotal.inc({ skill_id: skillId, error_type: errorType });
  }
}

/**
 * Helper function to record policy evaluation
 */
export function recordPolicyEvaluation(params: {
  skillId: string;
  decision: "allowed" | "denied";
}): void {
  policyEvaluationsTotal.inc({
    skill_id: params.skillId,
    decision: params.decision,
  });
}

/**
 * Helper function to record HTTP request
 */
export function recordHttpRequest(params: {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
}): void {
  const { method, route, statusCode, durationMs } = params;
  const statusStr = statusCode.toString();

  httpRequestsTotal.inc({ method, route, status_code: statusStr });
  httpRequestDurationSeconds.observe(
    { method, route, status_code: statusStr },
    durationMs / 1000
  );
}

/**
 * Get metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return metricsRegistry.metrics();
}

/**
 * Get content type for Prometheus metrics
 */
export function getMetricsContentType(): string {
  return metricsRegistry.contentType;
}
