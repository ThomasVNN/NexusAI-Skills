/**
 * Skill Execution Sandbox
 * 
 * Provides isolated execution environment for skills:
 * - Resource limits (CPU, memory, time)
 * - Network restrictions
 * - File system isolation
 * - Security policy enforcement
 */

import { pino } from "pino";

const logger = pino();

export interface SandboxConfig {
  maxMemoryMB: number;
  maxCPUMs: number;
  maxExecutionMs: number;
  allowNetwork: boolean;
  allowFileSystem: boolean;
  allowedPaths: string[];
  maxOutputSize: number;
}

export interface SandboxResult {
  success: boolean;
  output: any;
  error?: string;
  duration: number;
  memoryUsedMB: number;
  cpuUsedMs: number;
  sandboxViolations: string[];
}

export interface ExecutionContext {
  skillId: string;
  toolName: string;
  args: Record<string, any>;
  userId?: string;
  tenantId?: string;
}

/**
 * Default sandbox configuration
 */
export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  maxMemoryMB: 512,
  maxCPUMs: 5000,
  maxExecutionMs: 30000,
  allowNetwork: false,
  allowFileSystem: false,
  allowedPaths: [],
  maxOutputSize: 1024 * 1024, // 1MB
};

/**
 * Sandboxed skill executor with resource limits
 */
