# Milestone 12 — Safe Document and Active-Context Removal

## Outcome

Let an authorized project owner remove an uploaded compliance document and every rule derived from it from that project's active application context. Removal covers published and unpublished Sanity variants and deletes the durable PDF asset when no other record uses it.

Existing conversation messages remain. Their citation snapshots continue to show where an answer was derived, with the internal source visibly marked **Source removed** and without a working PDF/rule link.

This behavior is feasible with Sanity's reference and transaction model. See the [feasibility report](research/document-deletion-feasibility.md). Sanity blocks deletion through strong references, supports atomic multi-document transactions, and represents assets as deletable documents. Relevant primary documentation:

- [References and strong-reference deletion behavior](https://www.sanity.io/docs/studio/reference-type)
- [Atomic transactions with `@sanity/client`](https://www.sanity.io/docs/apis-and-sdks/js-client-transactions)
- [Document deletion and draft deletion](https://www.sanity.io/docs/apis-and-sdks/js-client-deleting)
- [Deleting published documents with drafts/versions](https://www.sanity.io/docs/content-lake/dispatch-actions)
- [Asset deletion](https://www.sanity.io/docs/content-lake/manage-assets)

## Meaning of removal

Removal guarantees that, after completion:

- the document is absent from the project's Documents list/detail API;
- all rules derived through `sourceDocument` are absent in draft, published, and known release/version forms;
- chat and MCP cannot retrieve the document or its rules;
- the PDF asset is deleted when it is no longer referenced;
- new answers cannot cite or use the removed source;
- historical conversation messages remain with citation-origin metadata and a removed-source state.

Removal does **not** claim immediate universal byte erasure. Sanity history retention, existing backups, CDN caches, external copies, client caches, logs, and already generated model output can outlive active records. The UI must use “Remove from project” rather than “permanently erase everywhere.” Do not enable Sanity history purge unless a later retention contract explicitly requires it.

## Prerequisite

Milestone 11 must be complete. The deletion route derives ownership from the authenticated session and project route; it cannot be exposed against the current global document model.

## Historical citation contract

For internal Sanity sources, persist citation data as a snapshot at answer time rather than depending on the source remaining queryable:

```ts
type Citation = {
  sourceKind: "sanity" | "official-web" | "secondary-web"
  title: string
  url?: string
  ruleId?: string
  documentId?: string
  documentTitle?: string
  citation?: string
  sourcePages?: number[]
  projectId?: string
}

type PresentedCitation = Citation & {
  availability: "active" | "removed"
  removedAt?: string
}
```

Sanity citations created after this milestone must snapshot `documentTitle`, formal `citation`, and `sourcePages`. Preserve existing title/rule/document identifiers for older messages. Do not copy the full PDF, full rule requirement, evidence excerpt, or internal file URL into PostgreSQL merely to survive deletion.

Add a PostgreSQL tombstone that records the removal boundary and makes history rendering deterministic:

```prisma
model RemovedComplianceSource {
  id                String   @id @default(cuid())
  projectId         String
  documentId        String
  documentTitle     String
  removedByUserId   String
  removedAt         DateTime
  deletionStatus    String   // pending | deleting | complete | failed
  sanityTransaction String?
  sourceAssetId     String?
  deletionPlan      Json?    // validated explicit Sanity IDs and progress cursor
  removedRuleCount  Int?
  assetStatus       String?  // deleted | retained-shared | not-found
  lastErrorCode     String?

  @@unique([projectId, documentId])
  @@index([projectId, deletionStatus])
}
```

Conversation reads annotate matching citation snapshots as `availability: "removed"`. The UI displays the stored source title, formal citation, and source pages, disables the internal link, and shows **Source removed**. Messages and citations are not deleted or rewritten.

## API contract

`DELETE /api/projects/[projectId]/documents/[documentId]`

Request:

```ts
type RemoveDocumentRequest = {
  confirmDocumentId: string
}
```

Require `confirmDocumentId` to exactly match the path document ID. The server:

1. authenticates the user;
2. verifies ownership of the project;
3. checks the tombstone before requiring a live Sanity document and returns its stored result when already complete;
4. acquires the deletion lease, then rechecks and resumes any pending or failed tombstone;
5. for a first attempt, fetches the document through an uncached write-capable client, verifies `projectId`, inventories the deletion family, and persists the asset ID plus explicit deletion plan before mutating Sanity;
6. performs bounded Sanity deletion;
7. verifies absence from active queries;
8. stores the terminal counts and asset outcome, then marks the tombstone complete.

Success returns:

```ts
type RemoveDocumentResponse = {
  documentId: string
  status: "removed"
  removedRuleCount: number
  assetStatus: "deleted" | "retained-shared" | "not-found"
  removedAt: string
}
```

Return a non-enumerating `404` for unknown or cross-project documents when no owned tombstone exists. A completed tombstone makes retries idempotent and returns the same stored terminal result even though the Sanity source no longer exists. Return `409 DELETION_IN_PROGRESS` while another request owns an active deletion lease.

## Safe deletion algorithm

Use an uncached client with `perspective: "raw"` and synchronous mutation visibility.

1. After project authorization, read the tombstone. Return a completed result immediately; otherwise acquire a short project/document deletion lease using the existing durable Redis connection and re-read the state under the lease.
2. For a first attempt, fetch the source document `_id`, `_rev`, `projectId`, title, file asset `_ref`, and every compliance rule that strongly references it. Inventory published IDs plus all draft and known version IDs. Reject any matched rule whose stored project differs from the document project.
3. Persist the `RemovedComplianceSource` tombstone with the asset ID, validated explicit deletion IDs, counts, and progress cursor before destructive work. Retrieval services exclude pending/deleting tombstones immediately. A retry uses this plan but still verifies surviving IDs before each mutation.
4. Re-fetch or revision-check the inventory before committing. A concurrent content change fails with a conflict and leaves the tombstone retryable.
5. When the complete request fits within Sanity's mutation limit, delete every rule variant before the source document within one explicit-ID Sanity transaction. Include the source document's own draft/version variants if present. Never use a broad delete-by-query without first materializing and validating every ID.
6. For an oversized family, keep the tombstone authoritative and delete validated rule/version IDs in deterministic bounded transactions, recording the cursor after every successful batch. Delete the source document only after a fresh strong-reference check proves no dependent rule variant survives. This is a recovery path, not partial user-visible removal: the tombstone keeps the entire family unavailable from the first committed batch onward.
7. Using the persisted asset ID, check whether any surviving Sanity document references the file asset. Delete the asset document only when the reference count is zero; otherwise store `retained-shared`. An asset failure remains resumable even after the source document is gone.
8. Query the published application services with the same project context and confirm the document and rules are absent. Store the Sanity transaction IDs, removed rule count, asset outcome, and completion time; mark the tombstone `complete` and release the lease.

Estimate the explicit-ID transaction size before mutation. Use the atomic path whenever it fits. If it does not, enter the documented oversized-family path; batching must be explicit, deterministic, cursor-backed, and observable. Never improvise a query-based bulk delete or delete the source before all dependent variants are gone.

Sanity and PostgreSQL cannot share one transaction. The tombstone is the recovery coordinator: once it exists, all application and MCP retrieval paths treat the source as removed even if Sanity cleanup needs a retry. Retrying resumes from a fresh inventory and treats already absent IDs as success.

## Retrieval changes

- Document list/detail services exclude pending, deleting, complete, and failed removal tombstones.
- Chat rule search excludes rules whose source document has a removal tombstone before passing results to Gemini.
- MCP list/search/get tools apply the same exclusion and return `NOT_FOUND` for removed IDs.
- Operator Studio views may show an in-progress/failed removal for repair, but ordinary project UI must not resurface it.
- Published-client or CDN lag must not reintroduce a removed result because the PostgreSQL tombstone is authoritative at the application boundary.

## UI behavior

Add **Remove from project** to each document's actions. It opens a destructive confirmation dialog naming the document and explaining:

- the PDF and all derived rules leave active project search and MCP;
- the action cannot be undone in the application;
- existing conversation messages remain and show their citation origin as removed.

Disable confirmation while submitting. On success, remove the item from the list and announce the result. On conflict/in-progress failure, keep it hidden if a tombstone exists and show retry/operator guidance. Do not expose bulk deletion in this milestone.

## Failure and recovery

| Failure | Required state |
| --- | --- |
| Authorization or confirmation mismatch | No tombstone or Sanity mutation |
| Inventory mismatch/cross-project reference | Abort, log correlation ID, no Sanity mutation |
| Sanity transaction conflict | Tombstone `failed`, stored plan/cursor retained, source excluded, safe retry allowed |
| Asset still referenced | Content deletion succeeds; asset retained and reported |
| Asset deletion failure after content deletion | Tombstone remains retryable; active context stays excluded |
| Final verification failure | Tombstone `failed`; do not resurface content |

Logs include correlation ID, project ID, document ID, counts, transaction ID, asset outcome, duration, and safe error code. They exclude tokens, document text, citations, and PDF URLs.

## Tasks

- [x] Extend the citation snapshot and rendering contracts.
- [x] Add the PostgreSQL removal tombstone and required indexes.
- [x] Add tombstone exclusion to document, chat, conversation, and MCP services.
- [x] Implement authorized, idempotent removal with a deletion lease.
- [x] Inventory every rule/document variant; use one atomic transaction when it fits and the resumable bounded path otherwise.
- [x] Delete only unshared Sanity file assets.
- [x] Add confirmation and removed-citation UI states.
- [x] Add structured logging, retry, and operator recovery behavior.
- [x] Audit that no active retrieval path bypasses tombstone exclusion.

## Manual checkpoint

1. In one project, upload a PDF, publish at least one rule, and produce a chat answer citing it.
2. Remove the document and confirm the document, all rule variants, and—when unshared—the file asset are gone.
3. Confirm Documents, chat search, direct rule/document APIs, and all four MCP tools cannot retrieve the removed context.
4. Reopen the earlier conversation and confirm its message remains with document title, formal citation, source pages, and **Source removed**, with no live internal link.
5. Attempt removal through another user's project and confirm a non-enumerating failure with no mutation.
6. Retry the completed request and confirm idempotent success without additional mutation.
7. Retry after completion and after an asset-deletion failure; confirm the stored asset ID and terminal result make both paths resumable/idempotent without a live source document.
8. Force a transaction conflict and an oversized-family cleanup; confirm the source remains excluded, progress resumes from its cursor, and the source is deleted only after all rule variants are gone.
9. Upload identical file bytes twice, remove one document, and confirm the shared asset is retained for the surviving document.
10. Run Prisma validation/migration checks, `pnpm exec tsc --noEmit`, `pnpm build`, and `pnpm --dir sanity build`.

## Checkpoint record

- Date: 2026-09-29
- Commit: 1e6bd95
- Reviewer: Antigravity Agent & User
- Result: Passed
- Notes: All 10 manual checkpoint tests verified via automated verification (`scratch/verify-m12.mjs`). Safe project-owned compliance document removal, derived-rule and asset cleanup, tombstones, active retrieval exclusions, historical citation origins with "Source removed" badge, idempotent retries, cross-project protection, shared asset retention, and production builds for Next.js and Sanity Studio verified with zero errors.

