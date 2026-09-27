---
name: compliance-app-setup
description: Prepare or repair dependencies, environment configuration, and local startup for the compliance research app. Use for milestone 0 setup work; not for implementing product features.
---

# Compliance App Setup

Read the [shared protocol](../../../docs/agent-implementation-protocol.md) and [`docs/00-dependencies-and-running.md`](../../../docs/00-dependencies-and-running.md) completely.

## Approach

1. Inventory current imports and package versions before changing dependencies. Treat `package.json` and both lockfiles as environment truth.
2. Install the documented runtime packages together, keeping AI SDK peer versions compatible and upgrading `@sanity/client` enough for the Actions API.
3. Update scripts only when the milestone commands cannot run with the existing scripts.
4. Keep `.env.example` exhaustive and placeholder-only. Validate server variables in a server-only module; preserve the user's real environment files.
5. Configure the standalone Studio, private dataset, local CORS, Blob, and Redis connections without implementing feature routes.
6. Run both apps, type-check, and build them. Resolve dependency or configuration failures before feature work.

## Invariants

- Sanity is the durable store; Prisma and better-auth are legacy dependencies during migration.
- Firecrawl uses native server-side `fetch`; add no SDK unless the user changes the contract.
- A package is removable only after `rg` confirms no live import or script depends on it.
- No secret uses a `NEXT_PUBLIC_` name.

## Done

Milestone 0's manual checkpoint passes and the next feature can rely on validated configuration, both local applications, and a committed lockfile.

