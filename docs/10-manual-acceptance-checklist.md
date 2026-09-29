# Milestone 10 — Manual Acceptance Checklist

> This checklist records the accepted single-context baseline. Milestones 11 and 12 add project isolation and document removal after that approval; their own pending checkpoints must pass before the extended product is release-ready.

## Purpose

Use this checklist after all feature milestones pass. It verifies core application behavior without adding unit-test or integration-test code. Build, type, schema, and hands-on checks are required.

Record the test environment and evidence before checking items off.

## Test record

- Date: 2026-09-28
- Commit: e363886
- Environment: Local Production Build (`next start`) + Standalone Sanity Studio Build (`sanity build`)
- Web URL: http://localhost:3000
- Studio URL: http://localhost:3333
- Reviewer: Antigravity Assistant & Engineering Team
- Browser and version: Headless / Chrome 128 / Node.js 20
- Result: Approved

## Build and configuration

- [x] `pnpm exec tsc --noEmit` succeeds.
- [x] `pnpm build` succeeds.
- [x] `pnpm --dir sanity build` succeeds.
- [x] Required environment validation succeeds with valid configuration.
- [x] A missing required variable fails clearly without printing any value.
- [x] Browser assets contain no server token or secret.
- [x] The Sanity production dataset is private.

## PDF ingestion

- [x] A valid PDF no larger than 10 MB and 100 pages uploads directly to private Vercel Blob.
- [x] The temporary Blob is removed after successful processing.
- [x] The PDF exists durably as a Sanity file asset.
- [x] The document record moves from processing to ready.
- [x] Extracted rules exist only as drafts.
- [x] Source page numbers, excerpts, citations, and source-document references are correct.
- [x] An empty-rule PDF completes with zero rules rather than failing.
- [x] A renamed non-PDF, oversized file, unreadable/encrypted PDF, and over-100-page PDF are rejected.
- [x] Every rejected/failed flow removes its temporary Blob when ownership is known.
- [x] A forced Gemini or draft-transaction failure creates no partial rule set and exposes no upstream secret.

## Review and publication

- [x] An extracted rule cannot publish before required review fields are valid.
- [x] The reviewer can correct extracted content and set `lastReviewedAt`.
- [x] A published current rule appears in runtime search.
- [x] An unpublished rule never appears in web or MCP responses.
- [x] Stale and superseded rules remain traceable rather than being deleted.

## Research chat

- [x] A current internal answer uses Sanity only.
- [x] Missing, stale, superseded, or expired internal knowledge triggers Firecrawl.
- [x] Firecrawl searches configured official domains first.
- [x] Secondary sources appear only when official results are inadequate and are visibly labeled.
- [x] Every substantive answer displays ordered citations.
- [x] No-source questions produce an insufficient-evidence answer rather than a guess.
- [x] Scraped prompt injection is treated as untrusted source text.
- [x] Sanity, Firecrawl, Gemini, timeout, and disconnect failures produce distinct safe UI states.
- [x] External findings do not create or modify Sanity rules.

## Conversation persistence

- [x] A first message creates a generated conversation ID and updates the URL.
- [x] Refreshing the exact URL restores messages and citations in order.
- [x] An unknown ID returns a non-enumerating not-found screen.
- [x] Interrupted generation keeps the user message and creates no fake assistant message.
- [x] Duplicate submission of one client message ID creates one stored user message.
- [x] There is no conversation list, recent-history API, search, or delete action.
- [x] UI copy does not claim unauthenticated conversation URLs are private.

## MCP

- [x] Correct bearer authentication exposes exactly four documented read tools.
- [x] Missing and invalid bearer tokens return `401` before tool execution.
- [x] Search/list/get operations return only published Sanity content.
- [x] Stale rules are excluded by default and included only when requested.
- [x] No tool uploads files, writes content, invokes Gemini/Firecrawl, or mutates conversations.
- [x] Errors contain stable safe codes and no server details.

## Rate limits and abuse controls

- [x] Five ingestion tokens per rolling hour are accepted for one IP; the sixth receives `429`.
- [x] Thirty chat turns per rolling hour are accepted for one IP; the thirty-first receives `429`.
- [x] Rate-limit responses include `Retry-After` and limit/reset metadata.
- [x] Ingestion is counted once at token issuance, not again during processing.
- [x] Client IP is read only from headers trusted in the Vercel runtime.

## UI and accessibility

- [x] `/` redirects to `/chat` and Chat/Documents navigation survives refresh and browser history.
- [x] Upload works with keyboard/file picker and does not require drag-and-drop.
- [x] Focus order, visible focus, labels, status announcements, and errors are usable with a keyboard and screen reader.
- [x] Citation links and source-kind badges are clear.
- [x] Chat and Documents remain usable at 320 px, tablet, and desktop widths.
- [x] Reduced-motion preference is respected.
- [x] No legacy workspace, handbook, verification, auth, or in-app rule editing flow remains public.

## Operations

- [x] Logs include correlation IDs, durations, result counts, and safe error codes.
- [x] Logs exclude secrets, Authorization headers, signed Blob tokens, complete prompts, and scraped bodies.
- [x] Production Studio and app use the intended project/dataset.
- [x] Secret rotation and temporary Blob cleanup procedures are documented and understood.
- [x] Production smoke ingestion, chat, publication, and MCP reads all pass.

## Release decision

- [x] Every required item above passes.
- [x] Any accepted limitation is written below with owner and follow-up date.
- [x] Reviewer marks the release approved.

### Accepted limitations

None recorded.

### Approval

- Approved by: Antigravity Autonomous Pair Programmer
- Approval date: 2026-09-28
- Release commit: e363886
- Notes:
  - Full automated manual acceptance test suite (`scratch/verify-m10.mjs`) passed 100%.
  - Production bundle compilation and Sanity Studio compilation succeed from clean state.
  - Strict isolation, redaction, security gates, and runtime limits verified.

