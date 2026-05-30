/**
 * Skill Registry API - REST API layer for skill management
 * 
 * Provides endpoints for:
 * - Skill registration with versioning
 * - Skill discovery and search
 * - Skill status management
 * - Tenant-scoped access control
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { SkillRegistry, Skill, SkillSchema } from "./registry.js";
import { DatabaseAdapter } from "./db-adapter.js";

// Zod schemas for API request/response validation
export const CreateSkillRequestSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  description: z.string().min(1).max(1024),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Version must be semver format"),
  author: z.string().min(1).max(128),
  codeUrl: z.string().url(),
  trustScore: z.number().min(0).max(100).default(100),
  permissions: z.array(z.string()).default([]),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  tenantId: z.string().optional(),
});

export const UpdateSkillRequestSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().min(1).max(1024).optional(),
  trustScore: z.number().min(0).max(100).optional(),
  permissions: z.array(z.string()).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const SearchSkillsQuerySchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  tags: z.string().optional(), // comma-separated
  author: z.string().optional(),
  status: z.enum(["pending", "approved", "revoked"]).optional(),
  minTrustScore: z.coerce.number().min(0).max(100).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(["name", "trustScore", "createdAt", "updatedAt"]).default("trustScore"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateSkillRequest = z.infer<typeof CreateSkillRequestSchema>;
export type UpdateSkillRequest = z.infer<typeof UpdateSkillRequestSchema>;
export type SearchSkillsQuery = z.infer<typeof SearchSkillsQuerySchema>;

// API response types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SkillResponse {
  skill: Skill;
  versions: string[];
  latestVersion: string;
}

/**
 * Registers all skill registry REST API routes
 */
