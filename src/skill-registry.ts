import { SkillRegistry, Skill, ExecutionRecord, SkillAnalytics, SkillCategory } from "./registry.js";
import { RuntimeEngine, ExecuteSkill, GetQueueStatus, ExecutionOptions } from "./runtime.js";
import { Tool } from "./internal/skills.interface.js";
import { pino } from "pino";
import { z } from "zod";

const logger = pino();

/**
 * Skill lifecycle state
 */
export type SkillLifecycleState = "loading" | "loaded" | "initializing" | "initialized" | "error";

/**
 * Skill health status
 */
export interface SkillHealth {
  skillId: string;
  status: "healthy" | "degraded" | "unhealthy";
  lastCheck: string;
  errors: string[];
  responseTimeMs?: number;
}

/**
 * Skill registration event
 */
export interface SkillRegistrationEvent {
  skillId: string;
  name: string;
  category: SkillCategory;
  action: "registered" | "updated" | "removed" | "enabled" | "disabled";
  timestamp: string;
  details?: Record<string, any>;
}

/**
 * Event handler type
 */
export type SkillEventHandler = (event: SkillRegistrationEvent) => void | Promise<void>;

/**
 * Central SkillRegistry - Manages skill lifecycle, MCP integration, and event handling
 */
export class CentralSkillRegistry {
  private registry: SkillRegistry;
  private runtime: RuntimeEngine;
  private tools = new Map<string, Tool>();
  private lifecycleState = new Map<string, SkillLifecycleState>();
  private healthChecks = new Map<string, SkillHealth>();
  private eventHandlers: SkillEventHandler[] = [];
  private initialized = false;

  constructor() {
    this.registry = new SkillRegistry();
    this.runtime = new RuntimeEngine(this.registry, {} as any); // Policy engine handled internally
  }

  /**
   * Initialize the central registry with all built-in skills
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn("CentralSkillRegistry already initialized");
      return;
    }

    logger.info("Initializing CentralSkillRegistry...");

    try {
      // Load data skills
      await this.loadDataSkills();
      
      // Load legal skills
      await this.loadLegalSkills();
      
      // Load code skills
      await this.loadCodeSkills();

      this.initialized = true;
      logger.info("CentralSkillRegistry initialized successfully");
    } catch (error: any) {
      logger.error({ error: error.message }, "Failed to initialize CentralSkillRegistry");
      throw error;
    }
  }

  /**
   * Load data skills
   */
  private async loadDataSkills(): Promise<void> {
    this.lifecycleState.set("data-skills", "initializing");

    try {
      // Import and register data skills
      const { DatabaseQuerySkill, DataTransformSkill, ApiFetchSkill, DataValidationSkill, AnalyticsQuerySkill } = 
        await import("./skills/data/index.js");

      const dataSkills: Tool[] = [
        new DatabaseQuerySkill(),
        new DataTransformSkill(),
        new ApiFetchSkill(),
        new DataValidationSkill(),
        new AnalyticsQuerySkill(),
      ];

      for (const skill of dataSkills) {
        await this.registerSkillTool("data", skill);
      }

      this.lifecycleState.set("data-skills", "loaded");
      logger.info({ count: dataSkills.length }, "Loaded data skills");
    } catch (error: any) {
      this.lifecycleState.set("data-skills", "error");
      logger.error({ error: error.message }, "Failed to load data skills");
    }
  }

  /**
   * Load legal skills
   */
  private async loadLegalSkills(): Promise<void> {
    this.lifecycleState.set("legal-skills", "initializing");

    try {
      const { LegalCitationSkill, LegalSearchSkill, ContractAnalyzerSkill, RegulationLookupSkill, ComplianceCheckSkill } = 
        await import("./skills/legal/index.js");

      const legalSkills: Tool[] = [
        new LegalCitationSkill(),
        new LegalSearchSkill(),
        new ContractAnalyzerSkill(),
        new RegulationLookupSkill(),
        new ComplianceCheckSkill(),
      ];

      for (const skill of legalSkills) {
        await this.registerSkillTool("legal", skill);
      }

      this.lifecycleState.set("legal-skills", "loaded");
      logger.info({ count: legalSkills.length }, "Loaded legal skills");
    } catch (error: any) {
      this.lifecycleState.set("legal-skills", "error");
      logger.error({ error: error.message }, "Failed to load legal skills");
    }
  }

