/**
 * NexusAI Skills - Storage Abstraction
 * 
 * Storage interface with two implementations:
 * - InMemorySkillStorage: Development/testing (no external dependencies)
 * - PrismaSkillStorage: Production with PostgreSQL persistence
 */

import { Skill } from "./registry.js";
import { getPrismaClient } from "./db.js";
import { skillExecutionsTotal } from "./metrics.js";

// Re-export types for convenience
export { Skill } from "./registry.js";

/**
 * Skill execution record for persistence
 */
export interface SkillExecutionRecord {
  id?: string;
  skillId: string;
  userId?: string;
  toolName?: string;
  status: "success" | "failed" | "forbidden";
  error?: string;
  durationMs?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  policyCheck?: Record<string, unknown>;
  createdAt?: Date;
}

/**
 * Skill version record for version history
 */
export interface SkillVersionRecord {
  id?: string;
  skillId: string;
  version: string;
  changes?: string;
  content?: string;
  createdAt?: Date;
}

/**
 * Storage interface for skill persistence
 */
export interface SkillStorage {
  /**
   * Save a skill to storage
   */
  saveSkill(skill: Skill): Promise<void>;

  /**
   * Get a skill by ID
   */
  getSkill(id: string): Promise<Skill | null>;

  /**
   * Get a skill by name
   */
  getSkillByName(name: string): Promise<Skill | null>;

  /**
   * List all skills with optional filters
   */
  listSkills(filters?: { name?: string; tags?: string[]; capability?: string }): Promise<Skill[]>;

  /**
   * Update a skill
   */
  updateSkill(id: string, skill: Partial<Skill>): Promise<Skill | null>;

  /**
   * Delete a skill
   */
  deleteSkill(id: string): Promise<boolean>;

  /**
   * Get version history for a skill
   */
  getSkillVersions(skillId: string): Promise<SkillVersionRecord[]>;

  /**
   * Save a skill version
   */
  saveSkillVersion(version: SkillVersionRecord): Promise<void>;

  /**
   * Save a skill execution record
   */
  saveExecution(execution: SkillExecutionRecord): Promise<void>;

  /**
   * Get execution records for a skill
   */
  getExecutions(skillId: string, limit?: number): Promise<SkillExecutionRecord[]>;

  /**
   * Initialize storage (if needed)
   */
  initialize(): Promise<void>;
}

/**
 * In-memory storage implementation for development/testing
 */
export class InMemorySkillStorage implements SkillStorage {
  private skills: Map<string, Skill> = new Map();
  private executions: SkillExecutionRecord[] = [];
  private versions: SkillVersionRecord[] = [];

  async initialize(): Promise<void> {
    // No initialization needed for in-memory storage
    // Seed with default skill
    if (this.skills.size === 0) {
      const defaultSkill: Skill = {
        id: "vietnam-law-citations",
        name: "Vietnam Law Citation Matcher",
        description: "Extracts and visualizes legal citation paths for banking & IT domains",
        capability: "legal-research",
        tags: ["legal", "vietnam", "citations"],
        content: "Skill for extracting and visualizing legal citation paths",
        version: "1.0.0",
        author: "NexusAI Architect",
        codeUrl: "http://skills-nexus/cdn/citation-matcher.js",
        trustScore: 98,
        permissions: ["read:knowledge", "write:citations"],
        status: "approved",
      };
      this.skills.set(defaultSkill.id, defaultSkill);
    }
  }

  async saveSkill(skill: Skill): Promise<void> {
    this.skills.set(skill.id, { ...skill });
  }

  async getSkill(id: string): Promise<Skill | null> {
    return this.skills.get(id) || null;
  }

  async getSkillByName(name: string): Promise<Skill | null> {
    for (const skill of this.skills.values()) {
      if (skill.name === name) {
        return skill;
      }
    }
    return null;
  }

