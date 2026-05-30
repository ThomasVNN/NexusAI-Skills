import { z } from "zod";

// Extended Zod schema for validated Skill packages with full metadata
export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  author: z.string(),
  codeUrl: z.string().url(),
  trustScore: z.number().min(0).max(100).default(100),
  permissions: z.array(z.string()).default([]),
  status: z.enum(["pending", "approved", "revoked"]).default("approved"),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  tenantId: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Skill = z.infer<typeof SkillSchema>;

export interface SearchOptions {
  query?: string;
  category?: string;
  tags?: string[];
  author?: string;
  status?: "pending" | "approved" | "revoked";
  minTrustScore?: number;
  page?: number;
  limit?: number;
  sortBy?: "name" | "trustScore" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export interface SearchResult {
  skills: Skill[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Enhanced Skill Registry with database persistence and discovery capabilities
 */
export class SkillRegistry {
  /**
   * Register a new skill with database persistence
   */
  async registerSkill(db: any, skillData: Partial<Skill>): Promise<Skill> {
    const now = new Date().toISOString();
    const skill: Skill = {
      id: skillData.id!,
      name: skillData.name!,
      description: skillData.description || "",
      version: skillData.version!,
      author: skillData.author!,
      codeUrl: skillData.codeUrl!,
      trustScore: skillData.trustScore ?? 100,
      permissions: skillData.permissions || [],
      status: skillData.status || "pending",
      category: skillData.category,
      tags: skillData.tags,
      tenantId: skillData.tenantId,
      createdAt: now,
      updatedAt: now,
    };

    await db.saveSkill(skill);
    return skill;
  }

  /**
   * Get skill by base ID (returns latest version)
   */
  async getSkillById(db: any, id: string): Promise<Skill | null> {
    return await db.getSkillById(id);
  }

  /**
   * Get skill by ID and version
   */
  async getSkillByVersion(db: any, id: string, version: string): Promise<Skill | null> {
    return await db.getSkillByVersion(id, version);
  }

  /**
   * Get all versions for a skill
   */
  async getSkillVersions(db: any, id: string): Promise<string[]> {
    return await db.getVersions(id);
  }

  /**
   * List skills with pagination and filtering
   */
  async listSkills(db: any, options?: SearchOptions): Promise<SearchResult> {
    const result = await db.listSkills(options);
    return {
      skills: result.skills,
      pagination: {
        page: options?.page || 1,
        limit: options?.limit || 20,
        total: result.total,
        totalPages: Math.ceil(result.total / (options?.limit || 20)),
      },
    };
  }

  /**
   * Search skills with full-text query support
   */
  async searchSkills(db: any, query: SearchOptions): Promise<SearchResult> {
    const result = await db.searchSkills(query);
    return {
      skills: result.skills,
      pagination: {
        page: query.page || 1,
        limit: query.limit || 20,
        total: result.total,
        totalPages: Math.ceil(result.total / (query.limit || 20)),
      },
    };
  }

  /**
   * Update skill metadata
   */
  async updateSkill(db: any, id: string, updates: Partial<Skill>): Promise<Skill | null> {
    return await db.updateSkill(id, updates);
  }

  /**
   * Approve a skill
   */
  async approveSkill(db: any, id: string): Promise<boolean> {
    return await db.approveSkill(id);
  }

  /**
   * Revoke a skill
   */
  async revokeSkillById(db: any, id: string): Promise<boolean> {
    return await db.revokeSkill(id);
  }

  /**
   * Delete a skill (hard delete)
   */
  async deleteSkill(db: any, id: string): Promise<boolean> {
    return await db.deleteSkill(id);
  }

  /**
   * Link a new version to a skill
   */
  async linkVersion(db: any, id: string, version: string, changelog?: string): Promise<void> {
    return await db.linkVersion(id, version, changelog);
  }

  /**
   * Get all available categories
   */
  async getCategories(db: any): Promise<string[]> {
    return await db.getCategories();
  }

  /**
   * Get all available tags
   */
  async getTags(db: any): Promise<string[]> {
    return await db.getTags();
  }
}

// Backward compatibility: Legacy in-memory registry methods
export class LegacySkillRegistry {
  private skills = new Map<string, Skill>();

  constructor() {
    // Seed with core legal tools
    this.registerSkill({
      id: "vietnam-law-citations",
      name: "Vietnam Law Citation Matcher",
      description: "Extracts and visualizes legal citation paths for banking & IT domains",
      version: "1.0.0",
      author: "NexusAI Architect",
      codeUrl: "http://skills-nexus/cdn/citation-matcher.js",
      trustScore: 98,
      permissions: ["read:knowledge", "write:citations"],
      status: "approved"
    });
  }

  public registerSkill(skillData: unknown): Skill {
    const parsed = SkillSchema.parse(skillData);
    this.skills.set(parsed.id, parsed);
    return parsed;
  }

  public getSkill(id: string): Skill | null {
    return this.skills.get(id) || null;
  }

  public listSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  public revokeSkill(id: string): boolean {
    const skill = this.skills.get(id);
    if (skill) {
      skill.status = "revoked";
      this.skills.set(id, skill);
      return true;
    }
    return false;
  }
}