  /**
   * Load code skills
   */
  private async loadCodeSkills(): Promise<void> {
    this.lifecycleState.set("code-skills", "initializing");

    try {
      const { CodeGeneratorSkill, CodeReviewSkill, CodeExplainerSkill, TestGeneratorSkill, RefactorSuggesterSkill } = 
        await import("./skills/code/index.js");

      const codeSkills: Tool[] = [
        new CodeGeneratorSkill(),
        new CodeReviewSkill(),
        new CodeExplainerSkill(),
        new TestGeneratorSkill(),
        new RefactorSuggesterSkill(),
      ];

      for (const skill of codeSkills) {
        await this.registerSkillTool("code", skill);
      }

      this.lifecycleState.set("code-skills", "loaded");
      logger.info({ count: codeSkills.length }, "Loaded code skills");
    } catch (error: any) {
      this.lifecycleState.set("code-skills", "error");
      logger.error({ error: error.message }, "Failed to load code skills");
    }
  }

  /**
   * Register a skill tool with the registry and runtime
   */
  public async registerSkillTool(category: SkillCategory, tool: Tool): Promise<void> {
    const skillId = tool.name.replace(/\s+skill$/i, "").replace(/\s+/g, "-").toLowerCase();
    
    // Register with registry
    const metadata = (tool as any).getMetadata?.() || {
      id: skillId,
      name: tool.name,
      description: tool.description,
      category,
      version: "1.0.0",
      author: "NexusAI",
      permissions: [],
      requiredCapabilities: [],
      estimatedDuration: "5-30s",
      trustScore: 80,
      requiresHumanApproval: false,
      rateLimitPerMinute: 30,
    };

    this.registry.registerSkill(metadata);
    
    // Register tool with runtime
    this.runtime.registerTool(skillId, tool);
    this.tools.set(skillId, tool);

    // Emit registration event
    this.emitEvent({
      skillId,
      name: tool.name,
      category,
      action: "registered",
      timestamp: new Date().toISOString(),
      details: { toolName: tool.name },
    });

    this.lifecycleState.set(skillId, "loaded");
    logger.info({ skillId, toolName: tool.name }, "Registered skill tool");
  }

  /**
   * Get skill by ID
   */
  public getSkill(id: string): Skill | null {
    return this.registry.getSkill(id);
  }

  /**
   * List all skills with optional filtering
   */
  public listSkills(category?: SkillCategory): Skill[] {
    return this.registry.listSkills(category);
  }

  /**
   * List skills by category
   */
  public listSkillsByCategory(): Record<SkillCategory, Skill[]> {
    return this.registry.listSkillsByCategory();
  }

  /**
   * Execute a skill
   */
  public async executeSkill(
    skillId: string,
    toolName: string,
    args: Record<string, any>,
    options?: ExecutionOptions
  ): Promise<any> {
    const result = await ExecuteSkill({ skillId, toolName, args }, options);
    return result;
  }

  /**
   * Get execution history
   */
  public getExecutionHistory(options?: {
    skillId?: string;
    state?: "queued" | "running" | "completed" | "failed" | "cancelled";
    limit?: number;
    offset?: number;
  }): ExecutionRecord[] {
    return this.registry.listExecutions(options);
  }

  /**
   * Get execution by ID
   */
  public getExecution(executionId: string): ExecutionRecord | null {
    return this.registry.getExecution(executionId);
  }

  /**
   * Approve execution
   */
  public approveExecution(executionId: string, approvedBy: string, reason?: string): boolean {
    return this.registry.approveExecution(executionId, approvedBy, reason);
  }

  /**
   * Reject execution
   */
  public rejectExecution(executionId: string, rejectedBy: string, reason: string): boolean {
    return this.registry.rejectExecution(executionId, rejectedBy, reason);
  }

  /**
   * Get pending approvals
   */
  public getPendingApprovals(): ExecutionRecord[] {
    return this.registry.getApprovalQueue();
  }

  /**
   * Get analytics for all skills
   */
  public getAnalytics(skillId?: string): SkillAnalytics | SkillAnalytics[] {
    return this.registry.getAnalytics(skillId);
  }

  /**
   * Get execution statistics
   */
  public getExecutionStats() {
    return this.registry.getExecutionStats();
  }

