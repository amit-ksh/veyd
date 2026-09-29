# Compliance document deletion feasibility

Date: 2026-09-28

## Conclusion

Deleting a `complianceDocument` together with the Sanity content derived from it is **feasible and suitable for a milestone**, provided it is implemented as an explicit, server-side deletion workflow rather than a plain `client.delete(documentId)` call.

The achievable guarantee is: remove the source document, every active draft/published/release-version rule derived from it, and its unshared Sanity file asset from active application and MCP retrieval. A stronger promise such as "all bytes disappear immediately everywhere" is not available without extra qualifications: Sanity document history is retained unless deletion uses `purge`, the asset CDN may still serve a cached file temporarily, an already-running chat may have fetched the rule before deletion, and PostgreSQL conversation messages currently retain copied answer text and citation metadata.

## Current repository findings

- `complianceRule.sourceDocument` is a required strong reference to `complianceDocument`. This is the right integrity boundary: Sanity blocks deleting the document while any rule variant still references it ([rule schema](../../sanity/schemaTypes/complianceRule.ts), [Sanity reference documentation](https://www.sanity.io/docs/studio/reference-type)). Sanity does not cascade ordinary deletes; owned dependants must be deleted explicitly, preferably in the same transaction ([Sanity hierarchy deletion example](https://www.sanity.io/docs/content-lake/hierarchy#deleting)).
- `complianceDocument.fileAsset` is another strong reference, this time to a `sanity.fileAsset` document ([document schema](../../sanity/schemaTypes/complianceDocument.ts)). Deleting the content document does not automatically delete the asset.
- Ingestion creates the source document first and then creates all extracted rule drafts in a transaction ([ingestion service](../../src/lib/ingestion/service.ts)). There is no deletion lock, cancellation state, or maximum rule-count constraint in the current extraction response schema ([extractor](../../src/lib/ingestion/extractor.ts)).
- Chat, document pages, and MCP use published Sanity queries; the production `publishedClient` enables the API CDN ([clients](../../src/lib/sanity/clients.ts), [published queries](../../src/lib/sanity/published-queries.ts)). CDN results may remain stale until invalidation, whereas the live API is the freshness-oriented endpoint ([Sanity API CDN documentation](https://www.sanity.io/docs/content-lake/api-cdn)).
- Assistant messages are stored in PostgreSQL. `Message.citations` is unstructured JSON, not a foreign key, and each Sanity citation copies `ruleId`, `documentId`, the formal citation, and the PDF URL. Assistant `content` can also restate evidence from the deleted document ([Prisma schema](../../prisma/schema.prisma), [citation type](../../src/lib/chat/types.ts), [conversation service](../../src/lib/conversations/service.ts)). Therefore deleting Sanity records alone does not remove their historical conversation context.

## Platform feasibility and constraints

### Strong references and atomic deletion

Strong references are the default in Sanity and prevent deletion of a referenced target. Weak references permit dangling targets and are inappropriate for this ownership relationship. Changing the schema's `weak` option would also not rewrite existing stored references ([reference type](https://www.sanity.io/docs/studio/reference-type)).

Sanity mutation transactions are atomic: all mutations succeed or none do. With default `visibility: "sync"`, the response waits until the mutation has reached the query search store ([transactions](https://www.sanity.io/docs/content-lake/transactions), [client transaction guide](https://www.sanity.io/docs/apis-and-sdks/js-client-transactions)). This makes one explicit-ID transaction containing rule deletions, document deletion, and—when safe—asset deletion practical. A missed or concurrently added strong ref causes the transaction to fail instead of leaving a broken reference.

Do not use a GROQ query-based delete as the integrity mechanism. GROQ selection runs against the eventually consistent search store, so query-based transactions are not strongly consistent. Resolve physical IDs first through the uncached write client or Doc API, then delete those IDs explicitly. A preflight `references($documentId)` query is useful for explanation and conflict reporting, but the transaction's strong-reference check remains authoritative ([GROQ `references()`](https://www.sanity.io/docs/specifications/groq-functions#references), [transaction consistency](https://www.sanity.io/docs/content-lake/transactions)).

### Draft, published, and release versions

Drafts and published documents are separate physical documents (`drafts.<id>` and `<id>`), and Content Releases add `versions.<release>.<id>` documents. Deleting only the published rule can therefore leave a draft or release version capable of returning later. Sanity's document delete action requires draft/version identifiers to be supplied explicitly; the Doc API can enumerate all versions with `includeAllVersions=true` ([drafts](https://www.sanity.io/docs/content-lake/drafts), [delete action](https://www.sanity.io/docs/content-lake/dispatch-actions#delete-a-published-document-and-all-drafts-and-versions), [Content Releases cheat sheet](https://www.sanity.io/docs/apis-and-sdks/content-releases-cheat-sheet)).

The workflow must enumerate and delete every physical variant of each derived rule and of the source document. An explicit-ID Mutations API transaction can delete these physical documents and the file asset together. If product requirements call for irreversible removal from Sanity history, each delete must use `purge: true`; ordinary deletion remains recoverable through the History API for the plan's retention window ([purge mutation](https://www.sanity.io/docs/content-lake/mutation-patterns#fully-purging-a-document-from-the-transaction-history-when-deleting-it), [history retention](https://www.sanity.io/docs/developer-guides/find-and-restore-deleted-documents#history-retention-limits)).

### File asset deletion

A Sanity PDF is a `sanity.fileAsset` document. Deleting that asset document deletes the file, but a strong reference to it produces a conflict. Sanity deduplicates identical uploaded bytes, so more than one `complianceDocument` can legitimately share the same asset ([asset management](https://www.sanity.io/docs/content-lake/manage-assets)).

Consequently, the workflow must delete the asset only when every incoming reference is part of the same deletion set. If another document references it, leave the asset in place; removing the selected document's searchable context still succeeds. A later orphan-asset cleanup can remove it once the final reference is gone. Even after asset deletion succeeds, Sanity warns that its CDN may retain a cached copy temporarily, so an "immediate URL revocation" promise would be inaccurate ([asset deletion](https://www.sanity.io/docs/content-lake/manage-assets#delete-assets)).

### Size and retry limits

The single-transaction design is bounded by Sanity's 4 MB maximum mutation body and three-minute mutation execution limit. Mutations are also limited to 25 requests/second per IP and 100 concurrent requests per dataset ([technical limits](https://www.sanity.io/docs/content-lake/technical-limits)). `@sanity/client` does not automatically retry mutations, actions, or transaction commits, so `429` and transient failures require bounded, idempotent retry logic ([advanced client patterns](https://www.sanity.io/docs/apis-and-sdks/js-client-advanced#automatic-retries)).

The present application does not cap extracted rule count, so it cannot prove in advance that every future document family will fit below 4 MB. The milestone should add a bounded rule count, or explicitly route oversized families through a resumable deletion job. Chunking loses all-or-nothing deletion across the complete family, so the document must remain tombstoned and non-searchable until all chunks finish.

## Recommended safe deletion sequence

1. **Authorize and confirm.** Require an authenticated user with delete permission for the owning application project. Bind the requested document to that project server-side; never trust a client-supplied project/document pairing. Record an idempotent deletion job and an audit-safe reason/time, without copying PDF contents.
2. **Quiesce application access.** Acquire a distributed per-document deletion lease and create a durable tombstone/`deleting` state. Reject deletion while `processing` unless ingestion cancellation is deliberately implemented. All document, rule-search, chat, and MCP reads must exclude tombstoned document IDs. This guard also covers stale API-CDN results during invalidation.
3. **Inventory through uncached reads.** Using the write client/live API, resolve the source document's published, draft, and release-version IDs; every rule physical ID whose `sourceDocument._ref` is the source ID; the file asset ID; and every unexpected incoming reference. Also count PostgreSQL messages whose citation JSON names any affected document/rule ID.
4. **Delete the Sanity family atomically.** Submit one explicit-ID transaction, ordered as rule variants, source-document variants, then the asset if it is unshared. Use `visibility: "sync"`. Use `purge: true` only if the product decision is permanent erasure rather than recoverable removal. If an unexpected strong ref or concurrency conflict aborts the transaction, refresh the inventory and return/retry a conflict; do not weaken the references.
5. **Clean PostgreSQL according to policy.** In one PostgreSQL transaction, apply the chosen conversation behavior. Removing citation objects alone is insufficient because assistant message text may contain the same evidence. Either delete/redact every affected assistant message (and define what happens to adjacent user turns), delete the entire affected conversation, or explicitly retain history while marking its source unavailable. Keep the deletion tombstone active until this step succeeds.
6. **Verify and finish.** Query the live Sanity API to confirm no source/rule variants remain, confirm the asset is deleted or intentionally retained as shared, confirm PostgreSQL has no forbidden retained context, and verify chat/MCP cannot return the deleted rules. Mark the deletion job complete; retain only non-content audit metadata. Retry incomplete jobs idempotently.

## Concurrency consequences

- **Ingestion:** the simplest safe v1 rule is "documents in `processing` cannot be deleted." If deletion is allowed during extraction, ingestion and deletion must share a lease/cancellation check. Strong references still provide a last line of defense: rule creation after the source is deleted fails, while deletion after a newly committed rule fails unless that rule is included.
- **Reads:** deletion cannot retract data already returned to an in-flight chat or MCP request. A request that fetched a rule just before the tombstone may still finish and persist an answer. The stream completion path must re-check the tombstone before emitting citations and before persisting the assistant message; cancellation should abort active upstream work where possible.
- **Studio edits/publication:** a draft or release version created after inventory can cause a conflict or survive if it was not part of the explicit set. Disable relevant Studio document actions while deletion is active and perform a final all-version verification. Strong references protect the source from unaccounted rule refs, but they do not by themselves prevent a new source-document draft from being created.
- **Cross-store atomicity:** Sanity and PostgreSQL do not share a transaction manager. Complete "source plus every saved conversation trace" deletion must be a resumable saga with a tombstone, not an instant distributed transaction. Failures may temporarily leave conversation cleanup pending, but the tombstone must prevent that content from re-entering search or future model context.

## Hard limitations

- Immediate revocation of a previously issued Sanity asset CDN URL is not guaranteed.
- Content already copied or exported outside these controlled stores cannot be recalled.
- A response already generated or displayed before deletion cannot be retroactively erased from the user's screen.
- Atomic deletion of an unbounded document family is not guaranteed beyond Sanity's mutation payload/runtime limits.
- Without `purge: true`, deleted Sanity document content remains in recoverable history for the plan retention period.
- No single atomic commit can cover both Sanity Content Lake and PostgreSQL.

## Open product decisions

1. Does "remove context" mean removal from active search only, or permanent purge from Sanity history as well?
2. Should a referenced historical assistant message be deleted, redacted, or retained with a "source removed" marker? If deleted, what happens to surrounding user turns and conversation coherence?
3. Is deletion allowed for `processing` documents, or should users wait for ingestion to finish/fail?
4. Who may delete: project owner only, project admins, or all project members? Is confirmation by typed document title required?
5. Should a shared PDF asset remain silently, or should the UI report that the source record was removed while the deduplicated asset is retained for another document?
6. What rule-count bound will guarantee the normal atomic transaction fits, and what operator workflow handles an oversized legacy family?
7. What audit metadata may remain after deletion, and for how long?

## Recommendation for milestone scope

Add the milestone, but define its acceptance target as **safe removal from active project context and retrieval**, with an explicit conversation-retention choice. Require project-scoped authorization, tombstoned/resumable deletion, explicit handling of every Sanity version, atomic Sanity deletion when within bounds, unshared-asset cleanup, chat/MCP exclusion, and documented purge/CDN limitations. Do not claim immediate universal erasure.