  async listSkills(filters?: { name?: string; tags?: string[]; capability?: string }): Promise<Skill[]> {
    let skills = Array.from(this.skills.values());

    if (filters?.name) {
      const nameLower = filters.name.toLowerCase();
      skills = skills.filter(s => s.name.toLowerCase().includes(nameLower));
    }
    if (filters?.tags && filters.tags.length > 0) {
      skills = skills.filter(s =>
        filters.tags!.some(tag => s.tags.includes(tag))
      );
    }
    if (filters?.capability) {
      skills = skills.filter(s => s.capability === filters.capability);
    }

    return skills;
  }

  async updateSkill(id: string, updates: Partial<Skill>): Promise<Skill | null> {
    const existing = this.skills.get(id);
    if (!existing) return null;

    const updated = { ...existing, ...updates };
    this.skills.set(id, updated);
    return updated;
  }

  async deleteSkill(id: string): Promise<boolean> {
    return this.skills.delete(id);
  }

  async saveSkillVersion(version: SkillVersionRecord): Promise<void> {
    this.versions.push({
      ...version,
      id: version.id || crypto.randomUUID(),
      createdAt: version.createdAt || new Date(),
    });
  }

  async getSkillVersions(skillId: string): Promise<SkillVersionRecord[]> {
    return this.versions
      .filter(v => v.skillId === skillId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async saveExecution(execution: SkillExecutionRecord): Promise<void> {
    this.executions.push({
      ...execution,
      id: execution.id || crypto.randomUUID(),
      createdAt: execution.createdAt || new Date(),
    });
  }

  async getExecutions(skillId: string, limit = 100): Promise<SkillExecutionRecord[]> {
    return this.executions
      .filter((e) => e.skillId === skillId)
      .slice(-limit);
  }
}

/**
 * Prisma-based storage for production with PostgreSQL
 */
export class PrismaSkillStorage implements SkillStorage {
  async initialize(): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.$connect();
    console.log("✅ PrismaSkillStorage: Connected to PostgreSQL");
  }

  async saveSkill(skill: Skill): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.skill.upsert({
      where: { id: skill.id },
      update: {
        name: skill.name,
        description: skill.description,
        capability: skill.capability,
        tags: skill.tags,
        content: skill.content,
        version: skill.version,
        author: skill.author,
        codeUrl: skill.codeUrl,
        trustScore: skill.trustScore,
        permissions: skill.permissions,
        status: skill.status,
      },
      create: {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        capability: skill.capability,
        tags: skill.tags,
        content: skill.content,
        version: skill.version,
        author: skill.author,
        codeUrl: skill.codeUrl,
        trustScore: skill.trustScore,
        permissions: skill.permissions,
        status: skill.status,
      },
    });
  }

  async getSkill(id: string): Promise<Skill | null> {
    const prisma = getPrismaClient();
    const skill = await prisma.skill.findUnique({ where: { id } });
    return skill ? this.mapPrismaToSkill(skill) : null;
  }

  async getSkillByName(name: string): Promise<Skill | null> {
    const prisma = getPrismaClient();
    const skill = await prisma.skill.findUnique({ where: { name } });
    return skill ? this.mapPrismaToSkill(skill) : null;
  }

