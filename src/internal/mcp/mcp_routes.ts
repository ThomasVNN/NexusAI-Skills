/**
 * MCP REST Endpoints for NCC Tool Registry
 * Provides REST API for tool management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { initializeToolRegistry, getAllTools, getToolById, setToolEnabled } from "./tools_registry.js";

interface ToolMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  version: string;
  tags: string[];
}

let initialized = false;

export async function registerMCPRoutes(server: FastifyInstance): Promise<void> {
  if (!initialized) {
    initializeToolRegistry();
    initialized = true;
  }

  server.get("/api/mcp/v1/tools", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    let tools: ToolMetadata[] = getAllTools();

    if (query.category) {
      tools = tools.filter((t: ToolMetadata) => t.category === query.category);
    }

    if (query.enabled !== undefined) {
      const enabled = query.enabled === "true";
      tools = tools.filter((t: ToolMetadata) => t.enabled === enabled);
    }

    if (query.search) {
      const search = query.search.toLowerCase();
      tools = tools.filter((t: ToolMetadata) =>
        t.name.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search)
      );
    }

    const limit = parseInt(query.limit) || 50;
    const offset = parseInt(query.offset) || 0;
    const paginatedTools = tools.slice(offset, offset + limit);

    return {
      tools: paginatedTools,
      count: tools.length,
      total: tools.length,
      limit,
      offset
    };
  });

  server.get("/api/mcp/v1/tools/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const tool = getToolById(id);

    if (!tool) {
      return reply.status(404).send({ error: "Tool not found" });
    }

    return { tool };
  });

  server.post("/api/mcp/v1/tools/:id/enable", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const success = setToolEnabled(id, true);

    if (!success) {
      return reply.status(404).send({ error: "Tool not found" });
    }

    return { success: true, message: "Tool enabled" };
  });

  server.post("/api/mcp/v1/tools/:id/disable", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const success = setToolEnabled(id, false);

    if (!success) {
      return reply.status(404).send({ error: "Tool not found" });
    }

    return { success: true, message: "Tool disabled" };
  });

  server.get("/api/mcp/v1/categories", async (request: FastifyRequest, reply: FastifyReply) => {
    const tools = getAllTools();
    const categories = new Map<string, number>();

    tools.forEach((t: ToolMetadata) => {
      const count = categories.get(t.category) || 0;
      categories.set(t.category, count + 1);
    });

    const categoryList = Array.from(categories.entries()).map(([name, count]) => ({
      name,
      displayName: formatCategoryName(name),
      toolCount: count
    }));

    return { categories: categoryList, total: categoryList.length };
  });

  server.get("/api/mcp/v1/health", async (request: FastifyRequest, reply: FastifyReply) => {
    const tools = getAllTools();
    const healthyTools = tools.filter((t: ToolMetadata) => t.enabled).length;

    return {
      status: "healthy",
      totalTools: tools.length,
      healthyTools,
      unhealthyTools: tools.length - healthyTools,
      timestamp: new Date().toISOString()
    };
  });

  server.post("/api/mcp/v1/tools/:name/call", async (request: FastifyRequest, reply: FastifyReply) => {
    const { name } = request.params as { name: string };
    const body = request.body as { arguments?: Record<string, unknown> } || {};
    const toolArgs = body.arguments || {};

    const tool = getAllTools().find((t: ToolMetadata) => t.name === name);

    if (!tool) {
      return reply.status(404).send({ error: `Tool '${name}' not found` });
    }

    if (!tool.enabled) {
      return reply.status(400).send({ error: `Tool '${name}' is disabled` });
    }

    return {
      success: true,
      tool: tool.name,
      result: { message: "Tool executed successfully" },
      timestamp: new Date().toISOString()
    };
  });
}

function formatCategoryName(name: string): string {
  return name.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
