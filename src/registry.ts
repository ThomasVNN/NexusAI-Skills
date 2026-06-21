import { z } from "zod";

// Zod schema for validated Skill packages
export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  capability: z.string().default("general"),
  tags: z.array(z.string()).default([]),
  content: z.string().optional(),
  version: z.string(),
  author: z.string(),
  codeUrl: z.string().url(),
  trustScore: z.number().min(0).max(100).default(100),
  permissions: z.array(z.string()).default([]),
  status: z.enum(["pending", "approved", "revoked"]).default("approved")
});

export type Skill = z.infer<typeof SkillSchema>;

// Input schema for creating/updating skills (id is optional for creation)
export const CreateSkillSchema = SkillSchema.omit({ id: true }).extend({
  id: z.string().optional(),
});
export type CreateSkillInput = z.infer<typeof CreateSkillSchema>;

// Search filters for skills
export const SkillSearchSchema = z.object({
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  capability: z.string().optional(),
  status: z.enum(["pending", "approved", "revoked"]).optional(),
});
export type SkillSearchFilters = z.infer<typeof SkillSearchSchema>;

export class SkillRegistry {
  private skills = new Map<string, Skill>();

  constructor() {
    // Seed with core legal tools
    this.registerSkill({
      id: "vietnam-law-citations",
      name: "Vietnam Law Citation Matcher",
      description: "Extracts and visualizes legal citation paths for banking & IT domains",
      capability: "legal-research",
      tags: ["legal", "vietnam", "citations"],
      content: "Skill for extracting and visualizing legal citation paths for banking & IT domains",
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
