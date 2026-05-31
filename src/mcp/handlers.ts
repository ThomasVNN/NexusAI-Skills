/**
 * MCP HTTP Handlers
 * 
 * Provides HTTP endpoints for MCP protocol:
 * - POST /api/mcp/message - JSON-RPC message handler
 * - GET /api/mcp/stream - Server-Sent Events stream
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { mcpServer, MCPRequest, MCPResponse } from "./server.js";
import { pino } from "pino";

const logger = pino();

/**
 * Parse JSON-RPC request from body
 */
function parseRequest(body: any): MCPRequest[] {
  if (Array.isArray(body)) {
    return body;
  }
  return [body];
}

/**
 * Register MCP routes with Fastify server
 */
export async function registerMCPRoutes(server: FastifyInstance): Promise<void> {
  
  // Initialize MCP server with default tools
  initializeMCPServer();

  // Health check for MCP
  server.get("/api/mcp/health", async () => {
    return {
      status: "ok",
      service: "nexusai-mcp",
      version: "1.0.0",
      protocol: "JSON-RPC 2.0",
      capabilities: {
        tools: true,
        streaming: true,
      },
    };
  });

  // JSON-RPC message endpoint
  server.post("/api/mcp/message", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const requests = parseRequest(request.body);
      
      if (!Array.isArray(request.body)) {
        // Single request
        const response = await mcpServer.handleRequest(requests[0]);
        return reply.status(200).send(response);
      } else {
        // Batch request
        const responses = await mcpServer.handleBatch(requests);
        return reply.status(200).send(responses);
      }
    } catch (error: any) {
      logger.error({ error: error.message }, "MCP message handling failed");
      return reply.status(500).send({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: `Internal error: ${error.message}`,
        },
      });
    }
  });

  // List available tools
  server.get("/api/mcp/tools", async (request: FastifyRequest, reply: FastifyReply) => {
    const tools = mcpServer.listTools();
    return reply.status(200).send({
      tools,
      count: tools.length,
    });
  });

  // Call a specific tool
  server.post("/api/mcp/tools/call", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { name, arguments: args = {} } = request.body as any;
      
      if (!name) {
        return reply.status(400).send({
          error: "Tool name is required",
        });
      }

      const result = await mcpServer.executeTool(name, args);
      return reply.status(200).send(result);
    } catch (error: any) {
      logger.error({ error: error.message }, "Tool execution failed");
      return reply.status(500).send({
        error: error.message,
      });
    }
  });

  // Server-Sent Events stream for real-time updates
  server.get("/api/mcp/stream", async (request: FastifyRequest, reply: FastifyReply) => {
    // Set up SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Send initial connection event
    reply.raw.write(`data: ${JSON.stringify({
      type: "connected",
      server: "nexusai-mcp",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    })}\n\n`);

    // Send heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      reply.raw.write(`data: ${JSON.stringify({
        type: "heartbeat",
        timestamp: new Date().toISOString(),
      })}\n\n`);
    }, 30000);

    // Clean up on close
    request.raw.on("close", () => {
      clearInterval(heartbeat);
    });

    // Keep connection alive
    await new Promise<void>((resolve) => {
      request.raw.on("close", () => resolve());
      request.raw.on("end", () => resolve());
    });
  });

  // Stream tool execution result
  server.post("/api/mcp/stream/execute", async (request: FastifyRequest, reply: FastifyReply) => {
    const { skillId, toolName, args = {} } = request.body as any;

    if (!skillId || !toolName) {
      return reply.status(400).send({
        error: "skillId and toolName are required",
      });
    }

    // Set up SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    try {
      // Send start event
      reply.raw.write(`data: ${JSON.stringify({
        type: "execution_start",
        skillId,
        toolName,
        timestamp: new Date().toISOString(),
      })}\n\n`);

      // Execute skill
      const result = await mcpServer.executeSkill(skillId, toolName, args);

      // Send completion event
      reply.raw.write(`data: ${JSON.stringify({
        type: "execution_complete",
        result,
        timestamp: new Date().toISOString(),
      })}\n\n`);
    } catch (error: any) {
      reply.raw.write(`data: ${JSON.stringify({
        type: "execution_error",
        error: error.message,
        timestamp: new Date().toISOString(),
      })}\n\n`);
    }

    reply.raw.end();
  });
}

/**
 * Initialize MCP server with default tools and skills
 */
function initializeMCPServer(): void {
  // Import tools and register them
  // This would be done in a real implementation
  logger.info("MCP server initialized with default configuration");
}

/**
 * MCP Protocol documentation helper
 */
export function getMCPProtocolDocs(): object {
  return {
    protocol: "Model Context Protocol (MCP)",
    version: "2024-11-05",
    transport: "HTTP + JSON-RPC 2.0",
    endpoints: {
      "POST /api/mcp/message": {
        description: "JSON-RPC message handler for single or batch requests",
        request: {
          jsonrpc: "2.0",
          id: "string | number",
          method: "string",
          params: "object (optional)",
        },
        response: {
          jsonrpc: "2.0",
          id: "string | number",
          result: "any (on success)",
          error: "{ code: number, message: string } (on error)",
        },
      },
      "GET /api/mcp/tools": {
        description: "List all available tools",
        response: {
          tools: "MCPTool[]",
          count: "number",
        },
      },
      "POST /api/mcp/tools/call": {
        description: "Execute a specific tool",
        request: {
          name: "string",
          arguments: "Record<string, any>",
        },
        response: "MCPToolResponse",
      },
      "GET /api/mcp/stream": {
        description: "SSE stream for real-time MCP events",
      },
      "POST /api/mcp/stream/execute": {
        description: "Execute skill with SSE streaming",
      },
    },
    methods: {
      "tools/list": "List available tools",
      "tools/call": "Call a tool with arguments",
      "initialize": "Initialize MCP session",
      "ping": "Keep connection alive",
    },
  };
}
