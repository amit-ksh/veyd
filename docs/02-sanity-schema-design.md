# Milestone 2 — Sanity Content Model and Queries

## Outcome

Implement the complete Sanity model for source documents, reviewed compliance rules, persisted conversations, and messages. At this checkpoint the Studio and queries work, but upload and chat routes are not implemented.

## Modeling rules

- Use `defineType`, `defineField`, and `defineArrayMember` for every definition.
- Let Sanity generate ordinary document IDs. Use `@sanity/id-utils` only when the Actions API needs a linked published/draft ID pair.
- Use references for document relationships; do not encode relationships into IDs.
- Runtime consumers use `perspective: "published"`. The write path uses the Actions API to create rule drafts.
- Schema validation improves Studio authoring but does not validate API mutations. Route input and Gemini output must also be validated with Zod.
- Include `_key` in every projected Sanity array and use it as the React key.

## `complianceDocument`

Durable record for one uploaded PDF.

| Field | Type | Required | Contract |
| --- | --- | --- | --- |
| `title` | string | Yes | 1–200 trimmed characters |
| `fileAsset` | file | Yes | PDF asset reference only |
| `industry` | string | Yes | Free text, 1–100 trimmed characters |
| `originalFileName` | string | Yes | Display-only original name |
| `mimeType` | string | Yes | Must equal `application/pdf` |
| `fileSizeBytes` | number | Yes | Integer, 1 through 10,485,760 |
| `pageCount` | number | Yes | Integer, 1 through 100 |
| `processingStatus` | string | Yes | `processing`, `ready`, or `failed` |
| `extractionModel` | string | No | Value of `GEMINI_MODEL` used for the attempt |
| `extractedRuleCount` | number | Yes | Non-negative integer, initially zero |
| `uploadedAt` | datetime | Yes | UTC ingestion start |
| `extractionCompletedAt` | datetime | No | UTC success/failure completion |
| `failureMessage` | text | No | Safe operator message; never raw upstream body |

Preview title is `title`; subtitle is `industry + processingStatus`. Group or sort documents by `uploadedAt desc` in Studio.

## `complianceRule`

One independently reviewable rule extracted from a source PDF.

| Field | Type | Required | Contract |
| --- | --- | --- | --- |
| `ruleName` | string | Yes | 1–200 characters |
| `description` | text | Yes | Plain-language explanation |
| `requirement` | text | Yes | Normative action or prohibition |
| `applicability` | text | Yes | Who/what/when the rule applies to |
| `industry` | string | Yes | Copied from source document for filtering |
| `jurisdiction` | string | Yes | Human-readable jurisdiction |
| `regulator` | string | No | Issuing authority when present |
| `citation` | string | Yes | Source citation exactly as found |
| `evidenceExcerpt` | text | Yes | Short supporting excerpt from the PDF |
| `sourcePages` | array<number> | Yes | Unique integers, 1–100, at least one |
| `keywords` | array<string> | Yes | Unique normalized search terms, 1–20 items |
| `sourceDocument` | reference | Yes | Strong reference to `complianceDocument` |
| `freshnessStatus` | string | Yes | `current`, `stale`, or `superseded` |
| `effectiveDate` | date | No | Date stated by the source |
| `expiresAt` | date | No | Explicit expiry/review deadline |
| `lastReviewedAt` | datetime | No | Human review timestamp |

Do not add a slug for v1; rules are addressed by generated Sanity ID. Cross-field validation must reject `expiresAt < effectiveDate`. Studio preview title is `ruleName`; subtitle combines `citation`, `jurisdiction`, and `freshnessStatus`.

A rule is externally stale when either condition is true:

```ts
freshnessStatus !== "current" ||
(expiresAt !== undefined && expiresAt < today)
```

No elapsed-time heuristic may mark a rule stale.

## `conversation`

Permanent container reopened only through its unguessable generated ID.

| Field | Type | Required | Contract |
| --- | --- | --- | --- |
| `createdAt` | datetime | Yes | UTC creation time |
| `updatedAt` | datetime | Yes | UTC time of latest persisted message |

There is deliberately no title, user reference, owner, industry, list screen, or deletion state.

## `message`

Store messages separately rather than as an unbounded array on `conversation`.

| Field | Type | Required | Contract |
| --- | --- | --- | --- |
| `conversation` | reference | Yes | Strong reference to `conversation` |
| `role` | string | Yes | `user` or `assistant` |
| `content` | text | Yes | Non-empty final message content |
| `citations` | array<object> | Assistant only | Ordered citations shown with the answer |
| `createdAt` | datetime | Yes | UTC creation time |