  async listSkills(filters?: { name?: string; tags?: string[]; capability?: string }): Promise<Skill[]> {
    const prisma = getPrismaClient();
    const whereClause: any = {};

    if (filters?.name) {
      whereClause.name = { contains: filters.name, mode: "insensitive" };
    }
    if (filters?.tags && filters.tags.length > 0) {
      whereClause.tags = { hasSome: filters.tags };
    }
    if (filters?.capability) {
      whereClause.capability = filters.capability;
    }

    const skills = await prisma.skill.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    });
    return skills.map(this.mapPrismaToSkill);
  }

  async updateSkill(id: string, updates: Partial<Skill>): Promise<Skill | null> {
    const prisma = getPrismaClient();

    // Get current skill to save version before updating
    const currentSkill = await prisma.skill.findUnique({ where: { id } });
    if (currentSkill) {
      // Save version history
      await prisma.skillVersion.create({
        data: {
          skillId: id,
          version: currentSkill.version,
          content: currentSkill.content || undefined,
        },
      });
    }

    const skill = await prisma.skill.update({
      where: { id },
      data: {
        name: updates.name,
        description: updates.description,
        capability: updates.capability,
        tags: updates.tags,
        content: updates.content,
        version: updates.version,
        author: updates.author,
        codeUrl: updates.codeUrl,
        trustScore: updates.trustScore,
        permissions: updates.permissions,
        status: updates.status,
      },
    });
    return this.mapPrismaToSkill(skill);
  }

  async deleteSkill(id: string): Promise<boolean> {
    const prisma = getPrismaClient();
    try {
      await prisma.skill.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async saveSkillVersion(version: SkillVersionRecord): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.skillVersion.create({
      data: {
        skillId: version.skillId,
        version: version.version,
        changes: version.changes,
        content: version.content,
      },
    });
  }

  async getSkillVersions(skillId: string): Promise<SkillVersionRecord[]> {
    const prisma = getPrismaClient();
    const versions = await prisma.skillVersion.findMany({
      where: { skillId },
      orderBy: { createdAt: "desc" },
    });
    return versions.map(v => ({
      id: v.id,
      skillId: v.skillId,
      version: v.version,
      changes: v.changes || undefined,
      content: v.content || undefined,
      createdAt: v.createdAt,
    }));
  }

  async saveExecution(execution: SkillExecutionRecord): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.skillExecution.create({
      data: {
        skillId: execution.skillId,
        userId: execution.userId,
        toolName: execution.toolName,
        status: execution.status,
        error: execution.error,
        durationMs: execution.durationMs,
        input: execution.input as any,
        output: execution.output as any,
        policyCheck: execution.policyCheck as any,
      },
    });

    // Update metrics
    skillExecutionsTotal.inc({
      skill_id: execution.skillId,
      status: execution.status,
    });
  }

  async getExecutions(skillId: string, limit = 100): Promise<SkillExecutionRecord[]> {
    const prisma = getPrismaClient();
    const rawExecutions = await prisma.skillExecution.findMany({
      where: { skillId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return (rawExecutions as unknown as SkillExecutionRecord[]).map((e) => ({
      id: e.id,
      skillId: e.skillId,
      userId: (e.userId as string) || undefined,
      toolName: (e.toolName as string) || undefined,
      status: e.status as "success" | "failed" | "forbidden",
      error: e.error || undefined,
      durationMs: e.durationMs || undefined,
      input: e.input as Record<string, unknown> | undefined,
      output: e.output as Record<string, unknown> | undefined,
      policyCheck: e.policyCheck as Record<string, unknown> | undefined,
      createdAt: e.createdAt,
    }));
  }

  private mapPrismaToSkill(s: {
    id: string;
    name: string;
    description: string | null;
    capability: string;
    tags: string[];
    content: string | null;
    version: string;
    author: string | null;
    codeUrl: string | null;
    trustScore: number;
    permissions: string[];
    status: string;
  }): Skill {
    return {
      id: s.id,
      name: s.name,
      description: s.description || "",
      capability: s.capability,
      tags: s.tags || [],
      content: s.content || undefined,
      version: s.version,
      author: s.author || "",
      codeUrl: s.codeUrl || "",
      trustScore: s.trustScore,
      permissions: s.permissions,
      status: s.status as "pending" | "approved" | "revoked",
    };
  }
}

/**
 * Create storage instance based on environment configuration
 */
export function createStorage(): SkillStorage {
  const storageType = process.env.STORAGE_TYPE?.toLowerCase() || "memory";

  switch (storageType) {
    case "prisma":
    case "postgres":
    case "postgresql":
      console.log("📦 Using PrismaSkillStorage (PostgreSQL)");
      return new PrismaSkillStorage();
    case "memory":
    default:
      console.log("📦 Using InMemorySkillStorage");
      return new InMemorySkillStorage();
  }
}

// Global storage instance
let globalStorage: SkillStorage | null = null;

/**
 * Get global storage instance
 */
export function getStorage(): SkillStorage {
  if (!globalStorage) {
    globalStorage = createStorage();
  }
  return globalStorage;
}

/**
 * Initialize global storage
 */
export async function initializeStorage(): Promise<void> {
  const storage = getStorage();
  await storage.initialize();
}