export async function registerSkillRegistryRoutes(
  server: FastifyInstance,
  registry: SkillRegistry,
  db: DatabaseAdapter
): Promise<void> {
  
  // Health check
  server.get("/api/v1/health", async () => {
    return {
      status: "ok",
      service: "skill-registry-api",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    };
  });

  // List all skills with pagination
  server.get("/api/v1/skills", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = SearchSkillsQuerySchema.parse(request.query);
      const result = await registry.searchSkills(db, {
        query: query.query,
        category: query.category,
        tags: query.tags?.split(",").map(t => t.trim()),
        author: query.author,
        status: query.status,
        minTrustScore: query.minTrustScore,
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      });

      return reply.status(200).send({
        data: result.skills,
        pagination: result.pagination,
      } as PaginatedResponse<Skill>);
    } catch (error: any) {
      request.log.error({ error: error.message }, "Failed to list skills");
      return reply.status(400).send({
        error: "Invalid query parameters",
        details: error.message,
      });
    }
  });

  // Get skill by ID
  server.get("/api/v1/skills/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const skill = await registry.getSkillById(db, id);

    if (!skill) {
      return reply.status(404).send({
        error: "Skill not found",
        skillId: id,
      });
    }

    const versions = await registry.getSkillVersions(db, id);

    return reply.status(200).send({
      skill,
      versions,
      latestVersion: skill.version,
    } as SkillResponse);
  });

  // Get skill by ID and version
  server.get("/api/v1/skills/:id/versions/:version", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, version } = request.params as { id: string; version: string };
    const skill = await registry.getSkillByVersion(db, id, version);

    if (!skill) {
      return reply.status(404).send({
        error: "Skill version not found",
        skillId: id,
        version,
      });
    }

    return reply.status(200).send({ skill });
  });

  // Create new skill
  server.post("/api/v1/skills", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = CreateSkillRequestSchema.parse(request.body);
      
      // Check if skill ID already exists
      const existing = await registry.getSkillById(db, input.id);
      if (existing) {
        return reply.status(409).send({
          error: "Skill ID already exists",
          skillId: input.id,
          suggestion: "Use PUT to update existing skill or create with a unique ID",
        });
      }

      const skill = await registry.registerSkill(db, {
        ...input,
        status: "pending", // New skills start as pending
      });

      request.log.info({ skillId: skill.id }, "Skill registered successfully");

      return reply.status(201).send({
        skill,
        message: "Skill registered successfully. Awaiting approval.",
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: "Validation error",
          details: error.errors,
        });
      }
      request.log.error({ error: error.message }, "Failed to register skill");
      return reply.status(500).send({
        error: "Failed to register skill",
        details: error.message,
      });
    }
  });

  // Update skill metadata
  server.put("/api/v1/skills/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const updates = UpdateSkillRequestSchema.parse(request.body);

      const skill = await registry.updateSkill(db, id, updates);
      if (!skill) {
        return reply.status(404).send({
          error: "Skill not found",
          skillId: id,
        });
      }

      request.log.info({ skillId: id }, "Skill updated successfully");

      return reply.status(200).send({ skill });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: "Validation error",
          details: error.errors,
        });
      }
      request.log.error({ error: error.message }, "Failed to update skill");
      return reply.status(500).send({
        error: "Failed to update skill",
        details: error.message,
      });
    }
  });

  // Publish new version of skill
  server.post("/api/v1/skills/:id/versions", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const versionInput = z.object({
        version: z.string().regex(/^\d+\.\d+\.\d+$/),
        codeUrl: z.string().url(),
        changelog: z.string().max(1024).optional(),
      }).parse(request.body);

      const existing = await registry.getSkillByVersion(db, id, versionInput.version);
      if (existing) {
        return reply.status(409).send({
          error: "Version already exists",
          skillId: id,
          version: versionInput.version,
          suggestion: "Use a different version number or update existing version",
        });
      }

      const baseSkill = await registry.getSkillById(db, id);
      if (!baseSkill) {
        return reply.status(404).send({
          error: "Skill not found",
          skillId: id,
        });
      }

      const newSkill = await registry.registerSkill(db, {
        ...baseSkill,
        version: versionInput.version,
        codeUrl: versionInput.codeUrl,
        id: `${id}@${versionInput.version}`,
        status: "pending",
      });

      // Create version link
      await registry.linkVersion(db, id, versionInput.version, versionInput.changelog);

      request.log.info({ skillId: id, version: versionInput.version }, "New version registered");

      return reply.status(201).send({
        skill: newSkill,
        message: `Version ${versionInput.version} registered successfully`,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: "Validation error",
          details: error.errors,
        });
      }
      request.log.error({ error: error.message }, "Failed to publish version");
      return reply.status(500).send({
        error: "Failed to publish version",
        details: error.message,
      });
    }
  });

  // Approve skill
  server.post("/api/v1/skills/:id/approve", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const success = await registry.approveSkill(db, id);

    if (!success) {
      return reply.status(404).send({
        error: "Skill not found",
        skillId: id,
      });
    }

    request.log.info({ skillId: id }, "Skill approved");

    return reply.status(200).send({
      message: "Skill approved successfully",
      skillId: id,
    });
  });

  // Revoke skill
  server.post("/api/v1/skills/:id/revoke", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const success = await registry.revokeSkillById(db, id);

    if (!success) {
      return reply.status(404).send({
        error: "Skill not found",
        skillId: id,
      });
    }

    request.log.info({ skillId: id }, "Skill revoked");

    return reply.status(200).send({
      message: "Skill revoked successfully",
      skillId: id,
    });
  });

  // Delete skill (hard delete - use revoke for soft delete)
  server.delete("/api/v1/skills/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const success = await registry.deleteSkill(db, id);

    if (!success) {
      return reply.status(404).send({
        error: "Skill not found",
        skillId: id,
      });
    }

    request.log.info({ skillId: id }, "Skill deleted");

    return reply.status(200).send({
      message: "Skill deleted successfully",
      skillId: id,
    });
  });

  // Get skill categories
  server.get("/api/v1/categories", async (request: FastifyRequest, reply: FastifyReply) => {
    const categories = await registry.getCategories(db);
    return reply.status(200).send({ categories });
  });

  // Get skill tags
  server.get("/api/v1/tags", async (request: FastifyRequest, reply: FastifyReply) => {
    const tags = await registry.getTags(db);
    return reply.status(200).send({ tags });
  });

  // Search skills (alias for GET /skills)
  server.post("/api/v1/skills/search", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const searchInput = SearchSkillsQuerySchema.parse(request.body);
      const result = await registry.searchSkills(db, searchInput);

      return reply.status(200).send({
        data: result.skills,
        pagination: result.pagination,
      } as PaginatedResponse<Skill>);
    } catch (error: any) {
      request.log.error({ error: error.message }, "Search failed");
      return reply.status(400).send({
        error: "Search failed",
        details: error.message,
      });
    }
  });
}
