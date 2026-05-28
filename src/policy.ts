import { Skill } from "./registry.js";

export interface ExecutionPolicy {
  minTrustScore: number;
  blockedPermissions: string[];
}

export class PolicyEngine {
  private defaultPolicy: ExecutionPolicy = {
    minTrustScore: 70,
    blockedPermissions: ["os:write", "sys:exec"]
  };

  /**
   * Assesses if a skill meets target security policies for runtime execution
   */
  public evaluateSkillPolicy(skill: Skill, customPolicy?: Partial<ExecutionPolicy>): {
    allowed: boolean;
    reason?: string;
  } {
    const policy = { ...this.defaultPolicy, ...customPolicy };

    if (skill.status === "revoked") {
      return { allowed: false, reason: "Skill has been explicitly revoked by system administrator." };
    }

    if (skill.trustScore < policy.minTrustScore) {
      return {
        allowed: false,
        reason: `Trust score (${skill.trustScore}) falls below the minimum required security threshold (${policy.minTrustScore}).`
      };
    }

    // Check for blocked/unsafe permissions
    for (const permission of skill.permissions) {
      if (policy.blockedPermissions.includes(permission)) {
        return {
          allowed: false,
          reason: `Skill requests blocked unsafe permission: ${permission}`
        };
      }
    }

    return { allowed: true };
  }
}
