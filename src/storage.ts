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
   * List all skills
   */
  listSkills(): Promise<Skill[]>;

  /**
   * Update a skill
   */
  updateSkill(id: string, skill: Partial<Skill>): Promise<Skill | null>;

  /**
   * Delete a skill
   */
  deleteSkill(id: string): Promise<boolean>;

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

  async initialize(): Promise<void> {
    // No initialization needed for in-memory storage
    // Seed with default skill
    if (this.skills.size === 0) {
      const defaultSkill: Skill = {
        id: "vietnam-law-citations",
        name: "Vietnam Law Citation Matcher",
        description: "Extracts and visualizes legal citation paths for banking & IT domains",
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

  async listSkills(): Promise<Skill[]> {
    return Array.from(this.skills.values());
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

  async listSkills(): Promise<Skill[]> {
    const prisma = getPrismaClient();
    const skills = await prisma.skill.findMany({
      orderBy: { createdAt: "desc" },
    });
    return skills.map(this.mapPrismaToSkill);
  }

  async updateSkill(id: string, updates: Partial<Skill>): Promise<Skill | null> {
    const prisma = getPrismaClient();
    const skill = await prisma.skill.update({
      where: { id },
      data: {
        name: updates.name,
        description: updates.description,
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
    const executions = await prisma.skillExecution.findMany({
      where: { skillId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return executions.map((e) => ({
      id: e.id,
      skillId: e.skillId,
      userId: e.userId || undefined,
      toolName: e.toolName || undefined,
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
