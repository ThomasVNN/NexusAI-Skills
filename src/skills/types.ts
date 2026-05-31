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
 * Execution state for tracking
 */
export type ExecutionState = "queued" | "running" | "completed" | "failed" | "cancelled";

/**
 * Approval state for human-in-the-loop workflows
 */
export type ApprovalState = "pending" | "approved" | "rejected";

/**
 * Base skill parameters schema
 */
export const SkillParamsSchema = z.object({
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  context: z.record(z.any()).optional(),
});

export type SkillParams = z.infer<typeof SkillParamsSchema>;

/**
 * Base skill result schema
 */
export const SkillResultSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  metadata: z.object({
    executionTimeMs: z.number().optional(),
    skillId: z.string(),
    timestamp: z.string(),
  }).optional(),
});

export type SkillResult = z.infer<typeof SkillResultSchema>;

/**
 * Extended skill definition interface
 */
export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  version: string;
  author: string;

  // Execution
  execute(params: SkillParams): Promise<SkillResult>;

  // Metadata
  requiredPermissions: string[];
  requiredCapabilities: string[];
  estimatedDuration: string;

  // Trust & Safety
  trustScore: number;
  requiresHumanApproval: boolean;
  rateLimitPerMinute: number;

  // Parameter schemas (Zod)
  inputSchema: z.ZodSchema;
  outputSchema: z.ZodSchema;
}

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
  result?: SkillResult;
  error?: string;
  startedAt: string;
  completedAt?: string;
  approvalState?: ApprovalState;
  approvedBy?: string;
  approvalReason?: string;
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
 * Create a base skill metadata object for registration
 */
export function createBaseSkillMetadata(skill: Partial<SkillDefinition> & { id: string; name: string; description: string }): Omit<SkillDefinition, "execute"> {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    category: skill.category || "general",
    version: skill.version || "1.0.0",
    author: skill.author || "NexusAI",
    requiredPermissions: skill.requiredPermissions || [],
    requiredCapabilities: skill.requiredCapabilities || [],
    estimatedDuration: skill.estimatedDuration || "1-10s",
    trustScore: skill.trustScore ?? 80,
    requiresHumanApproval: skill.requiresHumanApproval ?? false,
    rateLimitPerMinute: skill.rateLimitPerMinute ?? 60,
    inputSchema: skill.inputSchema ?? z.object({}),
    outputSchema: skill.outputSchema ?? SkillResultSchema,
  };
}
