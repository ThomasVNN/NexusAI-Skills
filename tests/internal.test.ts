import { describe, it, expect } from "vitest";
import { McpServer } from "../src/internal/mcp/mcp.js";
import { LegalCitationTool } from "../src/internal/tools/tools.js";
import { DatabaseConnector } from "../src/internal/connectors/connectors.js";
import { WorkflowEngine } from "../src/internal/workflow/workflow.js";
import { SandboxedExecutor } from "../src/internal/execution/execution.js";

describe("Skills Internal Runtime Abstractions", () => {
  it("McpServer should register and call tools successfully", async () => {
    const server = new McpServer();
    const tool = new LegalCitationTool();
    server.registerTool(tool);

    const tools = server.listTools();
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe("vietnam_law_citation_matcher");

    const result = await server.handleCallTool("vietnam_law_citation_matcher", {
      text: "Nghị định 52/2024/NĐ-CP regulates digital banking eKYC."
    });
    expect(result.success).toBe(true);
    expect(result.foundCount).toBe(1);
    expect(result.citations[0]).toBe("Nghị định 52/2024/NĐ-CP");
  });

  it("DatabaseConnector should authenticate correctly", async () => {
    const conn = new DatabaseConnector("db-1");
    const ok = await conn.connect({ username: "postgres", host: "localhost" });
    expect(ok).toBe(true);

    const bad = await conn.connect({});
    expect(bad).toBe(false);
  });

  it("WorkflowEngine should execute tool chain sequentially", async () => {
    const engine = new WorkflowEngine();
    const tool = new LegalCitationTool();
    engine.registerTool(tool);

    const steps = [
      {
        id: "step-1",
        toolName: "vietnam_law_citation_matcher",
        inputArguments: { text: "According to Nghị định 10/2020/NĐ-CP and Nghị định 15/2021/NĐ-CP..." }
      }
    ];

    const result = await engine.runWorkflowSteps(steps);
    expect(result.steps.length).toBe(1);
    expect(result.steps[0].stepId).toBe("step-1");
    expect(result.status).toBe("completed");
  });

  it("SandboxedExecutor should block unsafe permissions", async () => {
    const exec = new SandboxedExecutor();
    const safeSkill = { id: "s-1", name: "Safe", description: "d", version: "1", permissions: [] };
    const badSkill = { id: "s-2", name: "Bad", description: "d", version: "1", permissions: ["sys:exec"] };

    const res = await exec.execute(safeSkill, "matcher", {});
    expect(res.success).toBe(true);

    await expect(exec.execute(badSkill, "matcher", {})).rejects.toThrow("Security Violation");
  });
});
