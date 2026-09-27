---
name: compliance-foundation
description: "Implement the compliance app's shared server foundation: validated configuration, Sanity clients, API errors, Upstash rate limiting, and initial shell. Use for milestone 1 or repairs to these cross-cutting boundaries."
---

# Compliance Foundation

Read the [shared protocol](../../../docs/agent-implementation-protocol.md) and [`docs/01-architecture-overview.md`](../../../docs/01-architecture-overview.md) completely.

## Approach

1. Trace legacy Prisma/auth imports and identify the smallest safe path that lets the root app render without them.
2. Establish server-only configuration and separate published-read and write-capable Sanity clients.
3. Implement the common error envelope and correlation IDs before feature routes depend on them.
4. Implement trusted Vercel IP extraction and distinct Upstash rolling-window limiters for ingestion and chat.
5. Create the minimal link-backed application shell; leave feature panels explicitly unavailable until their milestones.
6. Prove no credential-bearing module crosses a Client Component boundary.

## Invariants

- Runtime reads use the published perspective; writes use a non-CDN server client.
- Ingestion is counted once at upload-token issuance.
- Route handlers will call shared services rather than embed integration logic.
- Missing configuration fails by variable name without revealing values.

## Done

Milestone 1's shell, configuration, error, and rate-limit checks pass without relying on Prisma or better-auth at runtime.

