import { describe, it, expect, beforeEach } from "vitest";
import { SkillSandbox, createSandbox, DEFAULT_SANDBOX_CONFIG } from "../src/sandbox/executor.js";

describe("SkillSandbox", () => {
  let sandbox: SkillSandbox;

  beforeEach(() => {
    sandbox = new SkillSandbox();
  });

  describe("constructor", () => {
    it("should use default config when no config provided", () => {
      const s = new SkillSandbox();
      expect(s.getConfig().maxMemoryMB).toBe(DEFAULT_SANDBOX_CONFIG.maxMemoryMB);
      expect(s.getConfig().maxExecutionMs).toBe(DEFAULT_SANDBOX_CONFIG.maxExecutionMs);
    });

    it("should merge custom config with defaults", () => {
      const s = new SkillSandbox({ maxMemoryMB: 256 });
      expect(s.getConfig().maxMemoryMB).toBe(256);
      expect(s.getConfig().maxExecutionMs).toBe(DEFAULT_SANDBOX_CONFIG.maxExecutionMs);
    });
  });

  describe("execute", () => {
    it("should execute a simple skill successfully", async () => {
      const result = await sandbox.execute(
        {
          skillId: "test-skill",
          toolName: "test-tool",
          args: { input: "hello" },
        },
        async (ctx, args) => {
          return { echo: args.input, skillId: ctx.skillId };
        }
      );

      expect(result.success).toBe(true);
      expect(result.output.echo).toBe("hello");
      expect(result.output.skillId).toBe("test-skill");
    });

    it("should track execution duration", async () => {
      const result = await sandbox.execute(
        {
          skillId: "test-skill",
          toolName: "test-tool",
          args: {},
        },
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return { done: true };
        }
      );

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(10);
    });

    it("should reject dangerous patterns in arguments", async () => {
      const result = await sandbox.execute(
        {
          skillId: "test-skill",
          toolName: "test-tool",
          args: { code: "eval('dangerous')" },
        },
        async () => ({ result: true })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Security policy violation");
      expect(result.sandboxViolations).toContain("eval() is not allowed");
    });

    it("should reject Function constructor", async () => {
      const result = await sandbox.execute(
        {
          skillId: "test-skill",
          toolName: "test-tool",
          args: { code: "new Function('return 1')" },
        },
        async () => ({ result: true })
      );

      expect(result.success).toBe(false);
      expect(result.sandboxViolations).toContain("Function constructor is not allowed");
    });

    it("should reject process access", async () => {
      const result = await sandbox.execute(
        {
          skillId: "test-skill",
          toolName: "test-tool",
          args: { code: "process.exit(1)" },
        },
        async () => ({ result: true })
      );

      expect(result.success).toBe(false);
      expect(result.sandboxViolations).toContain("process access is not allowed");
    });

    it("should reject require()", async () => {
      const result = await sandbox.execute(
        {
          skillId: "test-skill",
          toolName: "test-tool",
          args: { code: "require('fs')" },
        },
        async () => ({ result: true })
      );

      expect(result.success).toBe(false);
      expect(result.sandboxViolations).toContain("require() is not allowed");
    });
  });

  describe("getActiveExecutionCount", () => {
    it("should return 0 initially", () => {
      expect(sandbox.getActiveExecutionCount()).toBe(0);
    });
  });

  describe("updateConfig", () => {
    it("should update configuration", () => {
      sandbox.updateConfig({ maxMemoryMB: 1024 });
      expect(sandbox.getConfig().maxMemoryMB).toBe(1024);
    });
  });

  describe("timeout", () => {
    it("should timeout slow executions", async () => {
      const shortSandbox = new SkillSandbox({ maxExecutionMs: 50 });

      const result = await shortSandbox.execute(
        {
          skillId: "slow-skill",
          toolName: "slow-tool",
          args: {},
        },
        async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { done: true };
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("timed out");
    });
  });
});

describe("createSandbox", () => {
  it("should create strict sandbox", () => {
    const sandbox = createSandbox("strict");
    const config = sandbox.getConfig();

    expect(config.maxMemoryMB).toBe(128);
    expect(config.maxExecutionMs).toBe(5000);
    expect(config.allowNetwork).toBe(false);
    expect(config.allowFileSystem).toBe(false);
  });

  it("should create moderate sandbox", () => {
    const sandbox = createSandbox("moderate");
    const config = sandbox.getConfig();

    expect(config.maxMemoryMB).toBe(256);
    expect(config.maxExecutionMs).toBe(15000);
    expect(config.allowNetwork).toBe(true);
    expect(config.allowFileSystem).toBe(false);
  });

  it("should create permissive sandbox", () => {
    const sandbox = createSandbox("permissive");
    const config = sandbox.getConfig();

    expect(config.maxMemoryMB).toBe(1024);
    expect(config.maxExecutionMs).toBe(60000);
    expect(config.allowNetwork).toBe(true);
    expect(config.allowFileSystem).toBe(true);
    expect(config.allowedPaths).toContain("/tmp");
  });
});

describe("DEFAULT_SANDBOX_CONFIG", () => {
  it("should have sensible defaults", () => {
    expect(DEFAULT_SANDBOX_CONFIG.maxMemoryMB).toBe(512);
    expect(DEFAULT_SANDBOX_CONFIG.maxExecutionMs).toBe(30000);
    expect(DEFAULT_SANDBOX_CONFIG.allowNetwork).toBe(false);
    expect(DEFAULT_SANDBOX_CONFIG.allowFileSystem).toBe(false);
  });
});
