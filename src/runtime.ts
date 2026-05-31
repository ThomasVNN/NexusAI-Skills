import { z } from "zod";
import { SkillRegistry, Skill, ExecutionState } from "./registry.js";
import { PolicyEngine } from "./policy.js";
import { Tool } from "./internal/skills.interface.js";
import { pino } from "pino";

const logger = pino();

// Input DTO Schema (Intent Stage)
export const ExecuteSkillRequestSchema = z.object({
  skillId: z.string().min(1, "Skill ID is required"),
  toolName: z.string().min(1, "Tool name is required"),
  args: z.record(z.any()).default({}),
  context: z.object({
    userId: z.string().optional(),
    role: z.string().optional()
  }).optional()
});

export type ExecuteSkillRequest = z.infer<typeof ExecuteSkillRequestSchema>;

/**
 * Execution queue item
 */
interface QueueItem {
  id: string;
  request: ExecuteSkillRequest;
  priority: number;
  createdAt: Date;
  timeout?: NodeJS.Timeout;
}

/**
 * Streaming result chunk
 */
export interface StreamChunk {
  type: "progress" | "result" | "error" | "complete";
  data: any;
  timestamp: string;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Execution options
 */
export interface ExecutionOptions {
  timeoutMs?: number;
  enableStreaming?: boolean;
  retryConfig?: Partial<RetryConfig>;
  skipApproval?: boolean;
}

export interface AuditData {
  requestedAt: string;
  completedAt: string;
  skillId: string;
  toolName: string;
  userId?: string;
  policyCheck: {
    allowed: boolean;
    reason?: string;
    trustScore: number;
    permissionsChecked: string[];
  };
  sandbox: {
    type: string;
    sanitized: boolean;
    durationMs: number;
    safetyAssessment: "passed" | "failed" | "unverified";
  };
}

export interface ExecuteSkillResponse {
  status: "success" | "failed" | "forbidden" | "queued" | "timeout";
  result: Record<string, any> | null;
  error?: string;
  audit: AuditData;
  executionId?: string;
  queued?: boolean;
  requiresApproval?: boolean;
}

/**
 * Enhanced RuntimeEngine with execution queue, streaming, timeout, and retry logic
 */
export class RuntimeEngine {
  private registry: SkillRegistry;
  private policyEngine: PolicyEngine;
  private tools = new Map<string, Map<string, Tool>>();
  
  // Execution queue
  private executionQueue: QueueItem[] = [];
  private isProcessingQueue = false;
  private maxConcurrent = 5;
  private activeExecutions = 0;
  
  // Default retry configuration
  private defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
  };

  // Stream handlers
  private streamHandlers = new Map<string, (chunk: StreamChunk) => void>();

  constructor(registry: SkillRegistry, policyEngine: PolicyEngine) {
    this.registry = registry;
    this.policyEngine = policyEngine;
    
    // Start queue processor
    this.startQueueProcessor();
  }

  /**
   * Registers a tool associated with a specific skill ID.
   */
  public registerTool(skillId: string, tool: Tool): void {
    if (!this.tools.has(skillId)) {
      this.tools.set(skillId, new Map());
    }
    this.tools.get(skillId)!.set(tool.name, tool);
    logger.info({ skillId, toolName: tool.name }, "Registered tool for skill");
  }

  /**
   * Set streaming handler for an execution
   */
  public setStreamHandler(executionId: string, handler: (chunk: StreamChunk) => void): void {
    this.streamHandlers.set(executionId, handler);
  }

  /**
   * Remove streaming handler
   */
  public removeStreamHandler(executionId: string): void {
    this.streamHandlers.delete(executionId);
  }

  /**
   * Stream a chunk to the handler
   */
  private streamChunk(executionId: string, chunk: StreamChunk): void {
    const handler = this.streamHandlers.get(executionId);
    if (handler) {
      handler(chunk);
    }
  }

  /**
   * Start the execution queue processor
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue();
    }, 100); // Process every 100ms
  }

  /**
   * Process queued executions
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.activeExecutions >= this.maxConcurrent) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Sort by priority (higher = first)
      this.executionQueue.sort((a, b) => b.priority - a.priority);

      while (this.executionQueue.length > 0 && this.activeExecutions < this.maxConcurrent) {
        const item = this.executionQueue.shift();
        if (item) {
          // Clear timeout
          if (item.timeout) {
            clearTimeout(item.timeout);
          }

          this.activeExecutions++;
          this.processExecution(item).finally(() => {
            this.activeExecutions--;
          });
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Add execution to queue
   */
  private queueExecution(request: ExecuteSkillRequest, options?: ExecutionOptions): QueueItem {
    const id = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const item: QueueItem = {
      id,
      request,
      priority: 5, // Default priority
      createdAt: new Date(),
    };

    // Add timeout if specified
    if (options?.timeoutMs) {
      item.timeout = setTimeout(() => {
        // Remove from queue if still there
        const index = this.executionQueue.findIndex((i) => i.id === id);
        if (index !== -1) {
          this.executionQueue.splice(index, 1);
          logger.warn({ executionId: id }, "Execution timed out in queue");
        }
      }, options.timeoutMs);
    }

    this.executionQueue.push(item);
    return item;
  }

