import { describe, it, expect } from "vitest";
import { SkillRegistry } from "../src/registry.js";
import { PolicyEngine } from "../src/policy.js";

describe("NexusAI Skills Registry Engine", () => {
  it("should initialize with core legal citation skill", () => {
    const registry = new SkillRegistry();
    const skills = registry.listSkills();
    
    expect(skills.length).toBe(1);
    expect(skills[0].id).toBe("vietnam-law-citations");
    expect(skills[0].trustScore).toBe(98);
  });

  it("should dynamically register valid new skills", () => {
    const registry = new SkillRegistry();
    const newSkill = {
      id: "vietnamese-translator",
      name: "Vietnamese Translation Helper",
      description: "Translates legal IT terms between VI and EN",
      version: "2.1.0",
      author: "LegalTech Corp",
      codeUrl: "https://example.com/translator.js",
      trustScore: 85,
      permissions: ["network:out"],
      status: "approved"
    };

    const registered = registry.registerSkill(newSkill);
    expect(registered.id).toBe("vietnamese-translator");
    expect(registry.getSkill("vietnamese-translator")).toBeDefined();
  });
});

describe("NexusAI Skill Security Policy Engine", () => {
  it("should allow verified safe skills to execute", () => {
    const registry = new SkillRegistry();
    const policy = new PolicyEngine();
    
    const skill = registry.getSkill("vietnam-law-citations")!;
    const evaluation = policy.evaluateSkillPolicy(skill);
    
    expect(evaluation.allowed).toBe(true);
  });

  it("should block skills with a low trust score", () => {
    const registry = new SkillRegistry();
    const policy = new PolicyEngine();
    
    const badSkill = registry.registerSkill({
      id: "unverified-crawler",
      name: "Suspicious Crawler",
      description: "Crawls external links blindly",
      version: "0.1.0",
      author: "Unknown hacker",
      codeUrl: "https://suspicious-cdn.com/crawler.js",
      trustScore: 45, // below default 70 threshold
      permissions: [],
      status: "approved"
    });

    const evaluation = policy.evaluateSkillPolicy(badSkill);
    expect(evaluation.allowed).toBe(false);
    expect(evaluation.reason).toContain("falls below the minimum required security threshold");
  });

  it("should block skills requiring unsafe system permissions", () => {
    const registry = new SkillRegistry();
    const policy = new PolicyEngine();
    
    const dangerousSkill = registry.registerSkill({
      id: "root-executor",
      name: "Root Executor Skill",
      description: "Runs commands as superuser",
      version: "1.0.0",
      author: "System Admins",
      codeUrl: "https://internal-s3/admin.js",
      trustScore: 99,
      permissions: ["sys:exec"], // blocked by default policy
      status: "approved"
    });

    const evaluation = policy.evaluateSkillPolicy(dangerousSkill);
    expect(evaluation.allowed).toBe(false);
    expect(evaluation.reason).toContain("requests blocked unsafe permission");
  });
});
