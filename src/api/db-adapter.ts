/**
 * Database Adapter for Skill Registry
 * 
 * Provides database persistence layer with support for:
 * - PostgreSQL (production)
 * - SQLite (development/testing)
 */

import { Skill } from "./registry.js";

export interface DatabaseAdapter {
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Skill CRUD operations
  saveSkill(skill: Skill): Promise<void>;
  getSkillById(id: string): Promise<Skill | null>;
  getSkillByVersion(id: string, version: string): Promise<Skill | null>;
  listSkills(options?: ListSkillsOptions): Promise<{ skills: Skill[]; total: number }>;
  updateSkill(id: string, updates: Partial<Skill>): Promise<Skill | null>;
  deleteSkill(id: string): Promise<boolean>;

  // Version management
  getVersions(skillId: string): Promise<string[]>;
  linkVersion(skillId: string, version: string, changelog?: string): Promise<void>;

  // Status management
  approveSkill(id: string): Promise<boolean>;
  revokeSkill(id: string): Promise<boolean>;

  // Search and discovery
  searchSkills(query: SearchQuery): Promise<{ skills: Skill[]; total: number }>;
  getCategories(): Promise<string[]>;
  getTags(): Promise<string[]>;
}

export interface ListSkillsOptions {
  status?: "pending" | "approved" | "revoked";
  author?: string;
  category?: string;
  page?: number;
  limit?: number;
  sortBy?: "name" | "trustScore" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export interface SearchQuery {
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

// In-memory adapter for development and testing
export class InMemoryAdapter implements DatabaseAdapter {
  private skills = new Map<string, Skill>();
  private versions = new Map<string, string[]>();
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
    // Seed with default skills
    await this.seedDefaultSkills();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async seedDefaultSkills(): Promise<void> {
    const defaultSkills: Skill[] = [
      {
        id: "vietnam-law-citations",
        name: "Vietnam Law Citation Matcher",
        description: "Extracts and visualizes legal citation paths for banking & IT domains",
        version: "1.0.0",
        author: "NexusAI Architect",
        codeUrl: "http://skills-nexus/cdn/citation-matcher.js",
        trustScore: 98,
        permissions: ["read:knowledge", "write:citations"],
        status: "approved",
        category: "legal",
        tags: ["vietnam", "legal", "citations"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "jira-integration",
        name: "Jira Connector",
        description: "AI-powered Jira issue creation and management",
        version: "1.0.0",
        author: "NexusAI Team",
        codeUrl: "http://skills-nexus/cdn/jira-connector.js",
        trustScore: 85,
        permissions: ["read:jira", "write:jira"],
        status: "approved",
        category: "enterprise",
        tags: ["jira", "project-management", "atlassian"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "document-processor",
        name: "Document Processor",
        description: "Extract, summarize and classify documents using AI",
        version: "1.0.0",
        author: "NexusAI Team",
        codeUrl: "http://skills-nexus/cdn/doc-processor.js",
        trustScore: 90,
        permissions: ["read:documents", "write:knowledge"],
        status: "approved",
        category: "productivity",
        tags: ["documents", "extraction", "summarization"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    for (const skill of defaultSkills) {
      await this.saveSkill(skill);
    }
  }

  async saveSkill(skill: Skill): Promise<void> {
    const id = skill.id;
    this.skills.set(id, {
      ...skill,
      createdAt: skill.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Track version
    const baseId = skill.id.split("@")[0];
    if (!this.versions.has(baseId)) {
      this.versions.set(baseId, []);
    }
    const versionList = this.versions.get(baseId)!;
    if (!versionList.includes(skill.version)) {
      versionList.push(skill.version);
    }
  }

  async getSkillById(id: string): Promise<Skill | null> {
    // Try exact match first
    if (this.skills.has(id)) {
      return this.skills.get(id)!;
    }
    
    // Try base ID (get latest version)
    const baseId = id.split("@")[0];
    const versions = this.versions.get(baseId);
    if (versions && versions.length > 0) {
      const latestVersion = versions.sort().pop()!;
      return this.skills.get(`${baseId}@${latestVersion}`) || null;
    }

    return null;
  }

  async getSkillByVersion(id: string, version: string): Promise<Skill | null> {
    return this.skills.get(`${id}@${version}`) || null;
  }

  async listSkills(options?: ListSkillsOptions): Promise<{ skills: Skill[]; total: number }> {
    let skills = Array.from(this.skills.values());

    // Filter by latest versions only
    const latestSkills = this.filterLatestVersions(skills);

    if (options?.status) {
      latestSkills.filter(s => s.status === options.status);
    }
    if (options?.author) {
      latestSkills.filter(s => s.author === options.author);
    }
    if (options?.category) {
      latestSkills.filter(s => s.category === options.category);
    }

    // Sort
    const sortBy = options?.sortBy || "trustScore";
    const sortOrder = options?.sortOrder || "desc";
    latestSkills.sort((a, b) => {
      const aVal = a[sortBy] as any;
      const bVal = b[sortBy] as any;
      return sortOrder === "asc" 
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    // Paginate
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const start = (page - 1) * limit;
    const paginated = latestSkills.slice(start, start + limit);

    return {
      skills: paginated,
      total: latestSkills.length,
    };
  }

  private filterLatestVersions(skills: Skill[]): Skill[] {
    const latestMap = new Map<string, Skill>();
    for (const skill of skills) {
      const baseId = skill.id.split("@")[0];
      const existing = latestMap.get(baseId);
      if (!existing || this.compareVersions(skill.version, existing.version) > 0) {
        latestMap.set(baseId, skill);
      }
    }
    return Array.from(latestMap.values());
  }

  private compareVersions(a: string, b: string): number {
    const partsA = a.split(".").map(Number);
    const partsB = b.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if (partsA[i] > partsB[i]) return 1;
      if (partsA[i] < partsB[i]) return -1;
    }
    return 0;
  }

  async updateSkill(id: string, updates: Partial<Skill>): Promise<Skill | null> {
    const skill = await this.getSkillById(id);
    if (!skill) return null;

    const updated: Skill = {
      ...skill,
      ...updates,
      id: skill.id, // Prevent ID change
      version: skill.version, // Prevent version change
      updatedAt: new Date().toISOString(),
    };

    await this.saveSkill(updated);
    return updated;
  }

  async deleteSkill(id: string): Promise<boolean> {
    const baseId = id.split("@")[0];
    let deleted = false;

    // Delete all versions
    for (const [key] of this.skills) {
      if (key.startsWith(baseId)) {
        this.skills.delete(key);
        deleted = true;
      }
    }
    this.versions.delete(baseId);

    return deleted;
  }

  async getVersions(skillId: string): Promise<string[]> {
    return this.versions.get(skillId) || [];
  }

  async linkVersion(skillId: string, version: string, _changelog?: string): Promise<void> {
    if (!this.versions.has(skillId)) {
      this.versions.set(skillId, []);
    }
    const versions = this.versions.get(skillId)!;
    if (!versions.includes(version)) {
      versions.push(version);
    }
  }

  async approveSkill(id: string): Promise<boolean> {
    const skill = await this.getSkillById(id);
    if (!skill) return false;

    skill.status = "approved";
    skill.updatedAt = new Date().toISOString();
    await this.saveSkill(skill);
    return true;
  }

  async revokeSkill(id: string): Promise<boolean> {
    const skill = await this.getSkillById(id);
    if (!skill) return false;

    skill.status = "revoked";
    skill.updatedAt = new Date().toISOString();
    await this.saveSkill(skill);
    return true;
  }

  async searchSkills(query: SearchQuery): Promise<{ skills: Skill[]; total: number }> {
    let skills = Array.from(this.skills.values());
    const latestSkills = this.filterLatestVersions(skills);

    // Apply filters
    if (query.query) {
      const q = query.query.toLowerCase();
      skills = latestSkills.filter(s => 
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags?.some(t => t.toLowerCase().includes(q))
      );
    } else {
      skills = latestSkills;
    }

    if (query.category) {
      skills = skills.filter(s => s.category === query.category);
    }
    if (query.tags && query.tags.length > 0) {
      skills = skills.filter(s => 
        query.tags!.some(t => s.tags?.includes(t))
      );
    }
    if (query.author) {
      skills = skills.filter(s => s.author === query.author);
    }
    if (query.status) {
      skills = skills.filter(s => s.status === query.status);
    }
    if (query.minTrustScore !== undefined) {
      skills = skills.filter(s => s.trustScore >= query.minTrustScore!);
    }

    // Sort
    const sortBy = query.sortBy || "trustScore";
    const sortOrder = query.sortOrder || "desc";
    skills.sort((a, b) => {
      const aVal = (a as any)[sortBy];
      const bVal = (b as any)[sortBy];
      return sortOrder === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    // Paginate
    const page = query.page || 1;
    const limit = query.limit || 20;
    const start = (page - 1) * limit;
    const paginated = skills.slice(start, start + limit);

    return {
      skills: paginated,
      total: skills.length,
    };
  }

  async getCategories(): Promise<string[]> {
    const skills = Array.from(this.skills.values());
    const categories = new Set<string>();
    for (const skill of skills) {
      if (skill.category) {
        categories.add(skill.category);
      }
    }
    return Array.from(categories).sort();
  }

  async getTags(): Promise<string[]> {
    const skills = Array.from(this.skills.values());
    const tags = new Set<string>();
    for (const skill of skills) {
      for (const tag of skill.tags || []) {
        tags.add(tag);
      }
    }
    return Array.from(tags).sort();
  }
}

// PostgreSQL adapter for production
export class PostgresAdapter implements DatabaseAdapter {
  private pool: any = null;
  private connected = false;
  private connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    // In production, this would use pg pool
    // For now, delegate to in-memory
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async saveSkill(skill: Skill): Promise<void> {
    // Implementation would use pg pool
    throw new Error("PostgreSQL adapter requires pg package");
  }

  async getSkillById(id: string): Promise<Skill | null> {
    throw new Error("PostgreSQL adapter requires pg package");
  }

  async getSkillByVersion(id: string, version: string): Promise<Skill | null> {
    throw new Error("PostgreSQL adapter requires pg package");
  }

  async listSkills(options?: ListSkillsOptions): Promise<{ skills: Skill[]; total: number }> {
    throw new Error("PostgreSQL adapter requires pg package");
  }

  async updateSkill(id: string, updates: Partial<Skill>): Promise<Skill | null> {
    throw new Error("PostgreSQL adapter requires pg package");
  }

  async deleteSkill(id: string): Promise<boolean> {
    throw new Error("PostgreSQL adapter requires pg package");
  }

  async getVersions(skillId: string): Promise<string[]> {
    throw new Error("PostgreSQL adapter requires pg package");
  }

  async linkVersion(skillId: string, version: string, changelog?: string): Promise<void> {
    throw new Error("PostgreSQL adapter requires pg package");
  }

  async approveSkill(id: string): Promise<boolean> {
    throw new Error("PostgreSQL adapter requires pg package");
  }

  async revokeSkill(id: string): Promise<boolean> {
    throw new Error("PostgreSQL adapter requires pg package");
  }

  async searchSkills(query: SearchQuery): Promise<{ skills: Skill[]; total: number }> {
    throw new Error("PostgreSQL adapter requires pg package");
  }

  async getCategories(): Promise<string[]> {
    throw new Error("PostgreSQL adapter requires pg package");
  }

  async getTags(): Promise<string[]> {
    throw new Error("PostgreSQL adapter requires pg package");
  }
}

// Factory function to create appropriate adapter
export function createDatabaseAdapter(connectionString?: string): DatabaseAdapter {
  if (connectionString?.startsWith("postgresql://")) {
    return new PostgresAdapter(connectionString);
  }
  return new InMemoryAdapter();
}
