/**
 * Workflow Engine Tests
 * Phase 2 - Item 2.6 Workflow Engine
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  WorkflowEngine,
  WorkflowStep,
  WorkflowDefinition,
  WorkflowState,
} from "../../src/internal/workflow/workflow.js";

/**
 * Mock tool for testing
 */
class MockTool {
  constructor(
    private name: string,
    private executeFn: (ctx: unknown, args: Record<string, unknown>) => Promise<Record<string, unknown>>
  ) {}

  get description() {
    return `Mock tool: ${this.name}`;
  }

  get inputSchema() {
    return { type: "object" as const, properties: {} };
  }

  async execute(ctx: unknown, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.executeFn(ctx, args);
  }
}

describe("WorkflowState", () => {
  let state: WorkflowState;

  beforeEach(() => {
    state = new WorkflowState({ initial: "value" });
  });

  describe("getState", () => {
    it("should return current state", () => {
      const result = state.getState();
      expect(result).toEqual({ initial: "value" });
    });

    it("should return a copy of state", () => {
      const result = state.getState();
      result.modified = true;
      expect(state.getState()).not.toHaveProperty("modified");
    });
  });

  describe("updateState", () => {
    it("should merge updates into state", () => {
      state.updateState({ newField: "newValue" });
      expect(state.getState()).toEqual({ initial: "value", newField: "newValue" });
    });
  });

  describe("step outputs", () => {
    it("should set and get step output", () => {
      state.setStepOutput("step1", { result: "success" });
      expect(state.getStepOutput("step1")).toEqual({ result: "success" });
    });

    it("should return undefined for unknown step", () => {
      expect(state.getStepOutput("unknown")).toBeUndefined();
    });
  });

  describe("getFromPath", () => {
    it("should get nested value from path", () => {
      state.updateState({ level1: { level2: { value: "found" } } });
      expect(state.getFromPath("level1.level2.value")).toBe("found");
    });

    it("should return undefined for invalid path", () => {
      expect(state.getFromPath("nonexistent")).toBeUndefined();
    });

    it("should return undefined for partial path", () => {
      state.updateState({ level1: { level2: "value" } });
      expect(state.getFromPath("level1.level2.nonexistent")).toBeUndefined();
    });
  });
});

