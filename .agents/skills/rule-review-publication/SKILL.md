---
name: rule-review-publication
description: Implement the Sanity Studio workflow that reviews extracted compliance-rule drafts and publishes only validated, human-approved content. Use for milestone 4 editorial workflow work.
---

# Rule Review and Publication

Read the [shared protocol](../../../docs/agent-implementation-protocol.md) and [`docs/04-rule-review-and-publication.md`](../../../docs/04-rule-review-and-publication.md) completely.

## Approach

1. Inspect actual extraction output so the Studio workflow optimizes for the fields reviewers must correct most often.
2. Organize Studio into source documents, awaiting-review rules, published rules, and separate app records.
3. Order rule fields around reviewer decisions: identity, authority, evidence, discovery, then lifecycle.
4. Make missing review metadata and invalid evidence publication-blocking while still allowing incomplete drafts to be saved.
5. Keep runtime and MCP clients permanently on the published perspective; operator-only draft counts stay server-side.
6. Distinguish extracted draft count from published count in all application copy.
7. Preserve evidence history: new files create new source documents, and obsolete rules become stale or superseded.

## Invariants

- A human is the only publication authority.
- `lastReviewedAt` is required before publication.
- Public callers cannot request a draft perspective.
- Stale and superseded published rules remain traceable.

## Done

An untouched extraction is blocked from publication, a corrected rule can be published, and published-only reads prove draft isolation as required by milestone 4.

