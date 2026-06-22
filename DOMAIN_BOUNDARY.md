# NexusAI-Skills — Domain Boundary

**Version:** 1.0
**Date:** 2026-06-22
**Owner:** Solution Architect Agent
**Classification:** Canonical — Foundation Document

---

## 1. Identity

| Attribute | Value |
|-----------|-------|
| **Repository** | `NexusAI-Skills` |
| **Bounded Context** | Skill Registry — metadata and execution policy binding for agent tools |
| **Role** | Skills Platform |
| **Language** | TypeScript |
| **Type** | Runtime service |

---

## 2. Purpose

NexusAI-Skills is the **Skills Platform** — the registry and policy layer for agent tools. It owns skill metadata, execution policies, trust scoring, and MCP tool bindings.

NexusAI-Skills is NOT a skill executor. Execution is agent-owned. NexusAI-Skills only manages what skills exist, who can use them, and under what policies.

---

## 3. Owned Capabilities

| Capability | Description |
|-----------|-------------|
| **Skill Registration** | Canonical skill metadata and capability definitions |
| **Policy Evaluation** | Trust scoring and execution policy checks |
| **Trust Scoring** | Per-skill safety and quality scores |
| **MCP Tool Registry** | MCP tool bindings and capability mapping |
| **Skill Metadata** | Extended metadata, versioning, ownership |

---

## 4. Owned APIs

| Endpoint | Description |
|----------|-------------|
| `/api/skills/*` | Skill registry operations |
| `/api/v1/skills/*` | V1 skill API |

---

## 5. Owned Data (PostgreSQL)

| Table | Purpose |
|-------|---------|
| `skills` | Skill definitions and metadata |
| `skill_policies` | Execution policies per skill |
| `skill_metadata` | Extended versioning and ownership |

---

## 6. Owned Events

| Event | Trigger |
|-------|---------|
| `skill.registered` | New skill added |
| `skill.executed` | Skill invoked |
| `skill.revoked` | Skill disabled |
| `policy.evaluated` | Execution policy checked |

---

## 7. Dependencies

| Dependency | Purpose |
|-----------|---------|
| `NexusAI-Platform` | Safety evaluation for new skills |

---

## 8. Forbidden

- **Direct skill execution** — execution is agent-owned
- **User authentication**
- **Model inference**
- **Knowledge retrieval**

---

## 9. Integration Points

| Integration | Direction | Protocol |
|------------|----------|---------|
| NexusAI (AI SDLC Runtime) | egress | HTTP (skill lookup) |
| Nexus-Control-Center | reads | HTTP (skill admin) |

---

## 10. Ecosystem Position

```
NexusAI-Skills (Skills Platform)
 └── NexusAI (AI SDLC Runtime) — skill discovery and policy lookup
```

NexusAI-Skills is the **toolbelt** — it tells agents what tools exist and under what rules. Execution is always agent-owned.

---

**Canonical document — do not modify without Architecture Council approval.**
**Source:** [REPOSITORY_BOUNDARY_MATRIX.md](../REPOSITORY_BOUNDARY_MATRIX.md)
