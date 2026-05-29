import { Tool } from "../skills.interface.js";

export interface WorkflowStep {
  id: string;
  toolName: string;
  inputArguments: Record<string, any>;
}

export class SequentialWorkflowEngine {
  private tools: Map<string, Tool> = new Map();

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  async run(steps: WorkflowStep[]): Promise<Record<string, any>[]> {
    const results: Record<string, any>[] = [];
    let previousResult: Record<string, any> = {};

    for (const step of steps) {
      const tool = this.tools.get(step.toolName);
      if (!tool) {
        throw new Error(`Step execution failed: Tool ${step.toolName} not found`);
      }

      // Chain outputs as inputs if specified
      const args = { ...step.inputArguments, ...previousResult };
      const output = await tool.execute({}, args);
      results.push({
        stepId: step.id,
        tool: step.toolName,
        output
      });
      previousResult = output;
    }

    return results;
  }
}