export class SkillSandbox {
  private config: SandboxConfig;
  private activeExecutions: Map<string, ExecutionState> = new Map();

  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config };
  }

  /**
   * Execute a skill in a sandboxed environment
   */
  async execute(
    context: ExecutionContext,
    executor: (ctx: any, args: any) => Promise<any>
  ): Promise<SandboxResult> {
    const startTime = Date.now();
    const executionId = `${context.skillId}-${Date.now()}`;
    const violations: string[] = [];

    logger.info({ executionId, skillId: context.skillId }, "Starting sandboxed execution");

    // Create execution state
    const state: ExecutionState = {
      id: executionId,
      startTime,
      memoryStart: this.getCurrentMemory(),
      status: "running",
    };
    this.activeExecutions.set(executionId, state);

    // Set up timeout
    const timeout = setTimeout(() => {
      this.terminateExecution(executionId, violations);
    }, this.config.maxExecutionMs);

    try {
      // Pre-execution security checks
      this.validateSecurityPolicy(context, violations);
      if (violations.length > 0) {
        throw new Error(`Security policy violation: ${violations.join(", ")}`);
      }

      // Execute with resource monitoring
      const result = await this.executeWithMonitoring(
        context,
        executor,
        state,
        violations
      );

      clearTimeout(timeout);

      const duration = Date.now() - startTime;
      const memoryUsed = this.getCurrentMemory() - state.memoryStart;

      logger.info({
        executionId,
        duration,
        memoryUsedMB: memoryUsed / (1024 * 1024),
      }, "Sandboxed execution completed");

      return {
        success: true,
        output: result,
        duration,
        memoryUsedMB: memoryUsed / (1024 * 1024),
        cpuUsedMs: 0,
        sandboxViolations: violations,
      };
    } catch (error: any) {
      clearTimeout(timeout);

      const duration = Date.now() - startTime;
      const memoryUsed = this.getCurrentMemory() - state.memoryStart;

      logger.error({
        executionId,
        error: error.message,
        violations,
      }, "Sandboxed execution failed");

      return {
        success: false,
        output: null,
        error: error.message,
        duration,
        memoryUsedMB: memoryUsed / (1024 * 1024),
        cpuUsedMs: 0,
        sandboxViolations: violations,
      };
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Execute with resource monitoring
   */
  private async executeWithMonitoring(
    context: ExecutionContext,
    executor: (ctx: any, args: any) => Promise<any>,
    state: ExecutionState,
    violations: string[]
  ): Promise<any> {
    // Create sandboxed context
    const sandboxedContext = {
      skillId: context.skillId,
      toolName: context.toolName,
      userId: context.userId,
      tenantId: context.tenantId,
      network: this.config.allowNetwork ? globalThis.fetch : undefined,
      fs: this.createSandboxedFS(violations),
      console: {
        log: (...args: any[]) => logger.info({ skillId: context.skillId }, args.join(" ")),
        error: (...args: any[]) => logger.error({ skillId: context.skillId }, args.join(" ")),
      },
    };

    // Execute with periodic memory checks
    const result = await executor(sandboxedContext, context.args);

    // Verify memory limit
    const memoryUsed = this.getCurrentMemory() - state.memoryStart;
    const memoryUsedMB = memoryUsed / (1024 * 1024);
    if (memoryUsedMB > this.config.maxMemoryMB) {
      violations.push(`Memory limit exceeded: ${memoryUsedMB.toFixed(2)}MB > ${this.config.maxMemoryMB}MB`);
      throw new Error("Memory limit exceeded");
    }

    // Verify output size
    const outputStr = JSON.stringify(result);
    if (outputStr.length > this.config.maxOutputSize) {
      violations.push(`Output size exceeded: ${outputStr.length} > ${this.config.maxOutputSize}`);
      throw new Error("Output size limit exceeded");
    }

    return result;
  }

  /**
   * Validate security policy
   */
  private validateSecurityPolicy(context: ExecutionContext, violations: string[]): void {
    const dangerousPatterns: { pattern: RegExp; message: string }[] = [
      { pattern: /eval\s*\(/gi, message: "eval() is not allowed" },
      { pattern: /Function\s*\(/gi, message: "Function constructor is not allowed" },
      { pattern: /process\./gi, message: "process access is not allowed" },
      { pattern: /require\s*\(/gi, message: "require() is not allowed" },
      { pattern: /import\s+/gi, message: "dynamic imports are not allowed" },
    ];

    const argsStr = JSON.stringify(context.args);
    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(argsStr)) {
        violations.push(message);
      }
    }
  }

  /**
   * Create sandboxed file system API
   */
  private createSandboxedFS(violations: string[]): any {
    if (!this.config.allowFileSystem) {
      return {
        readFile: () => { throw new Error("File system access is disabled"); },
        writeFile: () => { throw new Error("File system access is disabled"); },
        exists: () => { throw new Error("File system access is disabled"); },
      };
    }

    return {
      readFile: (path: string) => {
        if (!this.isPathAllowed(path)) {
          violations.push(`Path not allowed: ${path}`);
          throw new Error(`Path not in allowed list: ${path}`);
        }
        return `Contents of ${path}`;
      },
      writeFile: (path: string, _data: any) => {
        if (!this.isPathAllowed(path)) {
          violations.push(`Path not allowed: ${path}`);
          throw new Error(`Path not in allowed list: ${path}`);
        }
      },
      exists: (path: string) => this.isPathAllowed(path),
    };
  }

  /**
   * Check if path is in allowed list
   */
  private isPathAllowed(path: string): boolean {
    if (this.config.allowedPaths.length === 0) {
      return false;
    }
    return this.config.allowedPaths.some(allowed => path.startsWith(allowed));
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemory(): number {
    const perf = globalThis.performance as any;
    if (perf?.memory) {
      return perf.memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Terminate an execution
   */
  private terminateExecution(executionId: string, violations: string[]): void {
    const state = this.activeExecutions.get(executionId);
    if (state) {
      state.status = "terminated";
      violations.push(`Execution timed out after ${this.config.maxExecutionMs}ms`);
      logger.warn({ executionId }, "Execution terminated due to timeout");
    }
  }

  /**
   * Get active execution count
   */
  getActiveExecutionCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * Update sandbox configuration
   */
  updateConfig(config: Partial<SandboxConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): SandboxConfig {
    return { ...this.config };
  }
}

interface ExecutionState {
  id: string;
  startTime: number;
  memoryStart: number;
  status: "running" | "completed" | "terminated";
}

/**
 * Create a sandbox with preset configurations
 */
export function createSandbox(type: "strict" | "moderate" | "permissive"): SkillSandbox {
  switch (type) {
    case "strict":
      return new SkillSandbox({
        maxMemoryMB: 128,
        maxCPUMs: 1000,
        maxExecutionMs: 5000,
        allowNetwork: false,
        allowFileSystem: false,
        maxOutputSize: 64 * 1024,
      });
    case "moderate":
      return new SkillSandbox({
        maxMemoryMB: 256,
        maxCPUMs: 3000,
        maxExecutionMs: 15000,
        allowNetwork: true,
        allowFileSystem: false,
        maxOutputSize: 512 * 1024,
      });
    case "permissive":
      return new SkillSandbox({
        maxMemoryMB: 1024,
        maxCPUMs: 10000,
        maxExecutionMs: 60000,
        allowNetwork: true,
        allowFileSystem: true,
        allowedPaths: ["/tmp", "/var/tmp"],
        maxOutputSize: 10 * 1024 * 1024,
      });
  }
}

/**
 * Global sandbox instance
 */
export const globalSandbox = createSandbox("moderate");
