# Compliance Research App — Implementation Milestones

This directory is the implementation contract for the compliance research app. Build the milestones in order and stop at every checkpoint. Do not begin the next milestone until the current checkpoint has been reviewed and accepted.

The target product is an authenticated compliance research application with:

- User authentication (sign in / sign up) managed via Better-Auth and Prisma/PostgreSQL before platform access.
- User-scoped conversation and message storage persisted in PostgreSQL via Prisma.
- Sanity Content Lake for compliance PDF file assets, AI-extracted rules, and editorial review.
- PDF ingestion and AI-assisted rule extraction.
- Human review and publication through Sanity Studio.
- A cited compliance research chat that searches Sanity first and the web only when needed.
- A bearer-protected, read-only MCP endpoint.
- A public Vercel deployment protected by authentication and durable per-IP rate limits.

## Milestone order

| Order | Milestone | Deliverable | Stop and check |
| --- | --- | --- | --- |
| 0 | [Dependencies and running](00-dependencies-and-running.md) | Packages, services, environment, commands | Both applications start with validated configuration |
| 1 | [Architecture and foundation](01-architecture-overview.md) | Target structure, shared clients, errors, rate limiting | Foundation compiles and health checks pass |
| 2 | [Sanity content model](02-sanity-schema-design.md) | Documents, rules, conversations, messages, GROQ | Studio builds and schemas are reviewable |
| 3 | [PDF ingestion](03-api-implementation.md) | Blob ingress, validation, Sanity storage, Gemini extraction | A valid PDF produces rule drafts |
| 4 | [Rule review](04-rule-review-and-publication.md) | Studio review and published-only reads | Drafts remain hidden until published |
| 5 | [Compliance chat](05-compliance-research-chat.md) | Sanity-first search, Firecrawl fallback, cited streaming | Answers follow the source policy |
| 6 | [Conversation persistence](06-conversation-persistence.md) | User-scoped conversation and message storage in PostgreSQL | Conversations restore accurately per authenticated user |
| 7 | [Public MCP server](07-public-mcp-server.md) | Read-only Sanity retrieval over Streamable HTTP | Authorized MCP calls work; writes are impossible |
| 8 | [Dashboard UI](08-dashboard-ui.md) | Chat and Documents tabs using the supplied design direction | Desktop and mobile flows are usable |
| 9 | [Deployment and operations](09-deployment-and-operations.md) | Vercel, Sanity Studio, secrets, observability | Production smoke checks pass |
| 10 | [Manual acceptance](10-manual-acceptance-checklist.md) | End-to-end release checklist | Every required scenario is signed off |

## Checkpoint protocol

At the end of each milestone:

1. Run the listed build/type/schema commands.
2. Perform the manual scenarios exactly as written.
3. Record evidence in the milestone's **Checkpoint record** section: date, commit, reviewer, result, and notes.
4. Fix failures before marking the milestone complete.

These checkpoints are manual acceptance checks. This plan intentionally does not add unit-test or integration-test suites.

## AI implementation skills

Repository-local, model-agnostic implementation skills live under [`.agents/skills/`](../.agents/skills/). Start with [`AGENTS.md`](../AGENTS.md), which routes each feature request to its matching skill and technical milestone. Every skill uses the same [implementation protocol](agent-implementation-protocol.md), stops at its milestone checkpoint, and treats these documents as the source of truth.

## Locked v1 boundaries

- Platform access requires user authentication (Better-Auth + Prisma).
- PDF only, maximum 10 MB and 100 pages.
- Private Vercel Blob is temporary ingress storage; Sanity is the durable file store.
- Extracted rules are drafts until a human publishes them in Sanity Studio.
- Industry is required free text, not a taxonomy document.
- Gemini model is selected through `GEMINI_MODEL`.
- Firecrawl searches preferred official domains first, then clearly labeled secondary sources.
- External findings never create or modify Sanity rules.
- Five ingestions and thirty chat turns per rolling hour per IP.
- Conversations and messages are stored in PostgreSQL via Prisma scoped to the authenticated user.
- MCP is read-only and protected by `MCP_TOOL_SECRET`.

## Post-release extension milestones

Milestone 10 records acceptance of the original single-context release. The following extensions reopen release acceptance and must be completed in order:

| Order | Milestone | Deliverable | Stop and check |
| --- | --- | --- | --- |
| 11 | [Project context and MCP scope](11-project-context-and-mcp-scope.md) | User-owned Food/Civil-style projects, scoped data, sidebar list/add, project-bound MCP credentials | Two projects remain isolated through app and MCP |
| 12 | [Document context removal](12-document-context-removal.md) | Authorized document/rule/asset cleanup with retained historical citation origins | Removed context is unreachable while old citations remain attributable |

For the extended product, the project-bound credential contract in Milestone 11 replaces the global `MCP_TOOL_SECRET` boundary above. The original statement remains the historical Milestone 0–10 contract.
