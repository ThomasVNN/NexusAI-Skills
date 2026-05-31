import { z } from "zod";

/**
 * Skill categories for taxonomy organization
 */
export type SkillCategory = "data" | "legal" | "code" | "general";

/**
 * Skill execution status
 */
export type SkillStatus = "pending" | "approved" | "revoked" | "disabled";

/**
 * Extended Zod schema for validated Skill packages with categories and metadata
 */
export const SkillSchema = z.object({
  id: z.string().min(1, "Skill ID is required"),
  name: z.string().min(1, "Skill name is required"),
  description: z.string().min(1, "Skill description is required"),
  category: z.enum(["data", "legal", "code", "general"]).default("general"),
  version: z.string().default("1.0.0"),
  author: z.string().default("NexusAI"),
  codeUrl: z.string().url().optional(),
  trustScore: z.number().min(0).max(100).default(80),
  permissions: z.array(z.string()).default([]),
  status: z.enum(["pending", "approved", "revoked", "disabled"]).default("approved"),
  requiredCapabilities: z.array(z.string()).default([]),
  estimatedDuration: z.string().default("1-10s"),
  requiresHumanApproval: z.boolean().default(false),
  rateLimitPerMinute: z.number().int().positive().default(60),
});

export type Skill = z.infer<typeof SkillSchema>;

/**
 * Execution state for tracking
 */
export type ExecutionState = "queued" | "running" | "completed" | "failed" | "cancelled";

/**
 * Approval state for human-in-the-loop workflows
 */
export type ApprovalState = "pending" | "approved" | "rejected";

/**
 * Execution record for tracking
 */
export interface ExecutionRecord {
  id: string;
  skillId: string;
  skillName: string;
  userId?: string;
  params: Record<string, any>;
  state: ExecutionState;
  result?: Record<string, any>;
  error?: string;
  startedAt: string;
  completedAt?: string;
  approvalState?: ApprovalState;
  approvedBy?: string;
  approvalReason?: string;
}

/**
 * Rate limit tracking
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Skill configuration for admin management
 */
export interface SkillConfig {
  enabled: boolean;
  rateLimitPerMinute: number;
  requiresHumanApproval: boolean;
  maxRetries: number;
  timeoutMs: number;
}

/**
 * Skill analytics data
 */
export interface SkillAnalytics {
  skillId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTimeMs: number;
  lastExecutedAt?: string;
  errorRate: number;
}

/**
 * Enhanced SkillRegistry with categories, execution tracking, approval workflow, and rate limiting
 */
export class SkillRegistry {
  private skills = new Map<string, Skill>();
  private executions = new Map<string, ExecutionRecord>();
  private approvalQueue: ExecutionRecord[] = [];
  private rateLimits = new Map<string, RateLimitEntry>();
  private analytics = new Map<string, SkillAnalytics>();

  constructor() {
    // Seed with core legal tools
    this.registerSkill({
      id: "vietnam-law-citations",
      name: "Vietnam Law Citation Matcher",
      description: "Extracts and visualizes legal citation paths for banking & IT domains",
      version: "1.0.0",
      author: "NexusAI Architect",
      codeUrl: "http://skills-nexus/cdn/citation-matcher.js",
      trustScore: 98,
      permissions: ["read:knowledge", "write:citations"],
      status: "approved",
      category: "legal",
      requiredCapabilities: ["legal-text-parser"],
      estimatedDuration: "3-15s",
      requiresHumanApproval: false,
      rateLimitPerMinute: 50,
    });

    // Initialize analytics
    this.initializeAnalytics();
  }

  /**
   * Initialize analytics for all registered skills
   */
  private initializeAnalytics(): void {
    for (const skill of this.listSkills()) {
      this.analytics.set(skill.id, {
        skillId: skill.id,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTimeMs: 0,
        errorRate: 0,
      });
    }
  }

  /**
   * Register a new skill
   */
  public registerSkill(skillData: unknown): Skill {
    const parsed = SkillSchema.parse(skillData);
    this.skills.set(parsed.id, parsed);

    // Initialize analytics for new skill
    if (!this.analytics.has(parsed.id)) {
      this.analytics.set(parsed.id, {
        skillId: parsed.id,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTimeMs: 0,
        errorRate: 0,
      });
    }

    return parsed;
  }

