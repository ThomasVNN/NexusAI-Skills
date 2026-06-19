/**
 * NexusAI Skills - Storage Abstraction
 * 
 * In-memory storage for skills.
 */

import { Skill } from "./registry.js";

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
  initialize(): Promise<void>;
  saveSkill(skill: Skill): Promise<void>;
  getSkill(id: string): Promise<Skill | null>;
  getSkillByName(name: string): Promise<Skill | null>;
  deleteSkill(id: string): Promise<void>;
  listSkills(): Promise<Skill[]>;
  saveExecution(execution: SkillExecutionRecord): Promise<void>;
  getExecutions(skillId?: string, limit?: number): Promise<SkillExecutionRecord[]>;
}

/**
 * In-memory storage for development/testing
 */
export class InMemorySkillStorage implements SkillStorage {
  private skills: Map<string, Skill> = new Map();
  private executions: SkillExecutionRecord[] = [];
  private readonly MAX_EXECUTIONS = 1000;

  async initialize(): Promise<void> {
    console.log("InMemorySkillStorage: Initialized");
  }

  async saveSkill(skill: Skill): Promise<void> {
    this.skills.set(skill.id, skill);
  }

  async getSkill(id: string): Promise<Skill | null> {
    return this.skills.get(id) || null;
  }

  async getSkillByName(name: string): Promise<Skill | null> {
    for (const skill of this.skills.values()) {
      if (skill.name === name) return skill;
    }
    return null;
  }

  async deleteSkill(id: string): Promise<void> {
    this.skills.delete(id);
  }

  async listSkills(): Promise<Skill[]> {
    return Array.from(this.skills.values());
  }

  async saveExecution(execution: SkillExecutionRecord): Promise<void> {
    if (!execution.id) {
      execution.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    if (!execution.createdAt) {
      execution.createdAt = new Date();
    }
    
    this.executions.push(execution);
    
    // Keep only the last MAX_EXECUTIONS
    if (this.executions.length > this.MAX_EXECUTIONS) {
      this.executions = this.executions.slice(-this.MAX_EXECUTIONS);
    }
  }

  async getExecutions(skillId?: string, limit?: number): Promise<SkillExecutionRecord[]> {
    let result = this.executions;
    
    if (skillId) {
      result = result.filter(e => e.skillId === skillId);
    }
    
    // Sort by createdAt descending
    result = result.sort((a, b) => {
      const dateA = a.createdAt?.getTime() || 0;
      const dateB = b.createdAt?.getTime() || 0;
      return dateB - dateA;
    });
    
    if (limit) {
      result = result.slice(0, limit);
    }
    
    return result;
  }
}

// Export a singleton instance
export const skillStorage = new InMemorySkillStorage();
