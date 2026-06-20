# NexusAI-Skills

> **Bounded Context:** `Skills` · **Primary Owner:** AI Agent · **Supporting:** PO Agent, SA Agent, Dev Agent, Designer Agent
> **Repository Role:** Runtime service (API-only) · **Product Status:** Standalone product · **Version:** 1.x
> **Backlog & Status:** [Tasks Backlog](https://app.notion.com/p/c3b268b26842457a93fbad7fc5b1b710?pvs=1) · [SDLC V3 Control Center](https://app.notion.com/p/3843b1d5683e816c8899debb443e33c5?pvs=1)

The high-security metadata registry and execution policy binding engine for AI agent tools. NexusAI-Skills manages the lifecycle of dynamic skills, evaluates their trust score, and sandboxes their execution under MCP (Model Context Protocol).

![NexusAI-Skills — Tool Registry &amp; MCP Execution](./docs/architecture/skills.svg)

---

## Table of Contents

- [Bounded Context](#bounded-context)
- [What It Does](#what-it-does)
- [What It Does NOT Do](#what-it-does-not-do)
- [Architecture](#architecture)
- [Public API Surface](#public-api-surface)
- [Tech Stack](#tech-stack)
- [Repository Layout](#repository-layout)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Testing & Quality Gates](#testing--quality-gates)
- [Built-in Connectors](#built-in-connectors)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Governance](#governance)

---

## Bounded Context

| Attribute | Value |
|---|---|
| Context name | `Skills` |
| Primary owner | AI Agent |
| Supporting owners | PO Agent, SA Agent, Dev Agent, Designer Agent |
| Repository | `NexusAI-Skills` (this repo) |
| Bounded contexts that consume it | `Gateway` (MCP tool calls), `Chat` (skill discovery), `Control` (NCC admin) |
| Bounded contexts it depends on | (none — Skills is leaf) |

**Why this context exists:** Agent tool calls must be audited, policy-checked, and sandboxed. Isolating this responsibility keeps Gateway and Chat free of tool-lifecycle logic and gives a single chokepoint for trust evaluation.

---

## What It Does

- 📋 **Skill registry** — register, list, update, remove skill manifests
- ⚖️ **Policy engine** — trust scoring, capability whitelists, resource limits, tenant isolation
- 🔌 **MCP protocol** — exposes `/mcp/v1/tools` and `/mcp/v1/call` for agent runtimes
- 🏖️ **Sandboxed execution** — isolated VM/process per skill run with CPU, memory, and time caps
- 📜 **Audit trail** — every execution persisted with input, output, status
- 🧩 **Built-in connectors** — Jira, ServiceNow, SAP, plus a pluggable framework for custom enterprise integrations
- 📈 **Observability** — Prometheus metrics (`prom-client`), Pino structured logs

## What It Does NOT Do

| Concern | Owned by |
|---|---|
| Document retrieval / RAG | `Knowledge` |
| Model inference / provider routing | `Gateway` |
| Generic extension / hook framework | `Apps` (a different context) |
| Admin / operator UI | `Control` (NCC) — **Skills has no standalone admin UI** |
| Model registry / kill-switch | `Platform` |

> **Apps vs Skills:** An `Extension` (Apps context) is a *workflow plugin* — it has hooks, runs on user/system events, integrates with ERP/shell. A `Skill` (this context) is an *agent-invokable tool* — it has a manifest, runs in a sandbox, is discovered and called via MCP by an AI agent. The two share lifecycle vocabulary but solve different problems.

---

## Architecture

```
                   ┌──────────────────────────────────────┐
                   │          NexusAI-Skills              │
                   │                                      │
   GET/POST/PUT/   │   ┌─────────────┐  ┌─────────────┐   │  POST /mcp/v1/call
   DELETE /api/    │   │  Registry   │  │   Policy    │   │  GET  /mcp/v1/tools
   skills/*        │   │  (Prisma)   │─▶│   Engine    │   │
                   │   └──────┬──────┘  └──────┬──────┘   │
                   │          │                │          │
                   │          └────────┬───────┘          │
                   │                   ▼                  │
                   │         ┌──────────────────┐         │
                   │         │    Sandbox       │         │
                   │         │ (per-exec VM)    │         │
                   │         └──────────────────┘         │
                   └──────────────────────────────────────┘
                                    │
                                    ▼
                       Built-in connectors · external APIs
                       (Jira, ServiceNow, SAP, custom)
```

---

## Public API Surface

### Skill registry

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET`    | `/api/skills` | List skills | Bearer |
| `GET`    | `/api/skills/:id` | Skill detail | Bearer |
| `POST`   | `/api/skills` | Register skill | Bearer |
| `PUT`    | `/api/skills/:id` | Update skill | Bearer |
| `DELETE` | `/api/skills/:id` | Revoke skill | Bearer |
| `POST`   | `/api/skills/:id/evaluate` | Evaluate against policy | Bearer |
| `POST`   | `/api/skills/:id/execute` | Execute skill | Bearer |

### Policy

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET`  | `/api/policies` | List policies | Bearer |
| `POST` | `/api/policies` | Create policy | Bearer |

### MCP

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET`  | `/mcp/v1/tools` | List MCP tools | Bearer |
| `POST` | `/mcp/v1/call` | Call MCP tool | Bearer |

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/healthz` | Liveness |
| `GET` | `/ready` | Readiness |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (Node.js 20+) |
| HTTP | Fastify 5 |
| Database | Prisma 5 (PostgreSQL or in-memory) |
| Validation | Zod |
| Logging | Pino |
| Metrics | `prom-client` (Prometheus) |
| Container | Docker |

---

## Repository Layout

```text
src/
├── registry.ts             Skill schema and dynamic storage
├── policy.ts               Security policy and trust-score evaluation
├── index.ts                Fastify server bootstrap
├── shared/                 Config, logger, types
└── infra/                  Prisma client, metrics
prisma/schema.prisma        Prisma schema (skills, policies, executions)
tests/skills.test.ts        Vitest unit suite
Dockerfile                 Production container
```

---

## Quick Start

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm test                   # vitest
pnpm build
pnpm start                  # listens on :8083
```

The service starts on port `8083` (configurable via `PORT`).

> *Note: Port `8083` is the historical default. In a production Kubernetes deployment, the port is determined by the container spec, not the bounded context.*

---

## Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | HTTP listen port | `8083` |
| `DATABASE_URL` | PostgreSQL connection string | Local fallback |
| `ALLOWED_ORIGINS` | CORS allowlist (comma-separated) | localhost defaults |
| `SANDBOX_TIMEOUT` | Max execution time per skill | `30s` |
| `SANDBOX_MEMORY_LIMIT` | Max memory per execution | `512MB` |
| `LOG_LEVEL` | Pino log level | `info` |

---

## Testing & Quality Gates

```bash
pnpm test                            # vitest unit suite
pnpm lint                            # ESLint
pnpm typecheck                       # TypeScript strict
```

Tests must cover new skill types and policy rules. Sandbox tests must run in an isolated environment.

---

## Built-in Connectors

| Connector | Category | Notes |
|---|---|---|
| Jira | Issue tracking | Search, create, update issues |
| ServiceNow | ITSM | Incidents, change requests |
| SAP | ERP | Read-only fetch via RFC |
| Custom | Pluggable | Implement the `Connector` interface |

Add a new connector by registering a manifest at startup and providing the executor.

---

## Documentation

| Topic | Path |
|---|---|
| Bounded context (canonical) | `docs/bounded-contexts/skills.md` |
| MCP transport spec | `docs/mcp.md` (if present) |
| Connector authoring | `docs/connectors.md` (if present) |

---

## Contributing

1. Branch from `main`: `feature/<ticket>-<description>`
2. New policy rules require a unit test demonstrating the rule
3. New connectors must include an executor and at least one integration test
4. PR → SA Agent → QA Agent → Release Manager
5. Never commit to `main` directly

---

## Governance

| Attribute | Value |
|---|---|
| Document owner | AI Agent |
| Review cadence | Monthly |
| Last updated | June 20, 2026 |
| License | Internal — NexusAI Platform |

---

*Canonical product spec: `docs/bounded-contexts/skills.md` in the workspace root.*
