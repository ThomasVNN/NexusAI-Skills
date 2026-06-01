import { SkillRegistry } from "./registry.js";
import { PolicyEngine } from "./policy.js";

export const registry = new SkillRegistry();
export const policyEngine = new PolicyEngine();

// SECURITY: HIGH-003 - CORS origins configuration via environment variable
export const CORS_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter((o) => o.length > 0);