Citation object fields:

| Field | Type | Required | Contract |
| --- | --- | --- | --- |
| `sourceKind` | string | Yes | `sanity`, `official-web`, or `secondary-web` |
| `title` | string | Yes | Human-readable label |
| `url` | url | No | Required for web citations |
| `ruleId` | string | No | Required for Sanity rule citations |
| `documentId` | string | No | Source document ID when available |
| `citation` | string | No | Formal regulatory citation when available |

Use `defineArrayMember` for the citation object and preserve `_key` in projections.

## Required GROQ contracts

Store queries in `src/lib/sanity/queries.ts` and define them with `defineQuery` from `groq`.

### Document list

```groq
*[_type == "complianceDocument"]
| order(uploadedAt desc) {
  _id, title, industry, originalFileName, fileSizeBytes, pageCount,
  processingStatus, extractedRuleCount, uploadedAt, extractionCompletedAt,
  failureMessage
}
```

### Document detail

```groq
*[_type == "complianceDocument" && _id == $documentId][0] {
  _id, title, industry, originalFileName, mimeType, fileSizeBytes, pageCount,
  processingStatus, extractionModel, extractedRuleCount, uploadedAt,
  extractionCompletedAt, failureMessage,
  "fileUrl": fileAsset.asset->url
}
```

### Ranked published-rule search

Validate and trim `$query` before executing it. Never run an empty search. GROQ slice bounds must be constants, so validate `limit` as an integer from 1–20 in application code and interpolate only that validated number.

```ts
export function complianceRuleSearchQuery(limit: number) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new Error("limit must be an integer from 1 through 20")
  }

  return defineQuery(`
    *[
      _type == "complianceRule" &&
      [ruleName, description, requirement, applicability, citation, keywords[]]
        match text::query($query)
    ]
    | score(
      boost(ruleName match text::query($query), 4),
      boost(citation match text::query($query), 3),
      boost(keywords[] match text::query($query), 2),
      [description, requirement, applicability] match text::query($query)
    )
    | order(_score desc)[0...${limit}] {
      _id, _score, ruleName, description, requirement, applicability,
      industry, jurisdiction, regulator, citation, evidenceExcerpt,
      sourcePages, keywords, freshnessStatus, effectiveDate, expiresAt,
      lastReviewedAt,
      "sourceDocument": sourceDocument->{
        _id, title, "fileUrl": fileAsset.asset->url
      }
    }
  `)
}
```

### Rule detail

Use the same projection as search and filter by `_id == $ruleId`.

### Conversation and messages

```groq
*[_type == "conversation" && _id == $conversationId][0] {
  _id, createdAt, updatedAt
}
```

```groq
*[_type == "message" && conversation._ref == $conversationId]
| order(createdAt asc) {
  _id, role, content, createdAt,
  citations[]{_key, sourceKind, title, url, ruleId, documentId, citation}
}
```

Do not implement a conversation-list query.

## Tasks

- [x] Create the four schema files and register all four in `schemaTypes/index.ts`.
- [x] Add icons through per-icon `@sanity/icons/<Icon>` imports.
- [x] Add all required field, enum, range, uniqueness, and cross-field validation.
- [x] Add Studio previews and a structure that separates editorial content from app records.
- [x] Implement the published read client and all listed GROQ queries.
- [x] Define TypeScript result types; do not use `any` at route/component boundaries.
- [x] Confirm API write code will validate independently with Zod.

## Manual checkpoint

1. Run `pnpm --dir sanity build` and confirm schema compilation succeeds.
2. Create one document, one draft rule, one conversation, and two messages in a non-production dataset.
3. Confirm invalid enum values, page counts, empty arrays, and reversed effective/expiry dates are rejected in Studio.
4. Confirm the published client cannot return the draft rule.
5. Publish the rule and confirm ranked search and rule detail return the complete projection.
6. Confirm the conversation can be loaded by exact ID and there is no query or UI that lists all conversations.

## Checkpoint record

- Date: 2026-09-27
- Commit: 457cd53
- Reviewer: Antigravity Agent
- Result: Passed
- Notes: Sanity Studio compiled cleanly with `pnpm --dir sanity build`. Seeded complianceDocument, published rule, draft rule, conversation, and messages. Verified draft isolation (published client returned 0 draft rules), ranked search with boosts, document detail with resolved PDF URL, and exact ID conversation/message loading with preserved _key citations.