  /**
   * Get a skill by ID
   */
  public getSkill(id: string): Skill | null {
    return this.skills.get(id) || null;
  }

  /**
   * List all skills, optionally filtered by category
   */
  public listSkills(category?: SkillCategory): Skill[] {
    const skills = Array.from(this.skills.values());
    if (category) {
      return skills.filter((s) => s.category === category);
    }
    return skills;
  }

  /**
   * List skills by category
   */
  public listSkillsByCategory(): Record<SkillCategory, Skill[]> {
    const result: Record<SkillCategory, Skill[]> = {
      data: [],
      legal: [],
      code: [],
      general: [],
    };

    for (const skill of this.skills.values()) {
      result[skill.category].push(skill);
    }

    return result;
  }

  /**
   * Revoke a skill
   */
  public revokeSkill(id: string): boolean {
    const skill = this.skills.get(id);
    if (skill) {
      skill.status = "revoked";
      this.skills.set(id, skill);
      return true;
    }
    return false;
  }

  /**
   * Update skill status
   */
  public updateSkillStatus(id: string, status: SkillStatus): boolean {
    const skill = this.skills.get(id);
    if (skill) {
      skill.status = status;
      this.skills.set(id, skill);
      return true;
    }
    return false;
  }

  /**
   * Update skill configuration
   */
  public updateSkillConfig(id: string, config: Partial<SkillConfig>): boolean {
    const skill = this.skills.get(id);
    if (skill) {
      if (config.enabled !== undefined) {
        skill.status = config.enabled ? "approved" : "disabled";
      }
      if (config.rateLimitPerMinute !== undefined) {
        skill.rateLimitPerMinute = config.rateLimitPerMinute;
      }
      if (config.requiresHumanApproval !== undefined) {
        skill.requiresHumanApproval = config.requiresHumanApproval;
      }
      this.skills.set(id, skill);
      return true;
    }
    return false;
  }

  /**
   * Check and update rate limit
   */
  public checkRateLimit(skillId: string): { allowed: boolean; remaining: number; resetAt: number } {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return { allowed: false, remaining: 0, resetAt: 0 };
    }

    const limit = skill.rateLimitPerMinute;
    const now = Date.now();
    const entry = this.rateLimits.get(skillId);

    if (!entry || entry.resetAt < now) {
      // Reset rate limit window
      this.rateLimits.set(skillId, {
        count: 1,
        resetAt: now + 60000, // 1 minute window
      });
      return { allowed: true, remaining: limit - 1, resetAt: now + 60000 };
    }

    if (entry.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
  }

  /**
   * Create an execution record
   */
  public createExecution(skillId: string, userId?: string, params?: Record<string, any>): ExecutionRecord {
    const skill = this.getSkill(skillId);
    const id = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const execution: ExecutionRecord = {
      id,
      skillId,
      skillName: skill?.name || "Unknown",
      userId,
      params: params || {},
      state: "queued",
      startedAt: new Date().toISOString(),
    };

    this.executions.set(id, execution);

    // Add to approval queue if required
    if (skill?.requiresHumanApproval) {
      execution.approvalState = "pending";
      this.approvalQueue.push(execution);
    }

    return execution;
  }

  /**
   * Update execution state
   */
  public updateExecution(
    executionId: string,
    state: ExecutionState,
    result?: Record<string, any>,
    error?: string
  ): boolean {
    const execution = this.executions.get(executionId);
    if (!execution) return false;

    execution.state = state;

    if (state === "completed" || state === "failed") {
      execution.completedAt = new Date().toISOString();
      if (error) execution.error = error;

      // Update analytics
      this.updateAnalytics(execution.skillId, state === "completed", execution);
    }

    if (result) execution.result = result;

    // Remove from approval queue if completed or failed
    if (state === "completed" || state === "failed") {
      this.approvalQueue = this.approvalQueue.filter((e) => e.id !== executionId);
    }

    return true;
  }

