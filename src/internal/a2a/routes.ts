/**
 * A2A REST Endpoints for NCC Agent Hub
 * Provides REST API for agent management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { agentRegistry, initializeDefaultAgents, a2aHandler, type Agent } from "./protocol.js";

let initialized = false;

export async function registerA2ARoutes(server: FastifyInstance): Promise<void> {
  // Initialize default agents on first registration
  if (!initialized) {
    initializeDefaultAgents();
    initialized = true;
  }

  // List all agents
  server.get("/api/agents", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, any>;
    const filter: { type?: string; status?: string } = {};

    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;

    const agents = agentRegistry.listAgents(filter as any);

    return {
      agents,
      count: agents.length
    };
  });

  // Get agent by ID
  server.get("/api/agents/:id", async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    const { id } = request.params;
    const agent = agentRegistry.getAgent(id);

    if (!agent) {
      return reply.status(404).send({ error: "Agent not found" });
    }

    // Get agent tasks
    const tasks = agentRegistry.getAgentTasks(id);

    return {
      agent,
      tasks: {
        items: tasks,
        count: tasks.length
      }
    };
  });

  // Register a new agent
  server.post("/api/agents", async (request: FastifyRequest<{
    Body: Partial<Agent>
  }>, reply: FastifyReply) => {
    const body = request.body || {};

    if (!body.id || !body.name || !body.type) {
      return reply.status(400).send({
        error: "Missing required fields: id, name, type"
      });
    }

    const agent: Agent = {
      id: body.id,
      name: body.name,
      type: body.type,
      status: body.status || "online",
      capabilities: body.capabilities || {
        skills: [],
        tools: [],
        models: [],
        maxConcurrentTasks: 10,
        supportedProtocols: ["json-rpc", "a2a"]
      },
      metadata: body.metadata || {},
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    };

    const registered = agentRegistry.register(agent);

    return reply.status(201).send({
      agent: registered,
      status: "registered"
    });
  });

  // Update agent
  server.put("/api/agents/:id", async (request: FastifyRequest<{
    Params: { id: string }
    Body: Partial<Agent>
  }>, reply: FastifyReply) => {
    const { id } = request.params;
    const body = request.body || {};
    const agent = agentRegistry.getAgent(id);

    if (!agent) {
      return reply.status(404).send({ error: "Agent not found" });
    }

    // Update status if provided
    if (body.status) {
      agentRegistry.updateStatus(id, body.status);
    }

    // Update capabilities if provided
    if (body.capabilities) {
      agent.capabilities = { ...agent.capabilities, ...body.capabilities };
    }

    // Update metadata if provided
    if (body.metadata) {
      agent.metadata = { ...agent.metadata, ...body.metadata };
    }

    agent.lastSeen = new Date().toISOString();

    return {
      agent,
      status: "updated"
    };
  });

  // Delete/unregister agent
  server.delete("/api/agents/:id", async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    const { id } = request.params;
    const success = agentRegistry.unregister(id);

    if (!success) {
      return reply.status(404).send({ error: "Agent not found" });
    }

    return {
      status: "unregistered",
      agentId: id
    };
  });

  // Create task for agent
  server.post("/api/agents/:id/tasks", async (request: FastifyRequest<{
    Params: { id: string }
    Body: { input?: Record<string, any>; priority?: string }
  }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { input, priority = "normal" } = request.body || {};

    const task = agentRegistry.createTask(id, input || {}, priority as any);

    if (!task) {
      return reply.status(400).send({
        error: "Agent not found or is offline"
      });
    }

    return reply.status(201).send({
      task,
      status: "created"
    });
  });

  // Get task status
  server.get("/api/agents/:id/tasks/:tid", async (request: FastifyRequest<{
    Params: { id: string; tid: string }
  }>, reply: FastifyReply) => {
    const { tid } = request.params;
    const task = agentRegistry.getTask(tid);

    if (!task) {
      return reply.status(404).send({ error: "Task not found" });
    }

    return { task };
  });

  // List all tasks (optionally filtered by agent)
  server.get("/api/tasks", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, any>;
    
    let tasks;
    if (query.agentId) {
      tasks = agentRegistry.getAgentTasks(query.agentId);
    } else {
      tasks = Array.from(agentRegistry.listAgents()).flatMap(a => 
        agentRegistry.getAgentTasks(a.id)
      );
    }

    // Filter by status if provided
    if (query.status) {
      tasks = tasks.filter(t => t.status === query.status);
    }

    return {
      tasks,
      count: tasks.length
    };
  });

  // Cancel task
  server.delete("/api/tasks/:id", async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    const { id } = request.params;
    const success = agentRegistry.updateTask(id, {
      status: "cancelled",
      completedAt: new Date().toISOString()
    });

    if (!success) {
      return reply.status(404).send({ error: "Task not found" });
    }

    return { status: "cancelled" };
  });

  // Broadcast to all agents
  server.post("/api/agents/broadcast", async (request: FastifyRequest<{
    Body: { message: Record<string, any>; exclude?: string[] }
  }>, reply: FastifyReply) => {
    const { message, exclude = [] } = request.body || {};
    
    const agents = agentRegistry.listAgents();
    const delivered: string[] = [];

    for (const agent of agents) {
      if (!exclude.includes(agent.id) && agent.status !== "offline") {
        delivered.push(agent.id);
      }
    }

    return {
      status: "broadcast",
      delivered,
      count: delivered.length
    };
  });

}