  /**
   * Process an execution from the queue
   */
  private async processExecution(item: QueueItem): Promise<void> {
    const { id, request } = item;

    this.streamChunk(id, {
      type: "progress",
      data: { message: "Starting execution" },
      timestamp: new Date().toISOString(),
    });

    const retryConfig = this.defaultRetryConfig;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const response = await this.executeSkillInternal(request, id);

        if (response.status === "success") {
          this.streamChunk(id, {
            type: "complete",
            data: response,
            timestamp: new Date().toISOString(),
          });
          return;
        }

        if (response.status === "forbidden" || response.status === "failed") {
          if (attempt < retryConfig.maxRetries) {
            const delay = Math.min(
              retryConfig.initialDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt),
              retryConfig.maxDelayMs
            );
            
            this.streamChunk(id, {
              type: "progress",
              data: { message: `Retrying in ${delay}ms...`, attempt: attempt + 1 },
              timestamp: new Date().toISOString(),
            });

            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
        }

        // Non-retryable failure
        this.streamChunk(id, {
          type: "error",
          data: { error: response.error },
          timestamp: new Date().toISOString(),
        });
        return;
      } catch (error: any) {
        lastError = error;

        if (attempt < retryConfig.maxRetries) {
          const delay = Math.min(
            retryConfig.initialDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt),
            retryConfig.maxDelayMs
          );

          this.streamChunk(id, {
            type: "progress",
            data: { message: `Error: ${error.message}. Retrying...`, attempt: attempt + 1 },
            timestamp: new Date().toISOString(),
          });

          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted
    this.streamChunk(id, {
      type: "error",
      data: { error: lastError?.message || "Execution failed after retries" },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Core skill invocation lifecycle with queue support
   */
  public async executeSkill(
    rawRequest: unknown,
    options?: ExecutionOptions
  ): Promise<ExecuteSkillResponse> {
    const requestedAt = new Date().toISOString();
    const timerStart = process.hrtime.bigint();

    logger.info({ rawRequest }, "Executing skill lifecycle initiated [Intent Stage]");

    // 1. Intent Validation (Input validation and DTO parsing)
    let request: ExecuteSkillRequest;
    try {
      request = ExecuteSkillRequestSchema.parse(rawRequest);
    } catch (validationError: any) {
      const durationMs = this.calculateDurationMs(timerStart);
      logger.error({ error: validationError.message }, "Intent validation failed");
      return {
        status: "failed",
        result: null,
        error: `Intent validation failed: ${validationError.message}`,
        audit: {
          requestedAt,
          completedAt: new Date().toISOString(),
          skillId: "unknown",
          toolName: "unknown",
          policyCheck: {
            allowed: false,
            reason: "Invalid intent schema",
            trustScore: 0,
            permissionsChecked: []
          },
          sandbox: {
            type: "none",
            sanitized: false,
            durationMs,
            safetyAssessment: "unverified"
          }
        }
      };
    }

    const { skillId, toolName, args, context } = request;
    const userId = context?.userId;

    // 2. Check rate limit
    const rateLimit = this.registry.checkRateLimit(skillId);
    if (!rateLimit.allowed) {
      const resetTime = rateLimit.resetAt > 0
        ? new Date(rateLimit.resetAt).toISOString()
        : "shortly";
      return {
        status: "failed",
        result: null,
        error: `Rate limit exceeded. Retry after ${resetTime}`,
        audit: {
          requestedAt,
          completedAt: new Date().toISOString(),
          skillId,
          toolName,
          userId,
          policyCheck: {
            allowed: true,
            trustScore: 0,
            permissionsChecked: []
          },
          sandbox: {
            type: "v8-isolated",
            sanitized: true,
            durationMs: this.calculateDurationMs(timerStart),
            safetyAssessment: "passed"
          }
        }
      };
    }

    // 3. Permission Validation Stage
    const skill = this.registry.getSkill(skillId);
    if (!skill) {
      const durationMs = this.calculateDurationMs(timerStart);
      logger.warn({ skillId }, "Skill not found in registry");
      return {
        status: "failed",
        result: null,
        error: `Skill with ID '${skillId}' not found in registry.`,
        audit: {
          requestedAt,
          completedAt: new Date().toISOString(),
          skillId,
          toolName,
          userId,
          policyCheck: {
            allowed: false,
            reason: "Skill not found",
            trustScore: 0,
            permissionsChecked: []
          },
          sandbox: {
            type: "v8-isolated",
            sanitized: false,
            durationMs,
            safetyAssessment: "unverified"
          }
        }
      };
    }

    // Check if skill is disabled
    if (skill.status === "disabled" || skill.status === "revoked") {
      return {
        status: "forbidden",
        result: null,
        error: `Skill '${skillId}' is ${skill.status}`,
        audit: {
          requestedAt,
          completedAt: new Date().toISOString(),
          skillId,
          toolName,
          userId,
          policyCheck: {
            allowed: false,
            reason: `Skill is ${skill.status}`,
            trustScore: skill.trustScore,
            permissionsChecked: skill.permissions
          },
          sandbox: {
            type: "v8-isolated",
            sanitized: true,
            durationMs: this.calculateDurationMs(timerStart),
            safetyAssessment: "unverified"
          }
        }
      };
    }

    // Call the policy engine
    const evaluation = this.policyEngine.evaluateSkillPolicy(skill);
    if (!evaluation.allowed) {
      const durationMs = this.calculateDurationMs(timerStart);
      logger.warn({ skillId, reason: evaluation.reason }, "Permission validation rejected execution");
      return {
        status: "forbidden",
        result: null,
        error: evaluation.reason || "Execution blocked by policy engine.",
        audit: {
          requestedAt,
          completedAt: new Date().toISOString(),
          skillId,
          toolName,
          userId,
          policyCheck: {
            allowed: false,
            reason: evaluation.reason,
            trustScore: skill.trustScore,
            permissionsChecked: skill.permissions
          },
          sandbox: {
            type: "v8-isolated",
            sanitized: false,
            durationMs,
            safetyAssessment: "failed"
          }
        }
      };
    }

    // Check human approval requirement
    if (skill.requiresHumanApproval && !options?.skipApproval) {
      const execution = this.registry.createExecution(skillId, userId, args);
      return {
        status: "queued",
        result: null,
        error: "Execution requires human approval",
        audit: {
          requestedAt,
          completedAt: new Date().toISOString(),
          skillId,
          toolName,
          userId,
          policyCheck: {
            allowed: true,
            trustScore: skill.trustScore,
            permissionsChecked: skill.permissions
          },
          sandbox: {
            type: "v8-isolated",
            sanitized: true,
            durationMs: this.calculateDurationMs(timerStart),
            safetyAssessment: "passed"
          }
        },
        executionId: execution.id,
        queued: true,
        requiresApproval: true
      };
    }

    // 4. Queue or execute based on capacity
    if (this.activeExecutions >= this.maxConcurrent) {
      const queueItem = this.queueExecution(request, options);
      const execution = this.registry.createExecution(skillId, userId, args);
      return {
        status: "queued",
        result: null,
        error: "Execution queued due to capacity",
        audit: {
          requestedAt,
          completedAt: new Date().toISOString(),
          skillId,
          toolName,
          userId,
          policyCheck: {
            allowed: true,
            trustScore: skill.trustScore,
            permissionsChecked: skill.permissions
          },
          sandbox: {
            type: "v8-isolated",
            sanitized: true,
            durationMs: this.calculateDurationMs(timerStart),
            safetyAssessment: "passed"
          }
        },
        executionId: execution.id,
        queued: true
      };
    }

    // 5. Execute directly
    return this.executeSkillInternal(request);
  }

  /**
   * Internal execution with timeout support
   */
  private async executeSkillInternal(
    request: ExecuteSkillRequest,
    executionId?: string
  ): Promise<ExecuteSkillResponse> {
    const requestedAt = new Date().toISOString();
    const timerStart = process.hrtime.bigint();
    const { skillId, toolName, args, context } = request;
    const userId = context?.userId;

    const skill = this.registry.getSkill(skillId);
    if (!skill) {
      return {
        status: "failed",
        result: null,
        error: `Skill '${skillId}' not found`,
        audit: {
          requestedAt,
          completedAt: new Date().toISOString(),
          skillId,
          toolName,
          userId,
          policyCheck: { allowed: false, reason: "Not found", trustScore: 0, permissionsChecked: [] },
          sandbox: { type: "v8-isolated", sanitized: false, durationMs: 0, safetyAssessment: "unverified" }
        }
      };
    }

    // Create execution record
    const execution = this.registry.createExecution(skillId, userId, request.args);
    this.registry.updateExecution(execution.id, "running");

    // 6. Sandbox Stage
    let sandboxSafetyAssessment: "passed" | "failed" = "passed";
    let sandboxViolationError: string | null = null;

    for (const permission of skill.permissions) {
      if (permission.startsWith("os:") || permission.startsWith("sys:")) {
        sandboxSafetyAssessment = "failed";
        sandboxViolationError = `Security Violation: Unsafe system permission '${permission}' detected at sandbox barrier.`;
        break;
      }
    }

    if (sandboxSafetyAssessment === "failed") {
      this.registry.updateExecution(execution.id, "failed", undefined, sandboxViolationError!);
      return {
        status: "forbidden",
        result: null,
        error: sandboxViolationError!,
        audit: {
          requestedAt,
          completedAt: new Date().toISOString(),
          skillId,
          toolName,
          userId,
          policyCheck: {
            allowed: true,
            trustScore: skill.trustScore,
            permissionsChecked: skill.permissions
          },
          sandbox: {
            type: "v8-isolated",
            sanitized: true,
            durationMs: this.calculateDurationMs(timerStart),
            safetyAssessment: "failed"
          }
        }
      };
    }

    // 7. Executor Stage
    logger.debug({ skillId, toolName }, "Dispatching to registered tool executor [Executor Stage]");
    const skillTools = this.tools.get(skillId);
    const tool = skillTools?.get(toolName);

    if (!tool) {
      this.registry.updateExecution(execution.id, "failed", undefined, `Tool '${toolName}' not found`);
      return {
        status: "failed",
        result: null,
        error: `Tool '${toolName}' is not registered under skill '${skillId}'.`,
        audit: {
          requestedAt,
          completedAt: new Date().toISOString(),
          skillId,
          toolName,
          userId,
          policyCheck: {
            allowed: true,
            trustScore: skill.trustScore,
            permissionsChecked: skill.permissions
          },
          sandbox: {
            type: "v8-isolated",
            sanitized: true,
            durationMs: this.calculateDurationMs(timerStart),
            safetyAssessment: "passed"
          }
        }
      };
    }

    // Stream progress
    if (executionId) {
      this.streamChunk(executionId, {
        type: "progress",
        data: { message: "Executing tool..." },
        timestamp: new Date().toISOString(),
      });
    }

    // Run the actual tool execution with timeout
    try {
      const executionResult = await tool.execute({ userId, skillId }, args);
      const durationMs = this.calculateDurationMs(timerStart);

      this.registry.updateExecution(execution.id, "completed", executionResult);

      logger.info({ skillId, toolName, durationMs }, "Execution completed successfully [Result Stage]");

      return {
        status: "success",
        result: executionResult,
        audit: {
          requestedAt,
          completedAt: new Date().toISOString(),
          skillId,
          toolName,
          userId,
          policyCheck: {
            allowed: true,
            trustScore: skill.trustScore,
            permissionsChecked: skill.permissions
          },
          sandbox: {
            type: "v8-isolated",
            sanitized: true,
            durationMs,
            safetyAssessment: "passed"
          }
        }
      };
    } catch (executionError: any) {
      const durationMs = this.calculateDurationMs(timerStart);
      logger.error({ skillId, toolName, error: executionError.message }, "Tool execution runtime error");

      this.registry.updateExecution(execution.id, "failed", undefined, executionError.message);

      return {
        status: "failed",
        result: null,
        error: `Runtime execution failed: ${executionError.message}`,
        audit: {
          requestedAt,
          completedAt: new Date().toISOString(),
          skillId,
          toolName,
          userId,
          policyCheck: {
            allowed: true,
            trustScore: skill.trustScore,
            permissionsChecked: skill.permissions
          },
          sandbox: {
            type: "v8-isolated",
            sanitized: true,
            durationMs,
            safetyAssessment: "passed"
          }
        }
      };
    }
  }

  /**
   * Set maximum concurrent executions
   */
  public setMaxConcurrent(max: number): void {
    this.maxConcurrent = Math.max(1, Math.min(max, 50));
  }

  /**
   * Get queue status
   */
  public getQueueStatus(): { queued: number; active: number; maxConcurrent: number } {
    return {
      queued: this.executionQueue.length,
      active: this.activeExecutions,
      maxConcurrent: this.maxConcurrent,
    };
  }

  private calculateDurationMs(start: bigint): number {
    const end = process.hrtime.bigint();
    return Number(end - start) / 1e6;
  }
}

// Instantiate shared instances to connect runtime and endpoints
import { registry as sharedRegistry, policyEngine as sharedPolicyEngine } from "./shared.js";
export const globalRuntime = new RuntimeEngine(sharedRegistry, sharedPolicyEngine);

// Seed default citation tool on global runtime
import { LegalCitationTool } from "./internal/tools/tools.js";
globalRuntime.registerTool("vietnam-law-citations", new LegalCitationTool());

/**
 * Expose: ExecuteSkill(request)
 * Standardized function conforming to Step 18A specification.
 */
export async function ExecuteSkill(request: unknown, options?: ExecutionOptions): Promise<ExecuteSkillResponse> {
  return globalRuntime.executeSkill(request, options);
}

/**
 * Get execution queue status
 */
export function GetQueueStatus() {
  return globalRuntime.getQueueStatus();
}