  /**
   * Get execution by ID
   */
  public getExecution(executionId: string): ExecutionRecord | null {
    return this.executions.get(executionId) || null;
  }

  /**
   * List executions with optional filtering
   */
  public listExecutions(options?: {
    skillId?: string;
    userId?: string;
    state?: ExecutionState;
    limit?: number;
    offset?: number;
  }): ExecutionRecord[] {
    let executions = Array.from(this.executions.values());

    if (options?.skillId) {
      executions = executions.filter((e) => e.skillId === options.skillId);
    }
    if (options?.userId) {
      executions = executions.filter((e) => e.userId === options.userId);
    }
    if (options?.state) {
      executions = executions.filter((e) => e.state === options.state);
    }

    // Sort by startedAt descending
    executions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    const offset = options?.offset || 0;
    const limit = options?.limit || 100;

    return executions.slice(offset, offset + limit);
  }

  /**
   * Get pending approval queue
   */
  public getApprovalQueue(): ExecutionRecord[] {
    return this.approvalQueue.filter((e) => e.approvalState === "pending");
  }

  /**
   * Approve an execution
   */
  public approveExecution(executionId: string, approvedBy: string, reason?: string): boolean {
    const execution = this.executions.get(executionId);
    if (!execution || execution.approvalState !== "pending") return false;

    execution.approvalState = "approved";
    execution.approvedBy = approvedBy;
    execution.approvalReason = reason;

    return true;
  }

  /**
   * Reject an execution
   */
  public rejectExecution(executionId: string, rejectedBy: string, reason: string): boolean {
    const execution = this.executions.get(executionId);
    if (!execution || execution.approvalState !== "pending") return false;

    execution.approvalState = "rejected";
    execution.approvedBy = rejectedBy;
    execution.approvalReason = reason;
    execution.state = "failed";
    execution.completedAt = new Date().toISOString();
    execution.error = `Execution rejected: ${reason}`;

    // Remove from approval queue
    this.approvalQueue = this.approvalQueue.filter((e) => e.id !== executionId);

    return true;
  }

  /**
   * Update analytics for a skill execution
   */
  private updateAnalytics(
    skillId: string,
    success: boolean,
    execution: ExecutionRecord
  ): void {
    const analytics = this.analytics.get(skillId);
    if (!analytics) return;

    const executionTime = execution.completedAt
      ? new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()
      : 0;

    analytics.totalExecutions++;
    if (success) {
      analytics.successfulExecutions++;
    } else {
      analytics.failedExecutions++;
    }

    // Update average execution time
    analytics.averageExecutionTimeMs =
      (analytics.averageExecutionTimeMs * (analytics.totalExecutions - 1) + executionTime) /
      analytics.totalExecutions;

    analytics.lastExecutedAt = execution.completedAt || execution.startedAt;
    analytics.errorRate = analytics.failedExecutions / analytics.totalExecutions;

    this.analytics.set(skillId, analytics);
  }

  /**
   * Get analytics for all skills or a specific skill
   */
  public getAnalytics(skillId?: string): SkillAnalytics | SkillAnalytics[] {
    if (skillId) {
      return this.analytics.get(skillId) || {
        skillId,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTimeMs: 0,
        errorRate: 0,
      };
    }
    return Array.from(this.analytics.values());
  }

  /**
   * Get execution statistics summary
   */
  public getExecutionStats(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTimeMs: number;
    pendingApprovals: number;
  } {
    let totalExecutions = 0;
    let successfulExecutions = 0;
    let failedExecutions = 0;
    let totalTime = 0;

    for (const analytics of this.analytics.values()) {
      totalExecutions += analytics.totalExecutions;
      successfulExecutions += analytics.successfulExecutions;
      failedExecutions += analytics.failedExecutions;
      totalTime += analytics.averageExecutionTimeMs * analytics.totalExecutions;
    }

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTimeMs: totalExecutions > 0 ? totalTime / totalExecutions : 0,
      pendingApprovals: this.approvalQueue.filter((e) => e.approvalState === "pending").length,
    };
  }
}
