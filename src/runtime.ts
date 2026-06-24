import { z } from "zod";
import { SkillRegistry, Skill } from "./registry.js";
import { PolicyEngine } from "./policy.js";
import { Tool } from "./internal/skills.interface.js";
import { pino } from "pino";
import { SkillSandbox, globalSandbox, DEFAULT_SANDBOX_CONFIG } from "./sandbox/executor.js";

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
  status: "success" | "failed" | "forbidden";
  result: Record<string, any> | null;
  error?: string;
  audit: AuditData;
}

export class RuntimeEngine {
  private registry: SkillRegistry;
  private policyEngine: PolicyEngine;
  private tools = new Map<string, Map<string, Tool>>();
  private sandbox: SkillSandbox;
  private useSandbox: boolean;

  constructor(registry: SkillRegistry, policyEngine: PolicyEngine, useSandbox: boolean = true) {
    this.registry = registry;
    this.policyEngine = policyEngine;
    this.useSandbox = useSandbox;
    this.sandbox = globalSandbox;
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
   * Implements the core skill invocation lifecycle:
   * Intent -> Permission validation -> Sandbox -> Executor -> Result
   */
  public async executeSkill(rawRequest: unknown): Promise<ExecuteSkillResponse> {
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

    // 2. Permission Validation Stage
    const skill = this.registry.getSkill(skillId);
    if (!skill) {
      const durationMs = this.calculateDurationMs(timerStart);
      logger.warn({ skillId }, "Skill not found in registry");
      return {
        status: "failed",
        result: null,
        error: `Skill with ID \x27${skillId}\x27 not found in registry.`,
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

    // 3. Sandbox Stage (Assessment of execution safety bounds & setup)
    logger.debug({ skillId }, "Preparing sandbox execution context [Sandbox Stage]");
    let sandboxSafetyAssessment: "passed" | "failed" = "passed";
    let sandboxViolationError: string | null = null;

    // Additional hard security boundaries inside sandbox layer:
    for (const permission of skill.permissions) {
      if (permission.startsWith("os:") || permission.startsWith("sys:")) {
        sandboxSafetyAssessment = "failed";
        sandboxViolationError = `Security Violation: Unsafe system permission \x27${permission}\x27 detected at sandbox barrier.`;
        break;
      }
    }

    if (sandboxSafetyAssessment === "failed") {
      const durationMs = this.calculateDurationMs(timerStart);
      logger.error({ skillId, error: sandboxViolationError }, "Sandbox boundary validation failed");
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
            durationMs,
            safetyAssessment: "failed"
          }
        }
      };
    }

    // 4. Executor Stage (Resolving the tool and executing it)
    logger.debug({ skillId, toolName }, "Dispatching to registered tool executor [Executor Stage]");
    const skillTools = this.tools.get(skillId);
    const tool = skillTools?.get(toolName);

    if (!tool) {
      const durationMs = this.calculateDurationMs(timerStart);
      const errorMsg = `Tool \x27${toolName}\x27 is not registered under skill \x27${skillId}\x27.`;
      logger.error({ skillId, toolName }, errorMsg);
      return {
        status: "failed",
        result: null,
        error: errorMsg,
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

    // Run the actual tool execution
    try {
      let executionResult: Record<string, any>;

      if (this.useSandbox) {
        // Execute tool within sandboxed environment
        const sandboxResult = await this.sandbox.execute(
          {
            skillId,
            toolName,
            args,
            userId,
          },
          async (_ctx: any, _args: any) => {
            return await tool.execute({ userId, skillId }, _args);
          }
        );

        if (!sandboxResult.success) {
          throw new Error(sandboxResult.error || "Sandboxed execution failed");
        }

        if (sandboxResult.sandboxViolations.length > 0) {
          logger.warn({ skillId, violations: sandboxResult.sandboxViolations }, "Sandbox violations during execution");
        }

        executionResult = sandboxResult.output;
      } else {
        // Direct execution without sandbox (for trusted internal tools)
        executionResult = await tool.execute({ userId, skillId }, args);
      }

      const durationMs = this.calculateDurationMs(timerStart);

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
            type: this.useSandbox ? "v8-isolated" : "none",
            sanitized: this.useSandbox,
            durationMs,
            safetyAssessment: "passed"
          }
        }
      };
    } catch (executionError: any) {
      const durationMs = this.calculateDurationMs(timerStart);
      logger.error({ skillId, toolName, error: executionError.message }, "Tool execution runtime error");
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
            type: this.useSandbox ? "v8-isolated" : "none",
            sanitized: this.useSandbox,
            durationMs,
            safetyAssessment: "passed"
          }
        }
      };
    }
  }

  private calculateDurationMs(start: bigint): number {
    const end = process.hrtime.bigint();
    return Number(end - start) / 1e6; // Convert nanoseconds to milliseconds
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
export async function ExecuteSkill(request: unknown): Promise<ExecuteSkillResponse> {
  return globalRuntime.executeSkill(request);
}
