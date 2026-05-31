import fastify from "fastify";
import cors from "@fastify/cors";
import { registry, policyEngine } from "./shared.js";
import { ExecuteSkill, globalRuntime } from "./runtime.js";
import { Skill, SkillCategory } from "./registry.js";

const server = fastify({ logger: true });

// Register CORS for multi-domain calls
await server.register(cors, {
  origin: true,
  methods: ["GET", "POST", "DELETE", "PUT"]
});

// Health endpoint
server.get("/health", async () => {
  return { status: "ok", service: "nexusai-skills" };
});

// ==================== SKILLS API ====================

// List all registered skills
server.get("/api/skills", async (request) => {
  const { category } = request.query as { category?: SkillCategory };
  return registry.listSkills(category);
});

// Get a specific skill
server.get("/api/skills/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const skill = registry.getSkill(id);

  if (!skill) {
    return reply.status(404).send({ error: "Skill not found" });
  }

  return skill;
});

// Update skill configuration
server.put<{ Params: { id: string } }>("/api/skills/:id/config", async (request, reply) => {
  const { id } = request.params;
  const config = request.body as {
    enabled?: boolean;
    rateLimitPerMinute?: number;
    requiresHumanApproval?: boolean;
  };

  const skill = registry.getSkill(id);
  if (!skill) {
    return reply.status(404).send({ error: "Skill not found" });
  }

  registry.updateSkillConfig(id, config);
  return registry.getSkill(id);
});

// Enable a skill
server.post<{ Params: { id: string } }>("/api/skills/:id/enable", async (request, reply) => {
  const { id } = request.params;
  const success = registry.updateSkillStatus(id, "approved");

  if (!success) {
    return reply.status(404).send({ error: "Skill not found" });
  }

  return { message: "Skill enabled" };
});

// Disable a skill
server.post<{ Params: { id: string } }>("/api/skills/:id/disable", async (request, reply) => {
  const { id } = request.params;
  const success = registry.updateSkillConfig(id, { enabled: false });

  if (!success) {
    return reply.status(404).send({ error: "Skill not found" });
  }

  return { message: "Skill disabled" };
});

// Evaluate execution safety policy
server.post("/api/skills/:id/evaluate", async (request, reply) => {
  const { id } = request.params as { id: string };
  const skill = registry.getSkill(id);

  if (!skill) {
    return reply.status(404).send({ error: "Skill not found" });
  }

  const evaluation = policyEngine.evaluateSkillPolicy(skill);
  return evaluation;
});

// Revoke a skill
server.delete("/api/skills/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const success = registry.revokeSkill(id);

  if (!success) {
    return reply.status(404).send({ error: "Skill not found" });
  }

  return { message: "Skill successfully revoked" };
});

// ==================== EXECUTION API ====================

// Execute a skill
server.post("/api/skills/execute", async (request, reply) => {
  try {
    const executionResponse = await ExecuteSkill(request.body);
    const httpSuccess = executionResponse.status === "success";
    const statusCode = executionResponse.status === "forbidden"
      ? 403
      : (executionResponse.status === "failed" ? 400 : 200);

    return reply.status(statusCode).send({
      success: httpSuccess,
      data: executionResponse.result,
      meta: executionResponse.audit,
      error: executionResponse.error || null
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      data: null,
      meta: {
        requestedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      },
      error: `Internal server error during execution: ${error.message}`
    });
  }
});

// List executions
server.get("/api/skills/executions", async (request) => {
  const { skillId, state, limit, offset } = request.query as {
    skillId?: string;
    state?: string;
    limit?: number;
    offset?: number;
  };

  return registry.listExecutions({
    skillId,
    state: state as any,
    limit,
    offset
  });
});

// Get execution details
server.get("/api/skills/executions/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const execution = registry.getExecution(id);

  if (!execution) {
    return reply.status(404).send({ error: "Execution not found" });
  }

  return execution;
});

// Approve execution
server.post<{ Params: { id: string } }>("/api/skills/executions/:id/approve", async (request, reply) => {
  const { id } = request.params;
  const { reason } = request.body as { reason?: string };

  const success = registry.approveExecution(id, "admin", reason);

  if (!success) {
    return reply.status(404).send({ error: "Execution not found or not pending approval" });
  }

  return { message: "Execution approved" };
});

// Reject execution
server.post<{ Params: { id: string } }>("/api/skills/executions/:id/reject", async (request, reply) => {
  const { id } = request.params;
  const { reason } = request.body as { reason: string };

  if (!reason) {
    return reply.status(400).send({ error: "Rejection reason is required" });
  }

  const success = registry.rejectExecution(id, "admin", reason);

  if (!success) {
    return reply.status(404).send({ error: "Execution not found or not pending approval" });
  }

  return { message: "Execution rejected" };
});

// ==================== APPROVALS API ====================

// Get pending approvals
server.get("/api/skills/approvals/pending", async () => {
  const pending = registry.getApprovalQueue();
  return pending.map(exec => ({
    id: exec.id,
    skillId: exec.skillId,
    skillName: exec.skillName,
    userId: exec.userId,
    params: exec.params,
    requestedAt: exec.startedAt
  }));
});

// ==================== ANALYTICS API ====================

// Get analytics
server.get("/api/skills/analytics", async (request) => {
  const { skillId } = request.query as { skillId?: string };
  return registry.getAnalytics(skillId);
});

// Get execution stats
server.get("/api/skills/stats", async () => {
  return registry.getExecutionStats();
});

// Get queue status
server.get("/api/skills/queue", async () => {
  return globalRuntime.getQueueStatus();
});

// ==================== MCP TOOLS API ====================

// Get available MCP tools
server.get("/api/tools", async () => {
  // This would integrate with the skill-registry in production
  return [
    { name: "database_query", description: "Execute SQL queries" },
    { name: "data_transform", description: "Transform data formats" },
    { name: "api_fetch", description: "Fetch from HTTP APIs" },
    { name: "data_validation", description: "Validate data quality" },
    { name: "analytics_query", description: "Analytics aggregations" },
    { name: "legal_citation", description: "Extract legal citations" },
    { name: "legal_search", description: "Search legal databases" },
    { name: "contract_analyzer", description: "Analyze contracts" },
    { name: "regulation_lookup", description: "Look up regulations" },
    { name: "compliance_check", description: "Check compliance" },
    { name: "code_generator", description: "Generate code" },
    { name: "code_review", description: "Review code" },
    { name: "code_explainer", description: "Explain code" },
    { name: "test_generator", description: "Generate tests" },
    { name: "refactor_suggester", description: "Suggest refactoring" },
  ];
});

// Bootstrap server
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 8083;
    await server.listen({ port, host: "0.0.0.0" });
    console.log(`🚀 NexusAI-Skills Server listening on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

// Export runtime API for internal programmatic consumption
export { ExecuteSkill, globalRuntime, RuntimeEngine } from "./runtime.js";
export { registry } from "./shared.js";