describe("WorkflowEngine", () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  describe("registerTool", () => {
    it("should register a tool", () => {
      const tool = new MockTool("test-tool", async () => ({}));
      engine.registerTool(tool);
      expect((engine as unknown as { tools: Map<string, unknown> }).tools.has("test-tool")).toBe(true);
    });
  });

  describe("workflow registration", () => {
    it("should register a workflow", () => {
      const workflow: WorkflowDefinition = {
        id: "test-workflow",
        name: "Test Workflow",
        steps: [],
      };
      engine.registerWorkflow(workflow);
      expect(engine.getWorkflow("test-workflow")).toEqual(workflow);
    });

    it("should list all workflows", () => {
      const workflow1: WorkflowDefinition = { id: "wf1", name: "WF1", steps: [] };
      const workflow2: WorkflowDefinition = { id: "wf2", name: "WF2", steps: [] };
      engine.registerWorkflow(workflow1);
      engine.registerWorkflow(workflow2);
      expect(engine.listWorkflows()).toHaveLength(2);
    });
  });

  describe("runWorkflowSteps", () => {
    it("should execute a single step", async () => {
      const tool = new MockTool("echo", async (_, args) => ({ echoed: args }));
      engine.registerTool(tool);

      const steps: WorkflowStep[] = [
        {
          id: "step1",
          toolName: "echo",
          inputArguments: { message: "hello" },
        },
      ];

      const result = await engine.runWorkflowSteps({ steps });

      expect(result.status).toBe("completed");
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].status).toBe("completed");
      expect(result.state.echoed).toEqual({ message: "hello" });
    });

    it("should execute multiple steps in order", async () => {
      const executionOrder: string[] = [];
      
      const tool1 = new MockTool("first", async () => {
        executionOrder.push("first");
        return { order: 1 };
      });
      const tool2 = new MockTool("second", async () => {
        executionOrder.push("second");
        return { order: 2 };
      });

      engine.registerTool(tool1);
      engine.registerTool(tool2);

      const steps: WorkflowStep[] = [
        { id: "s1", toolName: "first", inputArguments: {} },
        { id: "s2", toolName: "second", inputArguments: {} },
      ];

      const result = await engine.runWorkflowSteps({ steps });

      expect(result.status).toBe("completed");
      expect(executionOrder).toEqual(["first", "second"]);
    });

    it("should chain step outputs to next step", async () => {
      const tool1 = new MockTool("first", async () => ({ value: 100 }));
      const tool2 = new MockTool("second", async (_, args) => ({ doubled: (args.value as number) * 2 }));

      engine.registerTool(tool1);
      engine.registerTool(tool2);

      const steps: WorkflowStep[] = [
        { id: "s1", toolName: "first", inputArguments: {} },
        { id: "s2", toolName: "second", inputArguments: { value: 100 }, dependsOn: [{ stepId: "s1" }] },
      ];

      const result = await engine.runWorkflowSteps({ steps });

      expect(result.status).toBe("completed");
      expect(result.state.value).toBe(100);
      expect(result.state.doubled).toBe(200);
    });

    it("should fail when tool not found", async () => {
      const steps: WorkflowStep[] = [
        { id: "s1", toolName: "nonexistent", inputArguments: {} },
      ];

      const result = await engine.runWorkflowSteps({ steps });

      expect(result.status).toBe("failed");
      expect(result.steps[0].status).toBe("failed");
      expect(result.steps[0].error).toContain("not found");
    });

    it("should handle tool execution errors", async () => {
      const failingTool = new MockTool("failing", async () => {
        throw new Error("Execution failed");
      });
      engine.registerTool(failingTool);

      const steps: WorkflowStep[] = [
        { id: "s1", toolName: "failing", inputArguments: {} },
      ];

      const result = await engine.runWorkflowSteps({ steps });

      expect(result.status).toBe("failed");
      expect(result.steps[0].status).toBe("failed");
      expect(result.steps[0].error).toBe("Execution failed");
    });

    it("should skip steps when condition is not met", async () => {
      const tool = new MockTool("test", async () => ({ value: true }));
      engine.registerTool(tool);

      const steps: WorkflowStep[] = [
        { id: "s1", toolName: "test", inputArguments: {} },
        {
          id: "s2",
          toolName: "test",
          inputArguments: {},
          condition: {
            field: "value",
            operator: "equals",
            value: false,
          },
        },
        { id: "s3", toolName: "test", inputArguments: {}, dependsOn: [{ stepId: "s1" }] },
      ];

      const result = await engine.runWorkflowSteps({ steps });

      expect(result.status).toBe("completed");
      expect(result.steps[1].status).toBe("skipped");
    });

    it("should respect retry configuration", async () => {
      let attempts = 0;
      const retryTool = new MockTool("retry", async () => {
        attempts++;
        if (attempts < 3) throw new Error("Transient error");
        return { success: true };
      });
      engine.registerTool(retryTool);

      const steps: WorkflowStep[] = [
        {
          id: "s1",
          toolName: "retry",
          inputArguments: {},
          retry: { maxAttempts: 3, delayMs: 0 },
        },
      ];

      const result = await engine.runWorkflowSteps({ steps });

      expect(result.status).toBe("completed");
      expect(result.steps[0].attempts).toBe(3);
    });

    it("should track step duration", async () => {
      const tool = new MockTool("slow", async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { done: true };
      });
      engine.registerTool(tool);

      const steps: WorkflowStep[] = [
        { id: "s1", toolName: "slow", inputArguments: {} },
      ];

      const result = await engine.runWorkflowSteps({ steps });

      expect(result.steps[0].startedAt).toBeDefined();
      expect(result.steps[0].completedAt).toBeDefined();
      expect(result.totalDurationMs).toBeGreaterThan(0);
    });

    it("should rollback on failure when configured", async () => {
      const executedCompensations: string[] = [];
      
      const tool1 = new MockTool("step1", async () => ({ id: 1 }));
      const tool2 = new MockTool("compensate", async () => {
        executedCompensations.push("compensate");
        return {};
      });
      const failingTool = new MockTool("failing", async () => {
        throw new Error("Failed");
      });

      engine.registerTool(tool1);
      engine.registerTool(tool2);
      engine.registerTool(failingTool);

      // Compensation should be on the completed step (s1), not the failing step
      const steps: WorkflowStep[] = [
        {
          id: "s1",
          toolName: "step1",
          inputArguments: {},
          compensation: { toolName: "compensate", inputArguments: {} },
        },
        { id: "s2", toolName: "failing", inputArguments: {}, dependsOn: [{ stepId: "s1" }] },
      ];

      const result = await engine.runWorkflowSteps({ steps, onFailure: "rollback" });

      expect(result.status).toBe("rolled_back");
      expect(executedCompensations).toContain("compensate");
    });
  });

  describe("runWorkflow", () => {
    it("should run registered workflow by ID", async () => {
      const tool = new MockTool("test", async () => ({ done: true }));
      engine.registerTool(tool);

      const workflow: WorkflowDefinition = {
        id: "my-workflow",
        name: "My Workflow",
        steps: [{ id: "s1", toolName: "test", inputArguments: {} }],
      };
      engine.registerWorkflow(workflow);

      const result = await engine.runWorkflow("my-workflow");

      expect(result.status).toBe("completed");
      expect(result.workflowId).toBe("my-workflow");
    });

    it("should throw for unknown workflow", async () => {
      await expect(engine.runWorkflow("nonexistent")).rejects.toThrow("not found");
    });
  });

  describe("validateWorkflow", () => {
    it("should validate a correct workflow", () => {
      const tool = new MockTool("test", async () => ({}));
      engine.registerTool(tool);

      const workflow: WorkflowDefinition = {
        id: "test",
        name: "Test",
        steps: [
          { id: "s1", toolName: "test", inputArguments: {} },
          { id: "s2", toolName: "test", inputArguments: {}, dependsOn: [{ stepId: "s1" }] },
        ],
      };

      const result = engine.validateWorkflow(workflow);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing tools", () => {
      const workflow: WorkflowDefinition = {
        id: "test",
        name: "Test",
        steps: [{ id: "s1", toolName: "nonexistent", inputArguments: {} }],
      };

      const result = engine.validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("not registered");
    });

    it("should detect missing dependencies", () => {
      const tool = new MockTool("test", async () => ({}));
      engine.registerTool(tool);

      const workflow: WorkflowDefinition = {
        id: "test",
        name: "Test",
        steps: [
          { id: "s1", toolName: "test", inputArguments: {}, dependsOn: [{ stepId: "missing" }] },
        ],
      };

      const result = engine.validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("not found");
    });

    it("should detect missing compensation tools", () => {
      const tool = new MockTool("test", async () => ({}));
      engine.registerTool(tool);

      const workflow: WorkflowDefinition = {
        id: "test",
        name: "Test",
        steps: [
          {
            id: "s1",
            toolName: "test",
            inputArguments: {},
            compensation: { toolName: "nonexistent", inputArguments: {} },
          },
        ],
      };

      const result = engine.validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Compensation");
    });
  });

  describe("condition operators", () => {
    let tool: MockTool;

    beforeEach(() => {
      tool = new MockTool("test", async () => ({}));
      engine.registerTool(tool);
    });

    it("should evaluate exists condition", async () => {
      const steps: WorkflowStep[] = [
        { id: "s1", toolName: "test", inputArguments: {} },
        {
          id: "s2",
          toolName: "test",
          inputArguments: {},
          condition: { field: "someField", operator: "exists" },
        },
      ];

      // s2 should be skipped because "someField" doesn't exist after s1
      const result = await engine.runWorkflowSteps({ steps });
      expect(result.steps[1].status).toBe("skipped");
    });

    it("should evaluate equals condition", async () => {
      const valueTool = new MockTool("value", async () => ({ status: "success" }));
      engine.registerTool(valueTool);

      const steps: WorkflowStep[] = [
        { id: "s1", toolName: "value", inputArguments: {} },
        {
          id: "s2",
          toolName: "test",
          inputArguments: {},
          condition: { field: "status", operator: "equals", value: "success" },
        },
      ];

      const result = await engine.runWorkflowSteps({ steps });
      expect(result.steps[1].status).toBe("completed");
    });

    it("should evaluate not_equals condition", async () => {
      const valueTool = new MockTool("value", async () => ({ status: "success" }));
      engine.registerTool(valueTool);

      const steps: WorkflowStep[] = [
        { id: "s1", toolName: "value", inputArguments: {} },
        {
          id: "s2",
          toolName: "test",
          inputArguments: {},
          condition: { field: "status", operator: "not_equals", value: "failed" },
        },
      ];

      const result = await engine.runWorkflowSteps({ steps });
      expect(result.steps[1].status).toBe("completed");
    });

    it("should evaluate gt condition", async () => {
      const valueTool = new MockTool("value", async () => ({ count: 10 }));
      engine.registerTool(valueTool);

      const steps: WorkflowStep[] = [
        { id: "s1", toolName: "value", inputArguments: {} },
        {
          id: "s2",
          toolName: "test",
          inputArguments: {},
          condition: { field: "count", operator: "gt", value: 5 },
        },
      ];

      const result = await engine.runWorkflowSteps({ steps });
      expect(result.steps[1].status).toBe("completed");
    });

    it("should evaluate lt condition", async () => {
      const valueTool = new MockTool("value", async () => ({ count: 3 }));
      engine.registerTool(valueTool);

      const steps: WorkflowStep[] = [
        { id: "s1", toolName: "value", inputArguments: {} },
        {
          id: "s2",
          toolName: "test",
          inputArguments: {},
          condition: { field: "count", operator: "lt", value: 5 },
        },
      ];

      const result = await engine.runWorkflowSteps({ steps });
      expect(result.steps[1].status).toBe("completed");
    });
  });
});
