import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryAdapter, DatabaseAdapter } from "../src/api/db-adapter.js";
import { SkillRegistry, Skill } from "../src/registry.js";

describe("InMemoryAdapter", () => {
  let adapter: InMemoryAdapter;

  beforeEach(async () => {
    adapter = new InMemoryAdapter();
    await adapter.connect();
  });

  it("should connect successfully", () => {
    expect(adapter.isConnected()).toBe(true);
  });

  it("should seed default skills on connect", async () => {
    const skill = await adapter.getSkillById("vietnam-law-citations");
    expect(skill).not.toBeNull();
    expect(skill?.name).toBe("Vietnam Law Citation Matcher");
  });

  it("should save and retrieve skills", async () => {
    const skill: Skill = {
      id: "test-skill",
      name: "Test Skill",
      description: "A test skill",
      version: "1.0.0",
      author: "Test Author",
      codeUrl: "https://example.com/skill.js",
      trustScore: 80,
      permissions: ["read:test"],
      status: "pending",
      category: "testing",
      tags: ["test"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await adapter.saveSkill(skill);
    const retrieved = await adapter.getSkillById("test-skill");

    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe("Test Skill");
    expect(retrieved?.status).toBe("pending");
  });

  it("should get skills by version", async () => {
    const skill1: Skill = {
      id: "versioned-skill@1.0.0",
      name: "Versioned Skill",
      description: "Test",
      version: "1.0.0",
      author: "Test",
      codeUrl: "https://example.com/skill.js",
      trustScore: 80,
      permissions: [],
      status: "approved",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const skill2: Skill = {
      id: "versioned-skill@2.0.0",
      name: "Versioned Skill",
      description: "Test",
      version: "2.0.0",
      author: "Test",
      codeUrl: "https://example.com/skill-v2.js",
      trustScore: 85,
      permissions: [],
      status: "approved",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await adapter.saveSkill(skill1);
    await adapter.saveSkill(skill2);

    const v1 = await adapter.getSkillByVersion("versioned-skill", "1.0.0");
    const v2 = await adapter.getSkillByVersion("versioned-skill", "2.0.0");

    expect(v1?.trustScore).toBe(80);
    expect(v2?.trustScore).toBe(85);
  });

  it("should list skills with pagination", async () => {
    const result = await adapter.listSkills({ page: 1, limit: 10 });
    expect(result.skills.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
  });

  it("should update skills", async () => {
    const updated = await adapter.updateSkill("vietnam-law-citations", {
      trustScore: 99,
    });

    expect(updated).not.toBeNull();
    expect(updated?.trustScore).toBe(99);
  });

  it("should approve skills", async () => {
    const skill: Skill = {
      id: "pending-skill",
      name: "Pending Skill",
      description: "Test",
      version: "1.0.0",
      author: "Test",
      codeUrl: "https://example.com/skill.js",
      trustScore: 50,
      permissions: [],
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await adapter.saveSkill(skill);
    const approved = await adapter.approveSkill("pending-skill");

    expect(approved).toBe(true);
    const retrieved = await adapter.getSkillById("pending-skill");
    expect(retrieved?.status).toBe("approved");
  });

  it("should revoke skills", async () => {
    const revoked = await adapter.revokeSkill("vietnam-law-citations");
    expect(revoked).toBe(true);

    const skill = await adapter.getSkillById("vietnam-law-citations");
    expect(skill?.status).toBe("revoked");
  });

  it("should search skills by query", async () => {
    const result = await adapter.searchSkills({ query: "legal" });
    expect(result.skills.length).toBeGreaterThan(0);
    expect(result.skills[0].name.toLowerCase()).toContain("legal");
  });

  it("should filter skills by category", async () => {
    const result = await adapter.searchSkills({ category: "legal" });
    expect(result.skills.length).toBeGreaterThan(0);
  });

  it("should get categories", async () => {
    const categories = await adapter.getCategories();
    expect(categories).toContain("legal");
  });

  it("should get tags", async () => {
    const tags = await adapter.getTags();
    expect(tags.length).toBeGreaterThan(0);
  });
});

describe("SkillRegistry", () => {
  let adapter: InMemoryAdapter;
  let registry: SkillRegistry;

  beforeEach(async () => {
    adapter = new InMemoryAdapter();
    await adapter.connect();
    registry = new SkillRegistry();
  });

  it("should register a new skill", async () => {
    const skill = await registry.registerSkill(adapter, {
      id: "new-skill",
      name: "New Skill",
      description: "A new skill",
      version: "1.0.0",
      author: "Test",
      codeUrl: "https://example.com/skill.js",
    });

    expect(skill.id).toBe("new-skill");
    expect(skill.status).toBe("pending");
    expect(skill.createdAt).toBeDefined();
  });

  it("should retrieve a skill by ID", async () => {
    await registry.registerSkill(adapter, {
      id: "retrievable-skill",
      name: "Retrievable Skill",
      description: "Test",
      version: "1.0.0",
      author: "Test",
      codeUrl: "https://example.com/skill.js",
    });

    const skill = await registry.getSkillById(adapter, "retrievable-skill");
    expect(skill).not.toBeNull();
    expect(skill?.name).toBe("Retrievable Skill");
  });

  it("should list skills with pagination", async () => {
    const result = await registry.listSkills(adapter, {
      page: 1,
      limit: 10,
    });

    expect(result.skills.length).toBeGreaterThan(0);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(10);
  });

  it("should search skills", async () => {
    const result = await registry.searchSkills(adapter, {
      query: "law",
    });

    expect(result.skills.length).toBeGreaterThan(0);
  });

  it("should approve a skill", async () => {
    await registry.registerSkill(adapter, {
      id: "skill-to-approve",
      name: "Approve Me",
      description: "Test",
      version: "1.0.0",
      author: "Test",
      codeUrl: "https://example.com/skill.js",
      status: "pending",
    });

    await registry.approveSkill(adapter, "skill-to-approve");
    const skill = await registry.getSkillById(adapter, "skill-to-approve");

    expect(skill?.status).toBe("approved");
  });

  it("should update skill metadata", async () => {
    await registry.registerSkill(adapter, {
      id: "skill-to-update",
      name: "Original Name",
      description: "Test",
      version: "1.0.0",
      author: "Test",
      codeUrl: "https://example.com/skill.js",
    });

    const updated = await registry.updateSkill(adapter, "skill-to-update", {
      name: "Updated Name",
      trustScore: 95,
    });

    expect(updated?.name).toBe("Updated Name");
    expect(updated?.trustScore).toBe(95);
  });

  it("should delete a skill", async () => {
    await registry.registerSkill(adapter, {
      id: "skill-to-delete",
      name: "Delete Me",
      description: "Test",
      version: "1.0.0",
      author: "Test",
      codeUrl: "https://example.com/skill.js",
    });

    const deleted = await registry.deleteSkill(adapter, "skill-to-delete");
    expect(deleted).toBe(true);

    const skill = await registry.getSkillById(adapter, "skill-to-delete");
    expect(skill).toBeNull();
  });

  it("should get skill versions", async () => {
    await registry.registerSkill(adapter, {
      id: "versioned",
      name: "Versioned Skill",
      description: "Test",
      version: "1.0.0",
      author: "Test",
      codeUrl: "https://example.com/skill.js",
    });

    await registry.registerSkill(adapter, {
      id: "versioned@2.0.0",
      name: "Versioned Skill",
      description: "Test",
      version: "2.0.0",
      author: "Test",
      codeUrl: "https://example.com/skill-v2.js",
    });

    await registry.linkVersion(adapter, "versioned", "2.0.0");

    const versions = await registry.getSkillVersions(adapter, "versioned");
    expect(versions.length).toBeGreaterThan(0);
  });

  it("should get categories", async () => {
    const categories = await registry.getCategories(adapter);
    expect(Array.isArray(categories)).toBe(true);
  });

  it("should get tags", async () => {
    const tags = await registry.getTags(adapter);
    expect(Array.isArray(tags)).toBe(true);
  });
});
