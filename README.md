# NexusAI-Skills 🛠️

Welcome to the **NexusAI Skills Registry** microservice, a high-security metadata registry and execution policy binding engine for custom agent tools (Skills) within the NexusAI local dev stack.

This service manages the lifecycle of dynamic skills (e.g., custom web scrapers, citation matchers, or eKYC authenticators) and assesses their safety before letting agents execute them.

---

## 1. Directory Structure

```text
├── src/
│   ├── registry.ts           # Skill schema definition and dynamic storage
│   ├── policy.ts             # Security policy and trust score evaluation engine
│   └── index.ts              # Fastify API Server
├── tests/
│   └── skills.test.ts        # Unit test suite (Vitest)
├── Dockerfile                # Production container builder
├── package.json              # Service configuration and scripts
├── tsconfig.json             # TypeScript compiler options
└── README.md                 # Project roadmap
```

---

## 2. API Endpoints

- **`GET /health`**: Returns system health status.
- **`GET /api/skills`**: Retrieves the list of all registered agent skills.
- **`POST /api/skills`**: Registers a new dynamic skill.
- **`POST /api/skills/:id/evaluate`**: Evaluates a skill against default system execution policy constraints.
- **`DELETE /api/skills/:id`**: Administratively revokes a skill.

---

## 3. Getting Started

### Installation
```bash
pnpm install
```

### Run Tests
```bash
pnpm test
```

### Build & Run
```bash
pnpm build
pnpm start
```
The service will start listening on port `8083`.
