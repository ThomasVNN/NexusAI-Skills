import { describe, it, expect } from "vitest";
import { ExecuteSkill, globalRuntime } from "../src/runtime.js";
import { registry } from "../src/shared.js";
import { Tool } from "../src/internal/skills.interface.js";

// A mock tool that throws an error for testing runtime errors
class ErrorProneTool implements Tool {
  name = "error_tool";
  description = "Thows an error always";
  inputSchema = {};
  async execute(): Promise<Record<string, any>> {
    throw new Error("Simulated tool crash");
  }
}

// A mock safe tool
class GenericEchoTool implements Tool {
  name = "echo_tool";
  description = "Echoes inputs";
  inputSchema = {};
  async execute(ctx: any, args: Record<string, any>): Promise<Record<string, any>> {
    return { echoed: args, ctx };
  }
}

describe("ExecuteSkill - Skill Invocation Lifecycle", () => {
  it("should successfully execute a valid skill tool and produce result + audit logs [Intent -> Permission -> Sandbox -> Executor -> Result]", async () => {
    // 1. Register a skill
    const skillData = {
      id: "active-citation-matcher",
      name: "Active Law Citation Matcher",
      description: "Extracts and matches active law citations",
      version: "1.0.0",
      author: "Test Author",
      codeUrl: "http://example.com/citation-matcher.js",
      trustScore: 95,
      permissions: ["read:knowledge"],
      status: "approved" as const
    };
    registry.registerSkill(skillData);

    // 2. Register the tool under the skill in our runtime engine
    const echoTool = new GenericEchoTool();
    globalRuntime.registerTool("active-citation-matcher", echoTool);

    // 3. Invoke ExecuteSkill
    const request = {
      skillId: "active-citation-matcher",
      toolName: "echo_tool",
      args: { testVal: 42 },
      context: { userId: "user-123", role: "admin" }
    };

    const response = await ExecuteSkill(request);

    // 4. Assert response lifecycle output
    expect(response.status).toBe("success");
    expect(response.result).toBeDefined();
    expect(response.result?.echoed?.testVal).toBe(42);
    expect(response.result?.ctx?.userId).toBe("user-123");
    expect(response.error).toBeUndefined();

    // Assert audit data structure
    expect(response.audit).toBeDefined();
    expect(response.audit.requestedAt).toBeDefined();
    expect(response.audit.completedAt).toBeDefined();
    expect(response.audit.skillId).toBe("active-citation-matcher");
    expect(response.audit.toolName).toBe("echo_tool");
    expect(response.audit.userId).toBe("user-123");

    // Assert policy validation stage in audit
    expect(response.audit.policyCheck.allowed).toBe(true);
    expect(response.audit.policyCheck.trustScore).toBe(95);
    expect(response.audit.policyCheck.permissionsChecked).toContain("read:knowledge");

    // Assert sandbox stage in audit
    expect(response.audit.sandbox.type).toBe("v8-isolated");
    expect(response.audit.sandbox.sanitized).toBe(true);
    expect(response.audit.sandbox.safetyAssessment).toBe("passed");
    expect(response.audit.sandbox.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("should fail gracefully on invalid Intent schema (missing field)", async () => {
    // Missing toolName
    const badRequest = {
      skillId: "some-skill"
    };

    const response = await ExecuteSkill(badRequest);
    expect(response.status).toBe("failed");
    expect(response.result).toBeNull();
    expect(response.error).toContain("Intent validation failed");
    expect(response.audit.policyCheck.allowed).toBe(false);
    expect(response.audit.sandbox.safetyAssessment).toBe("unverified");
  });

  it("should fail gracefully when Skill is not found in registry", async () => {
    const request = {
      skillId: "non-existent-skill",
      toolName: "some_tool",
      args: {}
    };

    const response = await ExecuteSkill(request);
    expect(response.status).toBe("failed");
    expect(response.result).toBeNull();
    expect(response.error).toContain("not found in registry");
    expect(response.audit.policyCheck.allowed).toBe(false);
  });

  it("should block execution when PolicyEngine rejects skill (trustScore below threshold)", async () => {
    // Register unsafe skill (low trustScore)
    const unsafeSkill = {
      id: "low-trust-skill",
      name: "Low Trust Skill",
      description: "A suspicious skill",
      version: "1.0.0",
      author: "Untrusted",
      codeUrl: "http://example.com/untrusted.js",
      trustScore: 40, // standard threshold is 70
      permissions: [],
      status: "approved" as const
    };
    registry.registerSkill(unsafeSkill);

    const request = {
      skillId: "low-trust-skill",
      toolName: "any_tool",
      args: {}
    };

    const response = await ExecuteSkill(request);
    expect(response.status).toBe("forbidden");
    expect(response.result).toBeNull();
    expect(response.error).toContain("falls below the minimum required security threshold");
    expect(response.audit.policyCheck.allowed).toBe(false);
    expect(response.audit.policyCheck.trustScore).toBe(40);
    expect(response.audit.sandbox.safetyAssessment).toBe("failed");
  });

  it("should block execution at Sandbox barrier when skill requests forbidden OS/SYS permissions", async () => {
    const rogueSkill = {
      id: "rogue-system-skill",
      name: "Rogue System Skill",
      description: "Tries to escape sandbox using sys permissions",
      version: "1.0.0",
      author: "Malicious",
      codeUrl: "http://example.com/rogue.js",
      trustScore: 99, // high trust score but dangerous permissions
      permissions: ["sys:reboot"],
      status: "approved" as const
    };
    registry.registerSkill(rogueSkill);

    // Register a tool under the skill in our runtime engine
    const echoTool = new GenericEchoTool();
    globalRuntime.registerTool("rogue-system-skill", echoTool);

    const request = {
      skillId: "rogue-system-skill",
      toolName: "echo_tool",
      args: {}
    };

    const response = await ExecuteSkill(request);
    expect(response.status).toBe("forbidden");
    expect(response.result).toBeNull();
    expect(response.error).toContain("Security Violation: Unsafe system permission 'sys:reboot' detected at sandbox barrier");
    
    // Policy engine technically permits execution because trust score is high and it evaluates defaultPolicy rules,
    // but the Sandbox stage must hard-block it as part of sandbox boundary enforcement.
    expect(response.audit.sandbox.safetyAssessment).toBe("failed");
    expect(response.audit.sandbox.sanitized).toBe(true);
  });

  it("should fail gracefully when the tool is not registered under the skill", async () => {
    const skillData = {
      id: "unregistered-tool-skill",
      name: "Active Skill",
      description: "Skill with no registered tools",
      version: "1.0.0",
      author: "Test",
      codeUrl: "http://example.com/empty.js",
      trustScore: 80,
      permissions: [],
      status: "approved" as const
    };
    registry.registerSkill(skillData);

    const request = {
      skillId: "unregistered-tool-skill",
      toolName: "non-existent-tool",
      args: {}
    };

    const response = await ExecuteSkill(request);
    expect(response.status).toBe("failed");
    expect(response.result).toBeNull();
    expect(response.error).toContain("is not registered under skill");
    expect(response.audit.sandbox.safetyAssessment).toBe("passed");
  });

  it("should fail gracefully and record audit details when a tool throws a runtime error", async () => {
    const errorSkill = {
      id: "error-prone-skill",
      name: "Error Skill",
      description: "Always crashes",
      version: "1.0.0",
      author: "Chaos Monkey",
      codeUrl: "http://example.com/chaos.js",
      trustScore: 90,
      permissions: [],
      status: "approved" as const
    };
    registry.registerSkill(errorSkill);

    const errorTool = new ErrorProneTool();
    globalRuntime.registerTool("error-prone-skill", errorTool);

    const request = {
      skillId: "error-prone-skill",
      toolName: "error_tool",
      args: {}
    };

    const response = await ExecuteSkill(request);
    expect(response.status).toBe("failed");
    expect(response.result).toBeNull();
    expect(response.error).toContain("Runtime execution failed: Simulated tool crash");
    expect(response.audit.sandbox.safetyAssessment).toBe("passed");
  });
});
