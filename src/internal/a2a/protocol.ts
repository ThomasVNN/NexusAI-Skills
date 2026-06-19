/**
 * A2A Protocol - Agent-to-Agent Communication
 * JSON-RPC 2.0 Implementation
 */

// ============================================================
// A2A TYPES
// ============================================================

export type AgentStatus = "online" | "busy" | "offline";
export type AgentType = 
  | "gateway-agent"
  | "provider-agent"
  | "skill-agent"
  | "knowledge-agent"
  | "safety-agent"
  | "cost-agent"
  | "combo-agent";

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  capabilities: AgentCapabilities;
  metadata: Record<string, any>;
  lastSeen: string;
  registeredAt: string;
}

export interface AgentCapabilities {
  skills: string[];
  tools: string[];
  models: string[];
  maxConcurrentTasks: number;
  supportedProtocols: string[];
}

export interface AgentTask {
  id: string;
  agentId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  priority: "low" | "normal" | "high" | "critical";
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

// JSON-RPC 2.0 Types
export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: Record<string, any>;
}

export interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: any;
  error?: JSONRPCError;
}

export interface JSONRPCError {
  code: number;
  message: string;
  data?: any;
}

export interface JSONRPCBatchRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: Record<string, any>;
}

// ============================================================
// A2A ERROR CODES
// ============================================================

export const A2A_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  AGENT_NOT_FOUND: -32001,
  AGENT_OFFLINE: -32002,
  TASK_NOT_FOUND: -32003,
  TASK_FAILED: -32004,
};

// ============================================================
// AGENT REGISTRY
// ============================================================

export class AgentRegistry {
  private agents: Map<string, Agent> = new Map();
  private tasks: Map<string, AgentTask> = new Map();

  /**
   * Register a new agent
   */
  register(agent: Agent): Agent {
    agent.registeredAt = agent.registeredAt || new Date().toISOString();
    agent.lastSeen = new Date().toISOString();
    this.agents.set(agent.id, agent);
    return agent;
  }