  /**
   * Update skill configuration
   */
  public updateSkillConfig(skillId: string, config: {
    enabled?: boolean;
    rateLimitPerMinute?: number;
    requiresHumanApproval?: boolean;
  }): boolean {
    return this.registry.updateSkillConfig(skillId, config);
  }

  /**
   * Get skill health status
   */
  public async checkHealth(skillId?: string): Promise<SkillHealth | SkillHealth[]> {
    if (skillId) {
      return this.performHealthCheck(skillId);
    }

    const allSkills = this.registry.listSkills();
    const healthChecks: SkillHealth[] = [];

    for (const skill of allSkills) {
      healthChecks.push(await this.performHealthCheck(skill.id));
    }

    return healthChecks;
  }

  /**
   * Perform health check for a skill
   */
  private async performHealthCheck(skillId: string): Promise<SkillHealth> {
    const start = Date.now();
    const health: SkillHealth = {
      skillId,
      status: "healthy",
      lastCheck: new Date().toISOString(),
      errors: [],
    };

    try {
      const skill = this.registry.getSkill(skillId);
      if (!skill) {
        health.status = "unhealthy";
        health.errors.push("Skill not found");
        return health;
      }

      // Check if skill is enabled
      if (skill.status === "disabled" || skill.status === "revoked") {
        health.status = "degraded";
        health.errors.push(`Skill is ${skill.status}`);
      }

      // Check tool registration
      const tool = this.tools.get(skillId);
      if (!tool) {
        health.status = "unhealthy";
        health.errors.push("Tool not registered");
      }

      // Check recent executions for errors
      const recentExecutions = this.registry.listExecutions({ skillId, limit: 10 });
      const recentErrors = recentExecutions.filter(e => e.state === "failed").length;
      
      if (recentErrors > recentExecutions.length * 0.5) {
        health.status = "degraded";
        health.errors.push("High error rate in recent executions");
      }

      health.responseTimeMs = Date.now() - start;
    } catch (error: any) {
      health.status = "unhealthy";
      health.errors.push(error.message);
    }

    return health;
  }

  /**
   * Get lifecycle state
   */
  public getLifecycleState(category?: string): SkillLifecycleState | Map<string, SkillLifecycleState> {
    if (category) {
      return this.lifecycleState.get(category) || "loading";
    }
    return this.lifecycleState;
  }

  /**
   * Subscribe to skill events
   */
  public onEvent(handler: SkillEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Emit skill event
   */
  private emitEvent(event: SkillRegistrationEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error: any) {
        logger.error({ error: error.message, event }, "Error in event handler");
      }
    }
  }

  /**
   * Get queue status
   */
  public getQueueStatus() {
    return GetQueueStatus();
  }

  /**
   * Get MCP-compatible tool definitions
   */
  public getMCPTools(): Array<{
    name: string;
    description: string;
    inputSchema: Record<string, any>;
  }> {
    const tools: Array<{
      name: string;
      description: string;
      inputSchema: Record<string, any>;
    }> = [];

    for (const tool of this.tools.values()) {
      tools.push({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      });
    }

    return tools;
  }

  /**
   * Validate skill input against schema
   */
  public validateInput(skillId: string, input: unknown): { valid: boolean; errors?: string[] } {
    const skill = this.registry.getSkill(skillId);
    if (!skill) {
      return { valid: false, errors: ["Skill not found"] };
    }

    const tool = this.tools.get(skillId);
    if (!tool || !tool.inputSchema) {
      return { valid: true }; // No schema to validate against
    }

    try {
      const schema = z.object(tool.inputSchema);
      schema.parse(input);
      return { valid: true };
    } catch (error: any) {
      return { valid: false, errors: error.errors?.map((e: any) => e.message) || [error.message] };
    }
  }
}

// Singleton instance
let centralRegistryInstance: CentralSkillRegistry | null = null;

/**
 * Get or create the central skill registry singleton
 */
export function getCentralSkillRegistry(): CentralSkillRegistry {
  if (!centralRegistryInstance) {
    centralRegistryInstance = new CentralSkillRegistry();
  }
  return centralRegistryInstance;
}

/**
 * Initialize the central skill registry
 */
export async function initializeSkillRegistry(): Promise<CentralSkillRegistry> {
  const registry = getCentralSkillRegistry();
  await registry.initialize();
  return registry;
}
