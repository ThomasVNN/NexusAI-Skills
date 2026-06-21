/**
 * NexusAI Skills - Skill CRUD Routes
 * 
 * RESTful API endpoints for skill management with PostgreSQL persistence.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getStorage } from "../storage.js";
import { 
  CreateSkillSchema, 
  SkillSearchSchema, 
  type CreateSkillInput,
  type SkillSearchFilters 
} from "../registry.js";
import { z } from "zod";

// Request type definitions
interface GetSkillParams {
  id: string;
}

interface UpdateSkillBody {
  name?: string;
  description?: string;
  capability?: string;
  tags?: string[];
  content?: string;
  version?: string;
  author?: string;
  codeUrl?: string;
  trustScore?: number;
  permissions?: string[];
  status?: "pending" | "approved" | "revoked";
}

interface CreateSkillBody {
  name: string;
  description?: string;
  capability?: string;
  tags?: string[];
  content?: string;
  version: string;
  author?: string;
  codeUrl: string;
  trustScore?: number;
  permissions?: string[];
  status?: "pending" | "approved" | "revoked";
}

interface SearchQuery {
  name?: string;
  tags?: string;
  capability?: string;
  limit?: string;
}

/**
 * Register skill CRUD routes with Fastify
 */
export async function registerSkillRoutes(server: FastifyInstance): Promise<void> {
  const storage = getStorage();

  // ============================================
  // GET /skills - List all skills with optional filters
  // ============================================
  server.get("/skills", async (request: FastifyRequest<{ Querystring: SearchQuery }>, reply: FastifyReply) => {
    try {
      const query = request.query;
      
      // Parse query parameters
      const filters: SkillSearchFilters = {};
      if (query.name) filters.name = query.name;
      if (query.capability) filters.capability = query.capability;
      if (query.tags) filters.tags = query.tags.split(",").map(t => t.trim());

      const skills = await storage.listSkills(filters);
      
      return reply.send({
        success: true,
        data: skills,
        count: skills.length,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: "Failed to list skills",
        details: error.message,
      });
    }
  });

  // ============================================
  // POST /skills - Create a new skill
  // ============================================
  server.post("/skills", async (request: FastifyRequest<{ Body: CreateSkillBody }>, reply: FastifyReply) => {
    try {
      // Validate input
      const parsed = CreateSkillSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: "Invalid skill data",
          details: parsed.error.errors,
        });
      }

      const skillInput = parsed.data;
      
      // Generate ID if not provided
      const skill = {
        ...skillInput,
        id: skillInput.id || crypto.randomUUID(),
      };

      // Save to storage
      await storage.saveSkill(skill);

      return reply.status(201).send({
        success: true,
        data: skill,
        message: "Skill created successfully",
      });
    } catch (error: any) {
      request.log.error(error);
      
      // Handle duplicate name error
      if (error.code === "P2002") {
        return reply.status(409).send({
          success: false,
          error: "Skill with this name already exists",
        });
      }

      return reply.status(500).send({
        success: false,
        error: "Failed to create skill",
        details: error.message,
      });
    }
  });

  // ============================================
  // GET /skills/:id - Get a skill by ID
  // ============================================
  server.get<{ Params: GetSkillParams }>(
    "/skills/:id",
    async (request, reply) => {
      try {
        const { id } = request.params;
        const skill = await storage.getSkill(id);

        if (!skill) {
          return reply.status(404).send({
            success: false,
            error: "Skill not found",
          });
        }

        return reply.send({
          success: true,
          data: skill,
        });
      } catch (error: any) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: "Failed to get skill",
          details: error.message,
        });
      }
    }
  );

  // ============================================
  // PUT /skills/:id - Update a skill
  // ============================================
  server.put<{ Params: GetSkillParams; Body: UpdateSkillBody }>(
    "/skills/:id",
    async (request, reply) => {
      try {
        const { id } = request.params;
        const updates = request.body;

        // Check if skill exists
        const existing = await storage.getSkill(id);
        if (!existing) {
          return reply.status(404).send({
            success: false,
            error: "Skill not found",
          });
        }

        // Update skill
        const updated = await storage.updateSkill(id, updates);

        return reply.send({
          success: true,
          data: updated,
          message: "Skill updated successfully",
        });
      } catch (error: any) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: "Failed to update skill",
          details: error.message,
        });
      }
    }
  );

  // ============================================
  // DELETE /skills/:id - Delete a skill
  // ============================================
  server.delete<{ Params: GetSkillParams }>(
    "/skills/:id",
    async (request, reply) => {
      try {
        const { id } = request.params;
        const deleted = await storage.deleteSkill(id);

        if (!deleted) {
          return reply.status(404).send({
            success: false,
            error: "Skill not found",
          });
        }

        return reply.send({
          success: true,
          message: "Skill deleted successfully",
        });
      } catch (error: any) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: "Failed to delete skill",
          details: error.message,
        });
      }
    }
  );

  // ============================================
  // GET /skills/:id/versions - Get version history
  // ============================================
  server.get<{ Params: GetSkillParams }>(
    "/skills/:id/versions",
    async (request, reply) => {
      try {
        const { id } = request.params;
        
        // Check if skill exists
        const skill = await storage.getSkill(id);
        if (!skill) {
          return reply.status(404).send({
            success: false,
            error: "Skill not found",
          });
        }

        const versions = await storage.getSkillVersions(id);

        return reply.send({
          success: true,
          data: versions,
          count: versions.length,
        });
      } catch (error: any) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: "Failed to get skill versions",
          details: error.message,
        });
      }
    }
  );

  // ============================================
  // GET /skills/:id/executions - Get execution history
  // ============================================
  server.get<{ Params: GetSkillParams; Querystring: SearchQuery }>(
    "/skills/:id/executions",
    async (request, reply) => {
      try {
        const { id } = request.params;
        const limit = parseInt(request.query.limit || "100", 10);

        // Check if skill exists
        const skill = await storage.getSkill(id);
        if (!skill) {
          return reply.status(404).send({
            success: false,
            error: "Skill not found",
          });
        }

        const executions = await storage.getExecutions(id, limit);

        return reply.send({
          success: true,
          data: executions,
          count: executions.length,
        });
      } catch (error: any) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: "Failed to get skill executions",
          details: error.message,
        });
      }
    }
  );

  console.log("✅ Skill CRUD routes registered");
}
