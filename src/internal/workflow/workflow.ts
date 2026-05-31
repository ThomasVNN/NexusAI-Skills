/**
 * Enhanced Workflow Engine
 * Phase 2 - Item 2.6 Workflow Engine
 * Multi-step skill sequences with state tracking and compensation
 */

import { Tool } from "../skills.interface.js";

/**
 * Workflow step status
 */
export type StepStatus = 
  | "pending" 
  | "running" 
  | "completed" 
  | "failed" 
  | "skipped" 
  | "compensated";

/**
 * Workflow execution status
 */
export type WorkflowStatus = 
  | "pending" 
  | "running" 
  | "completed" 
  | "failed" 
  | "rolled_back";

/**
 * Step dependency definition
 */
export interface StepDependency {
  stepId: string;
  outputPath?: string;
}

/**
 * Conditional expression for branching
 */
export interface StepCondition {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "exists" | "not_exists" | "gt" | "lt";
  value?: unknown;
}

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  id: string;
  name?: string;
  toolName: string;
  inputArguments: Record<string, unknown>;
  dependsOn?: StepDependency[];
  condition?: StepCondition;
  compensation?: {
    toolName: string;
    inputArguments: Record<string, unknown>;
  };
  retry?: {
    maxAttempts: number;
    delayMs: number;
  };
  timeout?: number;
}

/**
 * Result of a single step execution
 */
export interface StepResult {
  stepId: string;
  toolName: string;
  status: StepStatus;
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  attempts: number;
}

/**
 * Workflow execution result
 */
export interface WorkflowResult {
  workflowId: string;
  status: WorkflowStatus;
  steps: StepResult[];
  state: Record<string, unknown>;
  totalDurationMs: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  initialState?: Record<string, unknown>;
  onFailure?: "rollback" | "continue" | "stop";
}

/**
 * Workflow state manager
 */
export class WorkflowState {
  private state: Record<string, unknown> = {};
  private stepOutputs = new Map<string, Record<string, unknown>>();

  constructor(initialState?: Record<string, unknown>) {
    if (initialState) {
      this.state = { ...initialState };
    }
  }

  getState(): Record<string, unknown> {
    return { ...this.state };
  }

  updateState(updates: Record<string, unknown>): void {
    this.state = { ...this.state, ...updates };
  }

  setStepOutput(stepId: string, output: Record<string, unknown>): void {
    this.stepOutputs.set(stepId, output);
  }

  getStepOutput(stepId: string): Record<string, unknown> | undefined {
    return this.stepOutputs.get(stepId);
  }

  getAllOutputs(): Map<string, Record<string, unknown>> {
    return this.stepOutputs;
  }

