# Security Policy for NexusAI

NexusAI is dedicated to building secure, enterprise-grade AI infrastructure. This document outlines our security reporting guidelines, supported versions, and vulnerabilities disclosure path.

---

## Supported Versions

Only the latest active release versions of our core components receive security patches. We recommend updating your environments immediately upon new major or minor version releases.

| Version | Supported | Notes |
| :--- | :--- | :--- |
| `v2.x.x` | ✅ Active | Current production-ready standard. |
| `v1.x.x` | ⚠️ Limited | Only receiving critical patches. |
| `< v1.0.0` | ❌ Deprecated | Not supported. |

---

## Reporting a Vulnerability

**DO NOT open a public GitHub issue for security bugs or vulnerabilities.**

Instead, please report security issues through one of the following channels:
1. **GitHub Private Vulnerability Reporting**: If supported in this repository, click **Report a vulnerability** under the **Security** tab.
2. **Secure Email**: Send a detailed description of the vulnerability to [security@nexusai.dev](mailto:security@nexusai.dev).

### What to Include:
* A detailed description of the vulnerability and its potential impact.
* Steps to reproduce the issue (including proof-of-concept scripts or API payloads).
* Ephemeral environments details where the issue was confirmed.

### Our Commitment:
* **Response**: We will acknowledge your report within 48 business hours.
* **Resolution**: We will provide a timeline for resolving the issue and keep you updated.
* **Credit**: If requested, we will publicly credit you for the discovery in our release notes once the patch is published.
