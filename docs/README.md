# Compliance Research App — Implementation Milestones

This directory is the implementation contract for the compliance research app. Build the milestones in order and stop at every checkpoint. Do not begin the next milestone until the current checkpoint has been reviewed and accepted.

The target product is a single-user, unauthenticated compliance research application with:

- PDF ingestion and AI-assisted rule extraction.
- Human review and publication through Sanity Studio.
- A cited compliance research chat that searches Sanity first and the web only when needed.
- Permanent conversation storage without a global history browser.
- A bearer-protected, read-only MCP endpoint.
- A public Vercel deployment protected by durable per-IP rate limits.

The existing Prisma workspace, handbook, and verification implementation is not the target architecture. Remove or replace that code only when the corresponding milestone calls for it.

## Milestone order

| Order | Milestone | Deliverable | Stop and check |
| --- | --- | --- | --- |
| 0 | [Dependencies and running](00-dependencies-and-running.md) | Packages, services, environment, commands | Both applications start with validated configuration |
| 1 | [Architecture and foundation](01-architecture-overview.md) | Target structure, shared clients, errors, rate limiting | Foundation compiles and health checks pass |
| 2 | [Sanity content model](02-sanity-schema-design.md) | Documents, rules, conversations, messages, GROQ | Studio builds and schemas are reviewable |
| 3 | [PDF ingestion](03-api-implementation.md) | Blob ingress, validation, Sanity storage, Gemini extraction | A valid PDF produces rule drafts |
| 4 | [Rule review](04-rule-review-and-publication.md) | Studio review and published-only reads | Drafts remain hidden until published |
| 5 | [Compliance chat](05-compliance-research-chat.md) | Sanity-first search, Firecrawl fallback, cited streaming | Answers follow the source policy |
| 6 | [Conversation persistence](06-conversation-persistence.md) | Permanent messages and URL-only reopening | Exact conversation URLs restore messages |
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

- PDF only, maximum 10 MB and 100 pages.
- Private Vercel Blob is temporary ingress storage; Sanity is the durable file store.
- Extracted rules are drafts until a human publishes them.
- Industry is required free text, not a taxonomy document.
- Gemini model is selected through `GEMINI_MODEL`.
- Firecrawl searches preferred official domains first, then clearly labeled secondary sources.
- External findings never create or modify Sanity rules.
- Five ingestions and thirty chat turns per rolling hour per IP.
- Conversations are permanent and have no list or delete interface.
- MCP is read-only and protected by `MCP_TOOL_SECRET`.

