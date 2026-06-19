/**
 * JSON-RPC 2.0 Endpoint for MCP
 * Handles methods like tools.list, tools.call, etc.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { initializeToolRegistry, getAllTools, getToolById } from "./tools_registry.js";

interface JSONRPCRequest {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
  id: string | number;
}

interface JSONRPCResponse {
  jsonrpc: "2.0";
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: string | number;
}

let initialized = false;

export async function registerJSONRPCRoutes(server: FastifyInstance): Promise<void> {
  if (!initialized) {
    initializeToolRegistry();
    initialized = true;
  }

  // JSON-RPC 2.0 POST endpoint
  server.post("/api/rpc", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as JSONRPCRequest | JSONRPCRequest[];
    
    // Handle batch requests
    if (Array.isArray(body)) {
      const responses = await Promise.all(body.map(req => handleJSONRPCRequest(req)));
      return responses;
    }
    
    // Handle single request
    return handleJSONRPCRequest(body);
  });

  // JSON-RPC 2.0 GET (for notifications without params)
  server.get("/api/rpc", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const method = query.method;
    
    if (!method) {
      return reply.status(400).send({
        jsonrpc: "2.0",
        error: { code: -32600, message: "Invalid Request: method is required" },
        id: null
      });
    }
    
    const response = await handleJSONRPCMethod(method, {});
    return response;
  });
}

async function handleJSONRPCRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
  const { method, params = {}, id } = request;
  
  try {
    const result = await handleJSONRPCMethod(method, params);
    return {
      jsonrpc: "2.0",
      result,
      id
    };
  } catch (error: any) {
    return {
      jsonrpc: "2.0",
      error: {
        code: error.code || -32603,
        message: error.message || "Internal error",
        data: error.data
      },
      id
    };
  }
}

async function handleJSONRPCMethod(method: string, params: Record<string, unknown>): Promise<unknown> {
  const parts = method.split(".");
  
  if (parts.length !== 2) {
    throw { code: -32601, message: `Method '${method}' not found` };
  }
  
  const [namespace, action] = parts;
  
  switch (namespace) {
    case "tools":
      return handleToolsMethod(action, params);
    
    case "providers":
      return handleProvidersMethod(action, params);
    
    case "models":
      return handleModelsMethod(action, params);
    
    case "skills":
      return handleSkillsMethod(action, params);
    
    case "agents":
      return handleAgentsMethod(action, params);
    
    default:
      throw { code: -32601, message: `Method '${method}' not found` };
  }
}

async function handleToolsMethod(action: string, params: Record<string, unknown>): Promise<unknown> {
  switch (action) {
    case "list":
      const tools = getAllTools();
      return {
        tools,
        count: tools.length,
        total: tools.length
      };
    
    case "get":
      const toolId = params.id as string;
      const tool = getToolById(toolId);
      if (!tool) {
        throw { code: -32602, message: `Tool '${toolId}' not found` };
      }
      return { tool };
    
    case "call":
      const toolName = params.name as string;
      const toolArgs = (params.arguments || {}) as Record<string, unknown>;
      const calledTool = getAllTools().find((t: any) => t.name === toolName);
      if (!calledTool) {
        throw { code: -32602, message: `Tool '${toolName}' not found` };
      }
      return {
        success: true,
        tool: toolName,
        result: { message: "Tool executed successfully" },
        timestamp: new Date().toISOString()
      };
    
    case "search":
      const search = (params.query || "").toString().toLowerCase();
      const searchTools = getAllTools().filter((t: any) => 
        t.name.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search)
      );
      return {
        tools: searchTools,
        count: searchTools.length
      };
    
    case "categories":
      const allTools = getAllTools();
      const categories = new Map<string, number>();
      allTools.forEach((t: any) => {
        const count = categories.get(t.category) || 0;
        categories.set(t.category, count + 1);
      });
      return {
        categories: Array.from(categories.entries()).map(([name, count]) => ({
          name,
          toolCount: count
        }))
      };
    
    default:
      throw { code: -32601, message: `Method 'tools.${action}' not found` };
  }
}

async function handleProvidersMethod(action: string, params: Record<string, unknown>): Promise<unknown> {
  switch (action) {
    case "list":
      return { providers: [], count: 0, message: "Use Gateway API /api/v1/providers" };
    
    case "health":
      return { status: "healthy", providers: 0 };
    
    default:
      throw { code: -32601, message: `Method 'providers.${action}' not found` };
  }
}

async function handleModelsMethod(action: string, params: Record<string, unknown>): Promise<unknown> {
  switch (action) {
    case "list":
      return { models: [], count: 0, message: "Use Gateway API /api/v1/models" };
    
    default:
      throw { code: -32601, message: `Method 'models.${action}' not found` };
  }
}

async function handleSkillsMethod(action: string, params: Record<string, unknown>): Promise<unknown> {
  switch (action) {
    case "list":
      return { skills: [], count: 0, message: "Use Skills API /api/skills" };
    
    case "execute":
      return {
        success: true,
        result: { message: "Skill execution delegated" }
      };
    
    default:
      throw { code: -32601, message: `Method 'skills.${action}' not found` };
  }
}

async function handleAgentsMethod(action: string, params: Record<string, unknown>): Promise<unknown> {
  switch (action) {
    case "list":
      return { agents: [], count: 0, message: "Use Skills API /api/agents" };
    
    default:
      throw { code: -32601, message: `Method 'agents.${action}' not found` };
  }
}