  /**
   * Unregister an agent
   */
  unregister(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  /**
   * Update agent status
   */
  updateStatus(agentId: string, status: AgentStatus): boolean {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      agent.lastSeen = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * List all agents with optional filtering
   */
  listAgents(filter?: {
    type?: AgentType;
    status?: AgentStatus;
  }): Agent[] {
    let agents = Array.from(this.agents.values());

    if (filter?.type) {
      agents = agents.filter(a => a.type === filter.type);
    }

    if (filter?.status) {
      agents = agents.filter(a => a.status === filter.status);
    }

    return agents;
  }

  /**
   * Find agents by capability
   */
  findByCapability(capability: string): Agent[] {
    return Array.from(this.agents.values()).filter(agent => {
      if (agent.capabilities.skills.includes(capability)) return true;
      if (agent.capabilities.tools.includes(capability)) return true;
      if (agent.capabilities.models.includes(capability)) return true;
      return false;
    });
  }

  /**
   * Create a task for an agent
   */
  createTask(agentId: string, input: Record<string, any>, priority: AgentTask["priority"] = "normal"): AgentTask | null {
    const agent = this.agents.get(agentId);
    if (!agent || agent.status === "offline") {
      return null;
    }

    const task: AgentTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      agentId,
      status: "pending",
      priority,
      input,
      createdAt: new Date().toISOString()
    };

    this.tasks.set(task.id, task);
    return task;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): AgentTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Update task status
   */
  updateTask(taskId: string, updates: Partial<AgentTask>): boolean {
    const task = this.tasks.get(taskId);
    if (task) {
      Object.assign(task, updates);
      return true;
    }
    return false;
  }

  /**
   * Get tasks for an agent
   */
  getAgentTasks(agentId: string): AgentTask[] {
    return Array.from(this.tasks.values())
      .filter(t => t.agentId === agentId)
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }

  /**
   * Broadcast to all agents
   */
  broadcast(message: Record<string, any>): string[] {
    const agentIds: string[] = [];
    for (const agent of this.agents.values()) {
      if (agent.status !== "offline") {
        agentIds.push(agent.id);
      }
    }
    return agentIds;
  }
}

// Global agent registry instance
export const agentRegistry = new AgentRegistry();

// ============================================================
// DEFAULT AGENTS
// ============================================================

export function initializeDefaultAgents(): void {
  const defaultAgents: Agent[] = [
    {
      id: "gateway-agent",
      name: "Gateway Agent",
      type: "gateway-agent",
      status: "online",
      capabilities: {
        skills: ["routing", "load-balancing", "rate-limiting"],
        tools: ["route.list", "route.create", "strategy.list"],
        models: ["gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet"],
        maxConcurrentTasks: 100,
        supportedProtocols: ["json-rpc", "a2a"]
      },
      metadata: { version: "1.0.0" },
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    },
    {
      id: "provider-agent",
      name: "Provider Agent",
      type: "provider-agent",
      status: "online",
      capabilities: {
        skills: ["provider-management", "health-checking"],
        tools: ["provider.list", "provider.health", "provider.metrics"],
        models: [],
        maxConcurrentTasks: 50,
        supportedProtocols: ["json-rpc", "a2a"]
      },
      metadata: { version: "1.0.0" },
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    },
    {
      id: "skill-agent",
      name: "Skill Agent",
      type: "skill-agent",
      status: "online",
      capabilities: {
        skills: ["skill-execution", "policy-evaluation"],
        tools: ["skill.list", "skill.execute", "skill.status"],
        models: [],
        maxConcurrentTasks: 200,
        supportedProtocols: ["json-rpc", "a2a", "mcp"]
      },
      metadata: { version: "1.0.0" },
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    },
    {
      id: "knowledge-agent",
      name: "Knowledge Agent",
      type: "knowledge-agent",
      status: "online",
      capabilities: {
        skills: ["knowledge-search", "document-ingestion"],
        tools: ["knowledge.search", "knowledge.ingest", "knowledge.list"],
        models: [],
        maxConcurrentTasks: 50,
        supportedProtocols: ["json-rpc", "a2a"]
      },
      metadata: { version: "1.0.0" },
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    },
    {
      id: "safety-agent",
      name: "Safety Agent",
      type: "safety-agent",
      status: "online",
      capabilities: {
        skills: ["content-safety", "policy-enforcement"],
        tools: ["health.alerts", "health.circuit_breakers"],
        models: [],
        maxConcurrentTasks: 100,
        supportedProtocols: ["json-rpc", "a2a"]
      },
      metadata: { version: "1.0.0" },
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    },
    {
      id: "cost-agent",
      name: "Cost Agent",
      type: "cost-agent",
      status: "online",
      capabilities: {
        skills: ["cost-tracking", "budget-management"],
        tools: ["health.costs", "user.quota", "model.pricing"],
        models: [],
        maxConcurrentTasks: 50,
        supportedProtocols: ["json-rpc", "a2a"]
      },
      metadata: { version: "1.0.0" },
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    },
    {
      id: "combo-agent",
      name: "Combo Agent",
      type: "combo-agent",
      status: "online",
      capabilities: {
        skills: ["combo-scoring", "fallback-management"],
        tools: ["model.routing", "provider.rebalance"],
        models: ["gpt-4o-mini", "claude-3-5-haiku", "gemini-1.5-flash"],
        maxConcurrentTasks: 75,
        supportedProtocols: ["json-rpc", "a2a"]
      },
      metadata: { version: "1.0.0" },
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    }
  ];

  defaultAgents.forEach(agent => agentRegistry.register(agent));
}

// ============================================================
// A2A JSON-RPC HANDLER
// ============================================================

export class A2AHandler {
  private registry: AgentRegistry;

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  /**
   * Handle incoming JSON-RPC request
   */
  async handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      switch (request.method) {
        // Agent methods
        case "agent.list":
          return this.handleAgentList(request);
        case "agent.get":
          return this.handleAgentGet(request);
        case "agent.register":
          return this.handleAgentRegister(request);
        case "agent.update":
          return this.handleAgentUpdate(request);
        case "agent.unregister":
          return this.handleAgentUnregister(request);
        case "agent.find":
          return this.handleAgentFind(request);

        // Task methods
        case "task.create":
          return this.handleTaskCreate(request);
        case "task.get":
          return this.handleTaskGet(request);
        case "task.update":
          return this.handleTaskUpdate(request);
        case "task.list":
          return this.handleTaskList(request);
        case "task.cancel":
          return this.handleTaskCancel(request);

        // Broadcast
        case "broadcast":
          return this.handleBroadcast(request);

        // Ping
        case "ping":
          return this.handlePing(request);

        default:
          return this.createError(
            request.id,
            A2A_ERROR_CODES.METHOD_NOT_FOUND,
            `Method '${request.method}' not found`
          );
      }
    } catch (error: any) {
      return this.createError(
        request.id,
        A2A_ERROR_CODES.INTERNAL_ERROR,
        error.message
      );
    }
  }

  // Agent handlers
  private handleAgentList(request: JSONRPCRequest): JSONRPCResponse {
    const params = request.params || {};
    const agents = this.registry.listAgents({
      type: params.type,
      status: params.status
    });

    return {
      jsonrpc: "2.0",
      id: request.id,
      result: { agents, count: agents.length }
    };
  }

  private handleAgentGet(request: JSONRPCRequest): JSONRPCResponse {
    const params = request.params || {};
    const agent = this.registry.getAgent(params.agentId);

    if (!agent) {
      return this.createError(
        request.id,
        A2A_ERROR_CODES.AGENT_NOT_FOUND,
        `Agent '${params.agentId}' not found`
      );
    }

    return {
      jsonrpc: "2.0",
      id: request.id,
      result: { agent }
    };
  }

  private handleAgentRegister(request: JSONRPCRequest): JSONRPCResponse {
    const params = request.params || {};
    const agent: Agent = {
      id: params.id,
      name: params.name,
      type: params.type,
      status: params.status || "online",
      capabilities: params.capabilities || { skills: [], tools: [], models: [], maxConcurrentTasks: 10, supportedProtocols: [] },
      metadata: params.metadata || {},
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    };

    const registered = this.registry.register(agent);

    return {
      jsonrpc: "2.0",
      id: request.id,
      result: { agent: registered }
    };
  }

  private handleAgentUpdate(request: JSONRPCRequest): JSONRPCResponse {
    const params = request.params || {};
    const success = this.registry.updateStatus(params.agentId, params.status);

    if (!success) {
      return this.createError(
        request.id,
        A2A_ERROR_CODES.AGENT_NOT_FOUND,
        `Agent '${params.agentId}' not found`
      );
    }

    const agent = this.registry.getAgent(params.agentId);

    return {
      jsonrpc: "2.0",
      id: request.id,
      result: { agent }
    };
  }

  private handleAgentUnregister(request: JSONRPCRequest): JSONRPCResponse {
    const params = request.params || {};
    const success = this.registry.unregister(params.agentId);

    return {
      jsonrpc: "2.0",
      id: request.id,
      result: { success }
    };
  }

  private handleAgentFind(request: JSONRPCRequest): JSONRPCResponse {
    const params = request.params || {};
    const agents = this.registry.findByCapability(params.capability);

    return {
      jsonrpc: "2.0",
      id: request.id,
      result: { agents, count: agents.length }
    };
  }

  // Task handlers
  private handleTaskCreate(request: JSONRPCRequest): JSONRPCResponse {
    const params = request.params || {};
    const task = this.registry.createTask(
      params.agentId,
      params.input || {},
      params.priority || "normal"
    );

    if (!task) {
      return this.createError(
        request.id,
        A2A_ERROR_CODES.AGENT_OFFLINE,
        `Agent '${params.agentId}' is offline or not found`
      );
    }

    return {
      jsonrpc: "2.0",
      id: request.id,
      result: { task }
    };
  }

  private handleTaskGet(request: JSONRPCRequest): JSONRPCResponse {
    const params = request.params || {};
    const task = this.registry.getTask(params.taskId);

    if (!task) {
      return this.createError(
        request.id,
        A2A_ERROR_CODES.TASK_NOT_FOUND,
        `Task '${params.taskId}' not found`
      );
    }

    return {
      jsonrpc: "2.0",
      id: request.id,
      result: { task }
    };
  }

  private handleTaskUpdate(request: JSONRPCRequest): JSONRPCResponse {
    const params = request.params || {};
    const success = this.registry.updateTask(params.taskId, params.updates);

    if (!success) {
      return this.createError(
        request.id,
        A2A_ERROR_CODES.TASK_NOT_FOUND,
        `Task '${params.taskId}' not found`
      );
    }

    const task = this.registry.getTask(params.taskId);

    return {
      jsonrpc: "2.0",
      id: request.id,
      result: { task }
    };
  }

  private handleTaskList(request: JSONRPCRequest): JSONRPCResponse {
    const params = request.params || {};
    const tasks = params.agentId
      ? this.registry.getAgentTasks(params.agentId)
      : Array.from(new AgentRegistry().listAgents()).flatMap(a => this.registry.getAgentTasks(a.id));

    return {
      jsonrpc: "2.0",
      id: request.id,
      result: { tasks, count: tasks.length }
    };
  }

  private handleTaskCancel(request: JSONRPCRequest): JSONRPCResponse {
    const params = request.params || {};
    const success = this.registry.updateTask(params.taskId, {
      status: "cancelled",
      completedAt: new Date().toISOString()
    });

    return {
      jsonrpc: "2.0",
      id: request.id,
      result: { success }
    };
  }

  // Broadcast
  private handleBroadcast(request: JSONRPCRequest): JSONRPCResponse {
    const params = request.params || {};
    const agentIds = this.registry.broadcast(params.message || {});

    return {
      jsonrpc: "2.0",
      id: request.id,
      result: { delivered: agentIds, count: agentIds.length }
    };
  }

  // Ping
  private handlePing(request: JSONRPCRequest): JSONRPCResponse {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: { pong: true, timestamp: new Date().toISOString() }
    };
  }

  // Error helper
  private createError(id: string | number | null, code: number, message: string): JSONRPCResponse {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message
      }
    };
  }
}

// Global A2A handler instance
export const a2aHandler = new A2AHandler(agentRegistry);
