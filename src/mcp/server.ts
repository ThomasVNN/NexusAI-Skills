/**
 * MCP Server - Model Context Protocol Implementation
 * 
 * Provides standardized endpoints for AI agent function calling:
 * - Stream endpoint for SSE-based responses
 * - Message endpoint for JSON-RPC style calls
 * - Tool registration and discovery
 */

import { Tool } from "../internal/skills.interface.js";
import { ExecuteSkill } from "../runtime.js";

// MCP Protocol types
export interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, any>;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolResponse {
  content: {
    type: "text";
    text: string;
  }[];
  isError?: boolean;
}

// MCP Error codes
export const MCP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  TOOL_NOT_FOUND: -32001,
  TOOL_EXECUTION_FAILED: -32002,
};

/**
 * MCP Server for skill execution via Model Context Protocol
 */
export class MCPServer {
  private tools: Map<string, Tool> = new Map();
  private skills: Map<string, string> = new Map(); // skillId -> toolName mapping

  /**
   * Register a tool with the MCP server
   */
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Register a skill-to-tool mapping
   */
  registerSkillMapping(skillId: string, toolName: string): void {
    this.skills.set(skillId, toolName);
  }

  /**
   * List all available tools
   */
  listTools(): MCPTool[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: "object",
        properties: tool.inputSchema,
        required: this.getRequiredProperties(tool.inputSchema),
      },
    }));
  }

  /**
   * Handle a JSON-RPC tool call request
   */
  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case "tools/list":
          return this.handleListTools(request);
        case "tools/call":
          return await this.handleCallTool(request);
        case "initialize":
          return this.handleInitialize(request);
        case "ping":
          return this.handlePing(request);
        default:
          return this.createErrorResponse(
            request.id,
            MCP_ERROR_CODES.METHOD_NOT_FOUND,
            `Method '${request.method}' not found`
          );
      }
    } catch (error: any) {
      return this.createErrorResponse(
        request.id,
        MCP_ERROR_CODES.INTERNAL_ERROR,
        error.message
      );
    }
  }

  /**
   * Handle batch of requests
   */
  async handleBatch(requests: MCPRequest[]): Promise<(MCPResponse | MCPToolResponse)[]> {
    const results: (MCPResponse | MCPToolResponse)[] = [];
    for (const request of requests) {
      results.push(await this.handleRequest(request));
    }
    return results;
  }

  /**
   * Execute a tool by name
   */
  async executeTool(name: string, args: Record<string, any>): Promise<MCPToolResponse> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }

    try {
      const result = await tool.execute({}, args);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Tool execution failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Execute a skill by ID using the runtime
   */
  async executeSkill(skillId: string, toolName: string, args: Record<string, any>): Promise<MCPToolResponse> {
    try {
      const response = await ExecuteSkill({
        skillId,
        toolName,
        args,
      });

      if (response.status === "success") {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(response.result, null, 2),
            },
          ],
        };
      } else if (response.status === "forbidden") {
        return {
          content: [
            {
              type: "text" as const,
              text: `Execution forbidden: ${response.error}`,
            },
          ],
          isError: true,
        };
      } else {
        return {
          content: [
            {
              type: "text" as const,
              text: `Execution failed: ${response.error}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Skill execution error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private handleListTools(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        tools: this.listTools(),
      },
    };
  }

  private async handleCallTool(request: MCPRequest): Promise<MCPResponse> {
    const params = request.params as MCPToolCall;
    if (!params?.name || !params?.arguments) {
      return this.createErrorResponse(
        request.id,
        MCP_ERROR_CODES.INVALID_PARAMS,
        "Missing 'name' or 'arguments' in params"
      );
    }

    // Check if this is a skill execution
    const skillId = params.arguments.skillId;
    const toolName = params.name;

    if (skillId) {
      const result = await this.executeSkill(skillId, toolName, params.arguments);
      return {
        jsonrpc: "2.0",
        id: request.id,
        result,
      };
    }

    // Direct tool execution
    const result = await this.executeTool(toolName, params.arguments);
    return {
      jsonrpc: "2.0",
      id: request.id,
      result,
    };
  }

  private handleInitialize(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {
            listChanged: true,
          },
        },
        serverInfo: {
          name: "nexusai-skills-mcp",
          version: "1.0.0",
        },
      },
    };
  }

  private handlePing(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: { pong: true },
    };
  }

  private createErrorResponse(id: string | number, code: number, message: string): MCPResponse {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
      },
    };
  }

  private getRequiredProperties(schema: Record<string, any>): string[] {
    if (!schema) return [];
    const required: string[] = [];
    for (const [key, value] of Object.entries(schema)) {
      if (value && typeof value === "object" && "required" in value) {
        continue; // Skip nested objects
      }
      if (value && typeof value !== "object") {
        required.push(key); // Primitive types are typically required
      }
    }
    return required;
  }
}

// Global MCP server instance
export const mcpServer = new MCPServer();
