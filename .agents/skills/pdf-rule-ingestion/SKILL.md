---
name: pdf-rule-ingestion
description: Implement the bounded PDF upload, temporary private Blob ingress, Sanity asset storage, Gemini extraction, and transactional rule-draft creation. Use for milestone 3 ingestion work.
---

# PDF Rule Ingestion

Read the [shared protocol](../../../docs/agent-implementation-protocol.md) and [`docs/03-api-implementation.md`](../../../docs/03-api-implementation.md) completely.

## Approach

1. Confirm milestones 0–2 pass and the write client, schemas, shared errors, and ingestion limiter exist.
2. Implement the scoped private Blob token path first; prove the browser can upload a PDF without sending its body through a Vercel Function.
3. Implement the ingest route as orchestration over narrow services: owned-Blob fetch, binary/PDF validation, Sanity asset/document write, Gemini extraction, draft transaction, status update, and Blob cleanup.
4. Define the Gemini output with Zod and post-validate page ranges, dates, unique keywords, and empty-result behavior.
5. Create rule drafts through the Sanity Actions API using linked generated published/draft IDs. Keep the batch atomic.
6. Implement every failure state alongside the happy path and delete the temporary Blob in a `finally` boundary.
7. Add document list/detail reads only after ingestion durability is proven.

## Invariants

- PDF only, at most 10 MB and 100 pages.
- The ingest route accepts an authorized private Blob locator, not arbitrary URLs or multipart file bodies.
- Sanity is durable; Blob is temporary.
- Gemini output never publishes a rule.
- An empty validated rule array is a successful ready document.
- Logs may contain correlation/document IDs, never file contents, tokens, or raw upstream bodies.

## Done

Every milestone 3 manual scenario passes, including invalid binaries, both limits, upstream failure, atomic drafts, and Blob cleanup.

