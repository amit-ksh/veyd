---
name: compliance-document-removal
description: Implement or audit safe project-owned compliance document removal, derived-rule and asset cleanup, retrieval tombstones, and preserved historical citation origins. Use for milestone 12.
---

# Compliance Document Removal

Treat removal as a coordinated, resumable boundary rather than a single delete call.

1. Read [`docs/12-document-context-removal.md`](../../../docs/12-document-context-removal.md), its linked feasibility report, and the shared implementation protocol completely.
2. Verify Milestone 11 ownership and project-scoped retrieval are complete. Stop if document ownership cannot be proven server-side.
3. Inventory the source document, strong references, draft/published/version rule IDs, and asset references with an uncached raw Sanity client. Completion means every candidate ID and project mismatch is accounted for before mutation.
4. Persist the PostgreSQL tombstone and make all app/chat/MCP retrieval honor it before destructive work.
5. Use an explicit-ID atomic Sanity transaction with conflict protection when the family fits. For an oversized family, use the contract's deterministic tombstone-backed batches and delete the source only after every dependent variant is gone. Persist the asset ID before either path and delete the asset only when no surviving document references it.
6. Keep messages and citation snapshots. Present their title, formal citation, and pages with a `Source removed` state and no live internal link.
7. Make retries idempotent and recovery resumable across the PostgreSQL/Sanity transaction boundary.
8. Run every removal, isolation, shared-asset, historical-citation, and failure checkpoint. Stop after reporting evidence.

Do not add bulk deletion, source-history purge, project deletion, conversation deletion, or a claim of immediate CDN/backup erasure.
