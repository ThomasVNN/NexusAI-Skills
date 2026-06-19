import fastify from "fastify";
import cors from "@fastify/cors";
import { registry, policyEngine, CORS_ORIGINS } from "./shared.js";
import { ExecuteSkill } from "./runtime.js";
import { registerMCPRoutes } from "./internal/mcp/mcp_routes.js";
import { registerJSONRPCRoutes } from "./internal/mcp/jsonrpc.js";
import { registerA2ARoutes } from "./internal/a2a/routes.js";

const server = fastify({ logger: true });

// Register CORS with explicit origins configuration
// SECURITY: HIGH-003 - Never use origin: true in production
await server.register(cors, {
  origin: CORS_ORIGINS.length > 0 ? CORS_ORIGINS : false,
  methods: ["GET", "POST", "DELETE"],
  credentials: true,
});

// Register MCP routes (/api/mcp/v1/*)
await registerMCPRoutes(server);

// Register JSON-RPC routes (/api/rpc)
await registerJSONRPCRoutes(server);

// Register A2A routes (/api/agents/*)
await registerA2ARoutes(server);

// Liveness probe — returns 200 if the server is up
server.get("/healthz", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// Readiness probe — returns 200 if the registry is loaded
server.get("/ready", async (request, reply) => {
  const skills = registry.listSkills();
  const ready = skills.length >= 0; // registry is always ready once server starts

  if (ready) {
    return { status: "ok", skillsLoaded: skills.length, timestamp: new Date().toISOString() };
  }
  return reply.status(503).send({ status: "not_ready", timestamp: new Date().toISOString() });
});

// Legacy /health endpoint (kept for backwards compatibility)
server.get("/health", async () => {
  return { status: "ok", service: "nexusai-skills" };
});

// Prometheus metrics endpoint
server.get("/metrics", async () => {
  const skills = registry.listSkills();
  
  const metrics = [
    '# HELP nexusai_skills_up Whether the skills service is up',
    '# TYPE nexusai_skills_up gauge',
    'nexusai_skills_up 1',
    '',
    '# HELP nexusai_skills_registered Number of registered skills',
    '# TYPE nexusai_skills_registered gauge',
    `nexusai_skills_registered ${skills.length}`,
  ];
  
  return metrics.join('\n');
});

// List all registered skills
server.get("/api/skills", async () => {
  return registry.listSkills();
});

// Register a new skill package
server.post("/api/skills", async (request, reply) => {
  try {
    const registered = registry.registerSkill(request.body);
    return reply.status(201).send(registered);
  } catch (error: any) {
    return reply.status(400).send({
      error: "Invalid skill structure",
      details: error.message
    });
  }
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

// Execute a skill (Step 18A skill invocation lifecycle endpoint)
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
