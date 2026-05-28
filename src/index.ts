import fastify from "fastify";
import cors from "@fastify/cors";
import { SkillRegistry } from "./registry.js";
import { PolicyEngine } from "./policy.js";

const server = fastify({ logger: true });
const registry = new SkillRegistry();
const policyEngine = new PolicyEngine();

// Register CORS for multi-domain calls
await server.register(cors, {
  origin: true,
  methods: ["GET", "POST", "DELETE"]
});

// Health endpoint
server.get("/health", async () => {
  return { status: "ok", service: "nexusai-skills" };
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
