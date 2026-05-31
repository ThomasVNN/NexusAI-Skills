# Skills Event Architecture

NexusAI-Skills uses NATS JetStream as the default event platform for governed tool and skill execution lifecycle events.

## Subjects

- `tenant.{id}.skill.registered`
- `tenant.{id}.skill.evaluated`
- `tenant.{id}.skill.invocation.requested`
- `tenant.{id}.skill.invocation.completed`
- `tenant.{id}.skill.invocation.failed`
- `tenant.{id}.skill.revoked`

## Related Runtime Subjects

Skills may correlate with:

- `tenant.{id}.agent.*`
- `tenant.{id}.knowledge.*`
- `tenant.{id}.model.*`

## Event Envelope

Events must include event ID, event type, tenant ID, source service, correlation ID, schema version, occurred timestamp, and sanitized payload.

## Security Rules

Skill events must never publish secrets, raw credentials, sandbox escape details that would aid abuse, or unredacted tool inputs containing sensitive data. Audit records should reference secret manager identifiers, not secret values.
