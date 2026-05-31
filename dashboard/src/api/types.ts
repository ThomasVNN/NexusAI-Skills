export interface Skill {
  id: string;
  name: string;
  description: string;
  category: 'data' | 'legal' | 'code' | 'general';
  version: string;
  author: string;
  trustScore: number;
  permissions: string[];
  status: 'pending' | 'approved' | 'revoked' | 'disabled';
  requiredCapabilities: string[];
  estimatedDuration: string;
  requiresHumanApproval: boolean;
  rateLimitPerMinute: number;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface ExecutionRecord {
  id: string;
  skillId: string;
  skillName: string;
  userId?: string;
  params: Record<string, unknown>;
  state: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: Record<string, unknown>;
  error?: string;
  logs?: LogEntry[];
  startedAt: string;
  completedAt?: string;
  approvalState?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvalReason?: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
}

export interface SkillAnalytics {
  skillId: string;
  skillName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTimeMs: number;
  lastExecutedAt?: string;
  errorRate: number;
}

export interface ExecutionStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTimeMs: number;
  pendingApprovals: number;
  activeExecutions: number;
}

export interface SkillConfig {
  enabled: boolean;
  rateLimitPerMinute: number;
  requiresHumanApproval: boolean;
  maxRetries: number;
  timeoutMs: number;
}

export interface ApprovalRequest {
  id: string;
  skillId: string;
  skillName: string;
  userId?: string;
  params: Record<string, unknown>;
  requestedAt: string;
  riskLevel?: 'low' | 'medium' | 'high';
  purpose?: string;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface TimeSeriesDataPoint {
  timestamp: string;
  executions: number;
  successes: number;
  failures: number;
}