  getFromPath(path: string): unknown {
    const parts = path.split(".");
    let current: unknown = this.state;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
}

/**
 * Enhanced Workflow Engine with state tracking and compensation
 */
export class WorkflowEngine {
  private tools: Map<string, Tool> = new Map();
  private workflows: Map<string, WorkflowDefinition> = new Map();

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.id, workflow);
  }

  getWorkflow(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id);
  }

  listWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  private resolveArguments(
    args: Record<string, unknown>,
    state: WorkflowState
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(args)) {
      if (typeof value === "string" && value.startsWith("${") && value.endsWith("}")) {
        const path = value.slice(2, -1);
        resolved[key] = state.getFromPath(path);
      } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        resolved[key] = this.resolveArguments(value as Record<string, unknown>, state);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  private evaluateCondition(condition: StepCondition, state: WorkflowState): boolean {
    const fieldValue = state.getFromPath(condition.field);

    switch (condition.operator) {
      case "exists":
        return fieldValue !== undefined;
      case "not_exists":
        return fieldValue === undefined;
      case "equals":
        return fieldValue === condition.value;
      case "not_equals":
        return fieldValue !== condition.value;
      case "contains":
        if (typeof fieldValue === "string" && typeof condition.value === "string") {
          return fieldValue.includes(condition.value);
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(condition.value);
        }
        return false;
      case "gt":
        if (typeof fieldValue === "number" && typeof condition.value === "number") {
          return fieldValue > condition.value;
        }
        return false;
      case "lt":
        if (typeof fieldValue === "number" && typeof condition.value === "number") {
          return fieldValue < condition.value;
        }
        return false;
      default:
        return false;
    }
  }

  private areDependenciesSatisfied(
    step: WorkflowStep,
    completedSteps: Set<string>,
    state: WorkflowState
  ): boolean {
    if (!step.dependsOn || step.dependsOn.length === 0) {
      return true;
    }

    return step.dependsOn.every((dep) => {
      if (!completedSteps.has(dep.stepId)) {
        return false;
      }

      if (dep.outputPath) {
        const stepOutput = state.getStepOutput(dep.stepId);
        if (!stepOutput) return false;
        const parts = dep.outputPath.split(".");
        let current: unknown = stepOutput;
        for (const part of parts) {
          if (current === null || current === undefined) return false;
          if (typeof current === "object") {
            current = (current as Record<string, unknown>)[part];
          }
        }
        return current !== undefined;
      }

      return true;
    });
  }

  private async executeStep(
    step: WorkflowStep,
    context: Record<string, unknown>,
    state: WorkflowState
  ): Promise<StepResult> {
    const tool = this.tools.get(step.toolName);
    if (!tool) {
      return {
        stepId: step.id,
        toolName: step.toolName,
        status: "failed",
        error: `Tool '${step.toolName}' not found`,
        attempts: 0,
      };
    }

    const maxAttempts = step.retry?.maxAttempts ?? 1;
    const delayMs = step.retry?.delayMs ?? 0;
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const timeoutMs = step.timeout ?? 30000;
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Step timed out after ${timeoutMs}ms`)), timeoutMs);
        });

        const resolvedArgs = this.resolveArguments(step.inputArguments, state);
        const execContext = { ...context, workflowState: state.getState() };
        const result = await Promise.race([
          tool.execute(execContext, resolvedArgs),
          timeoutPromise,
        ]);

        const output = result as Record<string, unknown>;
        state.setStepOutput(step.id, output);
        state.updateState(output);

        return {
          stepId: step.id,
          toolName: step.toolName,
          status: "completed",
          output,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          attempts: attempt,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    return {
      stepId: step.id,
      toolName: step.toolName,
      status: "failed",
      error: lastError,
      attempts: maxAttempts,
    };
  }

  private async executeCompensation(
    completedSteps: WorkflowStep[],
    state: WorkflowState
  ): Promise<void> {
    for (const step of [...completedSteps].reverse()) {
      if (step.compensation) {
        const compTool = this.tools.get(step.compensation.toolName);
        if (compTool) {
          try {
            const resolvedArgs = this.resolveArguments(step.compensation.inputArguments, state);
            await compTool.execute({}, resolvedArgs);
          } catch {
            console.error(`Compensation failed for step ${step.id}`);
          }
        }
      }
    }
  }

  async runWorkflow(workflowId: string, context?: Record<string, unknown>): Promise<WorkflowResult> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow '${workflowId}' not found`);
    }
    return this.runWorkflowSteps(workflow, context);
  }

  async runWorkflowSteps(
    workflowOrSteps: WorkflowDefinition | WorkflowStep[],
    context?: Record<string, unknown>
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    const startedAt = new Date().toISOString();
    const workflowId = "id" in workflowOrSteps ? workflowOrSteps.id : "inline-workflow";
    const steps: WorkflowStep[] = "steps" in workflowOrSteps ? workflowOrSteps.steps : workflowOrSteps;
    const onFailure = "onFailure" in workflowOrSteps ? workflowOrSteps.onFailure : "stop";

    const state = new WorkflowState(
      "initialState" in workflowOrSteps ? workflowOrSteps.initialState : undefined
    );
    const stepResults: StepResult[] = [];
    const completedSteps: WorkflowStep[] = [];
    const completedStepIds = new Set<string>();
    const pendingStepIds = new Set(steps.map((s) => s.id));

    let workflowStatus: WorkflowStatus = "running";

    while (pendingStepIds.size > 0) {
      let nextStep: WorkflowStep | undefined;

      for (const step of steps) {
        if (!pendingStepIds.has(step.id)) continue;

        if (step.condition && !this.evaluateCondition(step.condition, state)) {
          stepResults.push({
            stepId: step.id,
            toolName: step.toolName,
            status: "skipped",
            attempts: 0,
          });
          pendingStepIds.delete(step.id);
          continue;
        }

        if (this.areDependenciesSatisfied(step, completedStepIds, state)) {
          nextStep = step;
          break;
        }
      }

      if (!nextStep) {
        workflowStatus = "failed";
        break;
      }

      pendingStepIds.delete(nextStep.id);
      const result = await this.executeStep(nextStep, context ?? {}, state);
      stepResults.push(result);

      if (result.status === "completed") {
        completedStepIds.add(nextStep.id);
        completedSteps.push(nextStep);
      } else {
        if (onFailure === "rollback") {
          await this.executeCompensation(completedSteps, state);
          workflowStatus = "rolled_back";
        } else {
          workflowStatus = "failed";
        }
        break;
      }
    }

    if (workflowStatus === "running") {
      workflowStatus = "completed";
    }

    return {
      workflowId,
      status: workflowStatus,
      steps: stepResults,
      state: state.getState(),
      totalDurationMs: Date.now() - startTime,
      startedAt,
      completedAt: new Date().toISOString(),
      error: workflowStatus === "failed" ? "Workflow execution failed" : undefined,
    };
  }

  validateWorkflow(workflow: WorkflowDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const stepIds = new Set(workflow.steps.map((s) => s.id));

    for (const step of workflow.steps) {
      if (!this.tools.has(step.toolName)) {
        errors.push(`Step '${step.id}': Tool '${step.toolName}' is not registered`);
      }

      if (step.dependsOn) {
        for (const dep of step.dependsOn) {
          if (!stepIds.has(dep.stepId)) {
            errors.push(`Step '${step.id}': Dependency '${dep.stepId}' not found`);
          }
        }
      }

      if (step.compensation && !this.tools.has(step.compensation.toolName)) {
        errors.push(`Step '${step.id}': Compensation tool '${step.compensation.toolName}' not registered`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

export default WorkflowEngine;
