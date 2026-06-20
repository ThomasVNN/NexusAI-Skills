# NexusAI-Skills

> **Bounded Context:** `Skills` · **Primary Owner:** AI Agent · **Supporting:** App Agent (legacy hooks), PO Agent, SA Agent, Dev Agent, Designer Agent
> **Repository Role:** Runtime service (API-only) · **Product Status:** Standalone product · **Version:** 2.0 (merged Apps)
> **Backlog & Status:** [Tasks Backlog](https://app.notion.com/p/c3b268b26842457a93fbad7fc5b1b710?pvs=1) · [SDLC V3 Control Center](https://app.notion.com/p/3843b1d5683e816c8899debb443e33c5?pvs=1)

The single tool/extension registry for the NexusAI ecosystem. **As of June 20, 2026, this context absorbs the previous `NexusAI-Apps` context** — one repo, one API, two execution modes (MCP for AI agents, legacy hooks for workflow plugins).

![NexusAI-Skills — Tool Registry (MCP + Legacy Hooks)](./docs/architecture/skills.svg)

---

## Table of Contents

- [Bounded Context](#bounded-context)
- [What It Does](#what-it-does)
- [What It Does NOT Do](#what-it-does-not-do)
- [Why One Context, Two Modes](#why-one-context-two-modes)
- [Architecture](#architecture)
- [Public API Surface](#public-api-surface)
- [Tech Stack](#tech-stack)
- [Repository Layout](#repository-layout)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Testing & Quality Gates](#testing--quality-gates)
- [Built-in Connectors](#built-in-connectors)
- [Migration from NexusAI-Apps](#migration-from-nexusai-apps)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Governance](#governance)

---

## Bounded Context

| Attribute | Value |
|---|---|
| Context name | `Skills` |
| Primary owner | AI Agent |
| Supporting owners | App Agent (legacy hooks), PO Agent, SA Agent, Dev Agent, Designer Agent |
| Repository | `NexusAI-Skills` (this repo) |
| Pre-2026-06-20 sibling | `NexusAI-Apps` (merged in) |
| Bounded contexts that consume it | `Gateway` (MCP tool calls), `Chat` (tool discovery), `Control` (NCC admin) |
| Bounded contexts it depends on | (none — Skills is leaf) |

**Why this context exists:** Agent tool calls and enterprise workflow integrations both need a registry of executable code with policy enforcement. The previous split into two repos (Skills for MCP, Apps for legacy hooks) created overlapping surface area. This repo is the single chokepoint.

---

## What It Does

### Mode 1: MCP Skills (modern, agent-driven)

- 📋 **Skill registry** — register, list, update, remove skill manifests
- ⚖️ **Policy engine** — trust scoring, capability whitelists, resource limits, tenant isolation
- 🔌 **MCP protocol** — `/mcp/v1/tools` and `/mcp/v1/call` for agent runtimes
- 🏖️ **Sandboxed execution** — isolated VM/process per skill run with CPU, memory, and time caps
- 📜 **Audit trail** — every execution persisted with input, output, status

### Mode 2: Legacy Hooks (workflow-driven, ERP/shell integration)

- 🧩 **Extension registry** — register, enable, disable, prioritize extensions (lifecycle: unregistered → registered → enabled → disabled → error)
- 🎯 **Hook points** — `pre-execution`, `post-execution`, `on-error`, `on-complete`, `on-timeout`
- ⚙️ **Custom executors** — pluggable execution logic per extension
- 🐚 **Shell sandbox** — secure command execution with timeouts and env restrictions
- 🏢 **ERP integration** — SAP, Oracle, custom ERP connectors
- 📋 **Manifest-driven config** — extensions declared as JSON manifests

## What It Does NOT Do

| Concern | Owned by |
|---|---|
| Document retrieval / RAG | `Knowledge` |
| Model inference / provider routing | `Gateway` |
| Chat UI | `Chat` |
| Admin / operator UI | `Control` (NCC) — **Skills has no standalone admin UI** |
| Model registry / kill-switch | `Platform` |

---

## Why One Context, Two Modes

In the 2024-2025 design, MCP skills and workflow extensions were separate repos (`NexusAI-Skills` and `NexusAI-Apps`). In practice, both solve the same product problem — "register executable code, evaluate its policy, run it under isolation" — and they share 80% of their non-trivial surface (registry, policy, audit, sandbox).

**What changed in v2.0 (June 20, 2026):**
- One repository, one README, one API namespace
- **MCP mode** is the modern, primary path — for AI agent tool calls
- **Legacy hooks mode** is preserved for backward compatibility — for enterprise workflow integrations (ERP, shell, custom executors) that predate MCP adoption
- All new development should target MCP mode; legacy hooks receive maintenance only

**Why not just delete legacy hooks?**
- Real enterprise customers (SAP, ServiceNow, Jira shops) have invested in hook-based integrations
- Migrating them to MCP would be a 6-12 month effort
- Keeping the API surface unified (one repo, one owner) but supporting both modes is the cheapest path

---

## Architecture

```
                    ┌──────────────────────────────────────────┐
                    │          NexusAI-Skills                  │
                    │                                          │
  POST /api/skills  │   ┌────────────────┐  ┌──────────────┐   │  POST /mcp/v1/call
  PUT  /api/skills  │   │  Mode 1: MCP   │  │  Mode 2:     │   │  GET  /mcp/v1/tools
  DELETE            │   │  Skills        │  │  Legacy      │   │
                    │   │  (modern)      │  │  Hooks       │   │
                    │   │                │  │  (compat)    │   │
                    │   │  - Registry    │  │  - Extension │   │
                    │   │  - Policy      │  │    Registry  │   │
                    │   │  - Sandbox     │  │  - Hooks     │   │
                    │   │                │  │  - Shell     │   │
                    │   │                │  │  - ERP       │   │
                    │   └────────┬───────┘  └──────┬───────┘   │
                    │            │                 │           │
                    │            └────────┬────────┘           │
                    │                     ▼                    │
                    │         ┌──────────────────┐            │
                    │         │  Shared Runtime  │            │
                    │         │  (Prisma · Audit │            │
                    │         │   Prometheus)    │            │
                    │         └──────────────────┘            │
                    └──────────────────────────────────────────┘
                                         │
                                         ▼
              External APIs · Built-in connectors (Jira, ServiceNow, SAP)
```

**Shared runtime:** Both modes use the same database (Prisma + PostgreSQL), audit trail, and observability stack. The differences are only in the API surface and the policy evaluation.

---

## Public API Surface

### Mode 1: MCP Skills

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET`    | `/api/skills` | List skills | Bearer |
| `GET`    | `/api/skills/:id` | Skill detail | Bearer |
| `POST`   | `/api/skills` | Register skill | Bearer |
| `PUT`    | `/api/skills/:id` | Update skill | Bearer |
| `DELETE` | `/api/skills/:id` | Revoke skill | Bearer |
| `POST`   | `/api/skills/:id/evaluate` | Evaluate against policy | Bearer |
| `POST`   | `/api/skills/:id/execute` | Execute skill | Bearer |
| `GET`    | `/api/policies` | List policies | Bearer |
| `POST`   | `/api/policies` | Create policy | Bearer |
| `GET`    | `/mcp/v1/tools` | List MCP tools | Bearer |
| `POST`   | `/mcp/v1/call` | Call MCP tool | Bearer |

### Mode 2: Legacy Hooks (former NexusAI-Apps)

| Method | Endpoint | Description |
|---|---|---|
| `GET`    | `/api/v1/extensions` | List extensions |
| `GET`    | `/api/v1/extensions/:id` | Get extension |
| `POST`   | `/api/v1/extensions` | Register extension |
| `PUT`    | `/api/v1/extensions/:id` | Update extension |
| `DELETE` | `/api/v1/extensions/:id` | Unregister |
| `POST`   | `/api/v1/extensions/:id/enable` | Enable |
| `POST`   | `/api/v1/extensions/:id/disable` | Disable |
| `POST`   | `/api/v1/hooks/:hook` | Execute hook |
| `GET`    | `/api/v1/hooks/:id/results` | Get hook results |
| `POST`   | `/api/v1/shell/execute` | Execute command in sandbox |
| `GET`    | `/api/v1/shell/history` | Command history |
| `POST`   | `/api/v1/erp/connect` | Connect to ERP |
| `POST`   | `/api/v1/erp/fetch` | Fetch data |
| `POST`   | `/api/v1/erp/disconnect` | Disconnect |

> **Namespace note:** Mode 1 uses `/api/skills/*` and `/mcp/*`. Mode 2 uses `/api/v1/extensions/*`, `/api/v1/hooks/*`, etc. (with the `v1` prefix from the legacy Apps context). Both namespaces are stable; new development should target Mode 1.

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/healthz` | Liveness |
| `GET` | `/ready` | Readiness |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (Node.js 20+) for Mode 1; legacy Mode 2 hooks bridged via internal Go adapter |
| HTTP | Fastify 5 |
| Database | Prisma 5 (PostgreSQL) |
| Validation | Zod |
| Logging | Pino |
| Metrics | `prom-client` (Prometheus) |
| Container | Docker |

> **Mixed-language note:** Mode 1 (MCP) is the TypeScript implementation. Mode 2 (legacy hooks) preserves the Go-based extension executor from the original `NexusAI-Apps` codebase. A TypeScript bridge invokes the Go binary for hook execution. This avoids rewriting the Go executor that enterprise customers depend on.

---

## Repository Layout

```text
src/
├── mcp/                     Mode 1: MCP skills (TypeScript)
│   ├── registry.ts          Skill schema
│   ├── policy.ts            Trust scoring
│   ├── sandbox.ts           Isolated execution
│   └── routes.ts            /mcp/v1/* handlers
├── legacy/                  Mode 2: legacy hooks (Go adapter + TS bridge)
│   ├── extensions/          Extension registry (TS facade)
│   ├── hooks/               Hook executor (calls Go)
│   ├── shell/               Shell sandbox (Go)
│   ├── erp/                 ERP connectors (Go)
│   └── bridge.ts            TS-to-Go bridge
├── shared/                  Config, logger, types
├── infra/                   Prisma, metrics
└── index.ts                 Fastify bootstrap

legacy-go/                   Go source for Mode 2 executors
├── extensions/              Extension executor
├── shell/                   Shell sandbox
├── integration/             ERP connectors
└── monitor/                 Execution metrics

prisma/schema.prisma         Prisma schema (skills, policies, executions, extensions)
tests/                       Vitest unit suite
Dockerfile                   Production container
```

---

## Quick Start

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm test
pnpm build
pnpm start            # Fastify on :8083
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
| `SANDBOX_TIMEOUT` | Max execution time per skill/hook | `30s` |
| `SANDBOX_MEMORY_LIMIT` | Max memory per execution | `512MB` |
| `LEGACY_GO_BINARY` | Path to the Go executor binary (Mode 2) | `./bin/legacy-hooks-executor` |
| `LOG_LEVEL` | Pino log level | `info` |

---

## Testing & Quality Gates

```bash
pnpm test                            # Vitest unit suite
pnpm lint                            # ESLint
pnpm typecheck                       # TypeScript strict
go test ./legacy-go/...              # Mode 2 Go tests
```

Tests must cover new skill types, policy rules, hook points, and executor behavior.

---

## Built-in Connectors

| Connector | Mode | Notes |
|---|---|---|
| Jira | MCP | Search, create, update issues |
| ServiceNow | MCP | Incidents, change requests |
| SAP | Legacy hooks | Read-only fetch via RFC |
| Shell | Legacy hooks | Secure command execution |
| Custom | Both | Pluggable via manifest |

Add a new connector by registering a manifest at startup and providing the executor.

---

## Migration from NexusAI-Apps

If you have existing code, manifests, or deployment configs that reference `NexusAI-Apps`:

| Old (NexusAI-Apps) | New (NexusAI-Skills) |
|---|---|
| Repo: `ThomasVNN/NexusAI-Apps` | Repo: `ThomasVNN/NexusAI-Skills` (this) |
| Binary: `bin/apps` | Binary: `bin/legacy-hooks-executor` |
| Endpoint: `POST /api/v1/extensions` | Endpoint: `POST /api/v1/extensions` (unchanged) |
| Hook points: same | Hook points: same |
| Owner: App Agent | Owner: AI Agent (primary), App Agent (secondary) |
| Imports: `github.com/ThomasVNN/NexusAI-Apps/internal/extensions` | Imports: `github.com/ThomasVNN/NexusAI-Skills/legacy-go/extensions` |

The `NexusAI-Apps` GitHub repository is archived (read-only) as of June 20, 2026. Existing CI/CD and deployments should:
1. Update repo references
2. Use the new Go import paths
3. Keep existing extension manifests (no manifest changes required)

---

## Documentation

| Topic | Path |
|---|---| 
| Bounded context (canonical) | `docs/bounded-contexts/skills.md` |
| MCP transport spec | `docs/mcp.md` (if present) |
| Connector authoring | `docs/connectors.md` (if present) |
| Legacy hook migration | `docs/legacy-hooks-migration.md` (if present) |

---

## Contributing

1. Branch from `main`: `feature/<ticket>-<description>`
2. New MCP skills: add to `src/mcp/` with tests
3. New legacy hooks: avoid unless maintaining existing integrations
4. New connector: add manifest + executor + tests
5. PR → SA Agent → QA Agent → Release Manager
6. Never commit to `main` directly

---

## Governance

| Attribute | Value |
|---|---|
| Document owner | AI Agent |
| Review cadence | Monthly |
| Last updated | June 20, 2026 |
| License | Internal — NexusAI Platform |
| v2.0 refactor | Apps merged in |

---

*Canonical product spec: `docs/bounded-contexts/skills.md` in the workspace root. The `NexusAI-Apps` repository is archived; this README is the single source of truth.*
