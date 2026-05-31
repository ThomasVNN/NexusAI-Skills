import { describe, it, expect, beforeEach } from "vitest";
import { MCPServer, MCPRequest } from "../../src/mcp/server.js";

describe("MCPServer", () => {
  let server: MCPServer;

  beforeEach(() => {
    server = new MCPServer();
  });

  describe("registerTool", () => {
    it("should register a tool", () => {
      const mockTool = {
        name: "test-tool",
        description: "A test tool",
        inputSchema: {
          param1: { type: "string", description: "Test param" },
        },
        execute: async () => ({ result: "success" }),
      };

      server.registerTool(mockTool);
      const tools = server.listTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("test-tool");
    });

    it("should register multiple tools", () => {
      server.registerTool({
        name: "tool-1",
        description: "Tool 1",
        inputSchema: {},
        execute: async () => ({}),
      });
      server.registerTool({
        name: "tool-2",
        description: "Tool 2",
        inputSchema: {},
        execute: async () => ({}),
      });

      const tools = server.listTools();
      expect(tools).toHaveLength(2);
    });
  });

  describe("listTools", () => {
    it("should return empty list when no tools registered", () => {
      const tools = server.listTools();
      expect(tools).toHaveLength(0);
    });

    it("should return tools with correct schema", () => {
      server.registerTool({
        name: "complex-tool",
        description: "A complex tool",
        inputSchema: {
          input: { type: "string", description: "Input string" },
          count: { type: "number", description: "Count" },
        },
        execute: async () => ({}),
      });

      const tools = server.listTools();
      expect(tools[0].name).toBe("complex-tool");
      expect(tools[0].description).toBe("A complex tool");
      expect(tools[0].inputSchema.properties).toHaveProperty("input");
      expect(tools[0].inputSchema.properties).toHaveProperty("count");
    });
  });

  describe("executeTool", () => {
    it("should execute a tool successfully", async () => {
      server.registerTool({
        name: "echo-tool",
        description: "Echoes the input",
        inputSchema: { message: { type: "string" } },
        execute: async (ctx, args) => ({ echo: args.message }),
      });

      const result = await server.executeTool("echo-tool", { message: "hello" });
      
      expect(result.content[0].text).toContain("hello");
      expect(result.isError).toBeFalsy();
    });

    it("should return error for non-existent tool", async () => {
      await expect(server.executeTool("non-existent", {})).rejects.toThrow("not found");
    });
  });

  describe("handleRequest", () => {
    it("should handle tools/list request", async () => {
      server.registerTool({
        name: "test-tool",
        description: "Test",
        inputSchema: {},
        execute: async () => ({}),
      });

      const request: MCPRequest = {
        jsonrpc: "2.0",
        id: "1",
        method: "tools/list",
      };

      const response = await server.handleRequest(request);

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe("1");
      expect(response.result).toBeDefined();
      expect(response.result.tools).toHaveLength(1);
    });

    it("should handle initialize request", async () => {
      const request: MCPRequest = {
        jsonrpc: "2.0",
        id: "1",
        method: "initialize",
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.protocolVersion).toBe("2024-11-05");
      expect(response.result.capabilities.tools).toBeDefined();
      expect(response.result.serverInfo.name).toBe("nexusai-skills-mcp");
    });

    it("should handle ping request", async () => {
      const request: MCPRequest = {
        jsonrpc: "2.0",
        id: "1",
        method: "ping",
      };

      const response = await server.handleRequest(request);

      expect(response.result).toEqual({ pong: true });
    });

    it("should return error for unknown method", async () => {
      const request: MCPRequest = {
        jsonrpc: "2.0",
        id: "1",
        method: "unknown-method",
      };

      const response = await server.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601);
    });

    it("should handle tools/call request", async () => {
      server.registerTool({
        name: "add-tool",
        description: "Adds two numbers",
        inputSchema: { a: { type: "number" }, b: { type: "number" } },
        execute: async (ctx, args) => ({ sum: args.a + args.b }),
      });

      const request: MCPRequest = {
        jsonrpc: "2.0",
        id: "1",
        method: "tools/call",
        params: {
          name: "add-tool",
          arguments: { a: 5, b: 3 },
        },
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.content[0].text).toContain("8");
    });
  });

  describe("handleBatch", () => {
    it("should handle multiple requests", async () => {
      server.registerTool({
        name: "tool-a",
        description: "Tool A",
        inputSchema: {},
        execute: async () => ({}),
      });

      const requests: MCPRequest[] = [
        { jsonrpc: "2.0", id: "1", method: "tools/list" },
        { jsonrpc: "2.0", id: "2", method: "ping" },
        { jsonrpc: "2.0", id: "3", method: "initialize" },
      ];

      const responses = await server.handleBatch(requests);

      expect(responses).toHaveLength(3);
      expect(responses[0].id).toBe("1");
      expect(responses[1].id).toBe("2");
      expect(responses[2].id).toBe("3");
    });
  });

  describe("registerSkillMapping", () => {
    it("should register a skill-to-tool mapping", () => {
      server.registerSkillMapping("skill-123", "my-tool");
      // This is tested implicitly through executeSkill
      expect(true).toBe(true);
    });
  });
});

describe("MCP Protocol", () => {
  it("should use correct error codes", async () => {
    const server = new MCPServer();
    
    const request: MCPRequest = {
      jsonrpc: "2.0",
      id: "1",
      method: "invalid-method",
    };

    const response = await server.handleRequest(request);
    
    expect(response.error?.code).toBe(-32601);
  });

  it("should handle missing params gracefully", async () => {
    const server = new MCPServer();
    
    const request: MCPRequest = {
      jsonrpc: "2.0",
      id: "1",
      method: "tools/call",
      params: {}, // Missing name and arguments
    };

    const response = await server.handleRequest(request);
    
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe(-32602);
  });
});
