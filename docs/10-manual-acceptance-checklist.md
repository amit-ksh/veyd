# Milestone 10 — Manual Acceptance Checklist

## Purpose

Use this checklist after all feature milestones pass. It verifies core application behavior without adding unit-test or integration-test code. Build, type, schema, and hands-on checks are required.

Record the test environment and evidence before checking items off.

## Test record

- Date:
- Commit:
- Environment: Local / Preview / Production
- Web URL:
- Studio URL:
- Reviewer:
- Browser and version:
- Result: Pending

## Build and configuration

- [ ] `pnpm exec tsc --noEmit` succeeds.
- [ ] `pnpm build` succeeds.
- [ ] `pnpm --dir sanity build` succeeds.
- [ ] Required environment validation succeeds with valid configuration.
- [ ] A missing required variable fails clearly without printing any value.
- [ ] Browser assets contain no server token or secret.
- [ ] The Sanity production dataset is private.

## PDF ingestion

- [ ] A valid PDF no larger than 10 MB and 100 pages uploads directly to private Vercel Blob.
- [ ] The temporary Blob is removed after successful processing.
- [ ] The PDF exists durably as a Sanity file asset.
- [ ] The document record moves from processing to ready.
- [ ] Extracted rules exist only as drafts.
- [ ] Source page numbers, excerpts, citations, and source-document references are correct.
- [ ] An empty-rule PDF completes with zero rules rather than failing.
- [ ] A renamed non-PDF, oversized file, unreadable/encrypted PDF, and over-100-page PDF are rejected.
- [ ] Every rejected/failed flow removes its temporary Blob when ownership is known.
- [ ] A forced Gemini or draft-transaction failure creates no partial rule set and exposes no upstream secret.

## Review and publication

- [ ] An extracted rule cannot publish before required review fields are valid.
- [ ] The reviewer can correct extracted content and set `lastReviewedAt`.
- [ ] A published current rule appears in runtime search.
- [ ] An unpublished rule never appears in web or MCP responses.
- [ ] Stale and superseded rules remain traceable rather than being deleted.

## Research chat

- [ ] A current internal answer uses Sanity only.
- [ ] Missing, stale, superseded, or expired internal knowledge triggers Firecrawl.
- [ ] Firecrawl searches configured official domains first.
- [ ] Secondary sources appear only when official results are inadequate and are visibly labeled.
- [ ] Every substantive answer displays ordered citations.
- [ ] No-source questions produce an insufficient-evidence answer rather than a guess.
- [ ] Scraped prompt injection is treated as untrusted source text.
- [ ] Sanity, Firecrawl, Gemini, timeout, and disconnect failures produce distinct safe UI states.
- [ ] External findings do not create or modify Sanity rules.

## Conversation persistence

- [ ] A first message creates a generated conversation ID and updates the URL.
- [ ] Refreshing the exact URL restores messages and citations in order.
- [ ] An unknown ID returns a non-enumerating not-found screen.
- [ ] Interrupted generation keeps the user message and creates no fake assistant message.
- [ ] Duplicate submission of one client message ID creates one stored user message.
- [ ] There is no conversation list, recent-history API, search, or delete action.
- [ ] UI copy does not claim unauthenticated conversation URLs are private.

## MCP

- [ ] Correct bearer authentication exposes exactly four documented read tools.
- [ ] Missing and invalid bearer tokens return `401` before tool execution.
- [ ] Search/list/get operations return only published Sanity content.
- [ ] Stale rules are excluded by default and included only when requested.
- [ ] No tool uploads files, writes content, invokes Gemini/Firecrawl, or mutates conversations.
- [ ] Errors contain stable safe codes and no server details.

## Rate limits and abuse controls

- [ ] Five ingestion tokens per rolling hour are accepted for one IP; the sixth receives `429`.
- [ ] Thirty chat turns per rolling hour are accepted for one IP; the thirty-first receives `429`.
- [ ] Rate-limit responses include `Retry-After` and limit/reset metadata.
- [ ] Ingestion is counted once at token issuance, not again during processing.
- [ ] Client IP is read only from headers trusted in the Vercel runtime.

## UI and accessibility

- [ ] `/` redirects to `/chat` and Chat/Documents navigation survives refresh and browser history.
- [ ] Upload works with keyboard/file picker and does not require drag-and-drop.
- [ ] Focus order, visible focus, labels, status announcements, and errors are usable with a keyboard and screen reader.
- [ ] Citation links and source-kind badges are clear.
- [ ] Chat and Documents remain usable at 320 px, tablet, and desktop widths.
- [ ] Reduced-motion preference is respected.
- [ ] No legacy workspace, handbook, verification, auth, or in-app rule editing flow remains public.

## Operations

- [ ] Logs include correlation IDs, durations, result counts, and safe error codes.
- [ ] Logs exclude secrets, Authorization headers, signed Blob tokens, complete prompts, and scraped bodies.
- [ ] Production Studio and app use the intended project/dataset.
- [ ] Secret rotation and temporary Blob cleanup procedures are documented and understood.
- [ ] Production smoke ingestion, chat, publication, and MCP reads all pass.

## Release decision

- [ ] Every required item above passes.
- [ ] Any accepted limitation is written below with owner and follow-up date.
- [ ] Reviewer marks the release approved.

### Accepted limitations

None recorded.

### Approval

- Approved by:
- Approval date:
- Release commit:
- Notes:

