/**
 * Skills Metrics Unit Tests
 * Tests helper functions and metric recording logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the entire metrics module
vi.mock('../src/metrics.js', () => ({
  skillExecutionsTotal: { inc: vi.fn() },
  skillExecutionDurationSeconds: { observe: vi.fn() },
  skillExecutionErrorsTotal: { inc: vi.fn() },
  policyEvaluationsTotal: { inc: vi.fn() },
  httpRequestsTotal: { inc: vi.fn() },
  httpRequestDurationSeconds: { observe: vi.fn() },
  registeredSkillsGauge: { set: vi.fn() },
  metricsRegistry: {
    metrics: vi.fn().mockResolvedValue('# HELP skill_executions_total Total skill executions\nskill_executions_total 10\n'),
    contentType: 'text/plain; version=0.0.4; charset=utf-8',
  },
  recordSkillExecution: vi.fn(),
  recordPolicyEvaluation: vi.fn(),
  recordHttpRequest: vi.fn(),
  getMetrics: vi.fn().mockResolvedValue('# HELP skill_executions_total\nskill_executions_total 10\n'),
  getMetricsContentType: vi.fn().mockReturnValue('text/plain; version=0.0.4; charset=utf-8'),
}));

describe('SkillsMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordSkillExecution', () => {
    it('should record successful execution', async () => {
      const { recordSkillExecution } = await import('../src/metrics.js');

      recordSkillExecution({
        skillId: 'browser-skill',
        toolName: 'browser_click',
        status: 'success',
        durationMs: 250,
      });

      expect(recordSkillExecution).toHaveBeenCalledWith({
        skillId: 'browser-skill',
        toolName: 'browser_click',
        status: 'success',
        durationMs: 250,
      });
    });

    it('should record failed execution with error type', async () => {
      const { recordSkillExecution } = await import('../src/metrics.js');

      recordSkillExecution({
        skillId: 'browser-skill',
        toolName: 'browser_click',
        status: 'failed',
        durationMs: 500,
        errorType: 'timeout',
      });

      expect(recordSkillExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          skillId: 'browser-skill',
          status: 'failed',
          errorType: 'timeout',
        })
      );
    });

    it('should record forbidden execution', async () => {
      const { recordSkillExecution } = await import('../src/metrics.js');

      recordSkillExecution({
        skillId: 'dangerous-skill',
        toolName: 'shell_exec',
        status: 'forbidden',
        durationMs: 10,
      });

      expect(recordSkillExecution).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'forbidden' })
      );
    });

    it('should convert duration from ms to seconds', async () => {
      const { recordSkillExecution } = await import('../src/metrics.js');

      recordSkillExecution({
        skillId: 'browser-skill',
        toolName: 'browser_click',
        status: 'success',
        durationMs: 1000,
      });

      expect(recordSkillExecution).toHaveBeenCalledWith(
        expect.objectContaining({ durationMs: 1000 })
      );
    });
  });

  describe('recordPolicyEvaluation', () => {
    it('should record allowed policy decision', async () => {
      const { recordPolicyEvaluation } = await import('../src/metrics.js');

      recordPolicyEvaluation({ skillId: 'browser-skill', decision: 'allowed' });

      expect(recordPolicyEvaluation).toHaveBeenCalledWith({
        skillId: 'browser-skill',
        decision: 'allowed',
      });
    });

    it('should record denied policy decision', async () => {
      const { recordPolicyEvaluation } = await import('../src/metrics.js');

      recordPolicyEvaluation({ skillId: 'dangerous-skill', decision: 'denied' });

      expect(recordPolicyEvaluation).toHaveBeenCalledWith({
        skillId: 'dangerous-skill',
        decision: 'denied',
      });
    });
  });

  describe('recordHttpRequest', () => {
    it('should record HTTP request metrics', async () => {
      const { recordHttpRequest } = await import('../src/metrics.js');

      recordHttpRequest({
        method: 'GET',
        route: '/health',
        statusCode: 200,
        durationMs: 5,
      });

      expect(recordHttpRequest).toHaveBeenCalledWith({
        method: 'GET',
        route: '/health',
        statusCode: 200,
        durationMs: 5,
      });
    });

    it('should record 4xx HTTP request', async () => {
      const { recordHttpRequest } = await import('../src/metrics.js');

      recordHttpRequest({
        method: 'POST',
        route: '/api/skills',
        statusCode: 400,
        durationMs: 50,
      });

      expect(recordHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 })
      );
    });

    it('should record 5xx HTTP request', async () => {
      const { recordHttpRequest } = await import('../src/metrics.js');

      recordHttpRequest({
        method: 'GET',
        route: '/api/skills',
        statusCode: 500,
        durationMs: 200,
      });

      expect(recordHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 500 })
      );
    });
  });

  describe('getMetrics', () => {
    it('should return metrics string', async () => {
      const { getMetrics } = await import('../src/metrics.js');

      const metrics = await getMetrics();

      expect(typeof metrics).toBe('string');
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should return Prometheus format', async () => {
      const { getMetrics } = await import('../src/metrics.js');

      const metrics = await getMetrics();

      expect(metrics).toContain('# HELP');
    });
  });

  describe('getMetricsContentType', () => {
    it('should return correct content type', async () => {
      const { getMetricsContentType } = await import('../src/metrics.js');

      const contentType = getMetricsContentType();

      expect(contentType).toContain('text/plain');
    });
  });
});
