# Contributing to NexusAI

Thank you for your interest in contributing to NexusAI! Our goal is to build an open-source, high-performance, and secure AI framework. We welcome contributions from developers, designers, writers, and AI engineers.

By participating in this project, you agree to abide by our Code of Conduct.

---

## 🌳 Branching Strategy

Our repositories follow a clean Git branching model:

* **`main`**: Contains production-ready code. No direct modifications are allowed.
* **`staging`**: Staging environment for quality assurance and integration verification.
* **`develop`**: Integration branch for active development.
* **`feature/*`**: Scoped branch for introducing new features (e.g., `feature/mcp-auth`).
* **`fix/*`**: Scoped branch for resolving bug fixes (e.g., `fix/db-leak`).
* **`hotfix/*`**: Emergency production patch branch branched off `main`.

---

## 💬 Conventional Commits Standard

We enforce the [Conventional Commits](https://www.conventionalcommits.org/) specification for all repository logs. This ensures clean, parsable commit histories.

### Commit Format:
```text
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

### Common Types:
* **`feat`**: Introducing new functionality (e.g., `feat(gateway): support streaming completions`).
* **`fix`**: Fixing a bug (e.g., `fix(chat): reconnect WebSocket on disconnect`).
* **`refactor`**: Code change that neither fixes a bug nor adds a feature.
* **`perf`**: Code change that improves performance.
* **`test`**: Adding missing tests or correcting existing tests.
* **`docs`**: Documentation-only changes.
* **`ci`**: Changes to our CI/CD pipelines or deployment configurations.

---

## 🛠️ Contribution Workflow

1. **Fork or Branch**: If you are an external contributor, fork this repository. Core team members should create a scoped branch (`feature/*` or `fix/*`) directly.
2. **Write Clean Code**: Follow SOLID principles, Domain Separation, and write comprehensive unit tests.
3. **Run Quality Gating Checks**:
   * Format code and run linters.
   * Verify all tests pass.
   * Ensure no hardcoded secrets or infrastructure configurations exist.
4. **Commit & Push**: Commit your changes using conventional commit formats and push them to your remote branch.
5. **Open a Pull Request**: Submit a Pull Request targeting the `develop` branch. Use the official PR template.
6. **Code Review & Merge**:
   * Your PR will undergo static scans and unit checks automatically.
   * A minimum of two code reviews is required from the codeowners team.
   * Once approved, a maintainer will squash-merge your PR.
