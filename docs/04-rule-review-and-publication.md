# Milestone 4 — Rule Review and Publication

## Outcome

Give a compliance reviewer a safe Studio workflow for correcting extracted rules and publishing only verified content. The application must continue to ignore every unpublished rule.

## Editorial lifecycle

```text
Gemini output -> Sanity draft -> human correction -> review metadata -> publish -> runtime search
```

Extraction is never an approval decision. Application code may create or replace drafts, but only a human in Sanity Studio may publish a `complianceRule`.

## Studio organization

Create a dedicated structure with:

- **Source documents**: ordered by `uploadedAt desc`, with filters for processing status and industry.
- **Rules awaiting review**: compliance rules whose draft version exists or whose `lastReviewedAt` is missing.
- **Published rules**: current published perspective, grouped by industry or freshness status.
- **App records**: conversations and messages, separated from editorial content and not shown in the normal rule workflow.

The rule editor should place fields in this order:

1. Rule identity: name, description, requirement, applicability.
2. Authority: jurisdiction, regulator, citation, effective/expiry dates.
3. Evidence: source document, page numbers, excerpt.
4. Discovery: industry and keywords.
5. Lifecycle: freshness status and last reviewed time.

## Publication requirements

A rule cannot be published until all of the following are valid:

- Required text fields are non-empty.
- Source document reference resolves.
- At least one unique source page is present and each page is within 1–100.
- Evidence excerpt and formal citation are present.
- Keywords are unique and within the configured count.
- Expiry is not earlier than effective date.
- `freshnessStatus` is selected.
- `lastReviewedAt` is set by the reviewer.

Make `lastReviewedAt` a validation error when absent. Sanity can still store the invalid draft, but Studio must prevent publication until the reviewer completes it.

## Runtime isolation

All application and MCP queries use `publishedClient` with `perspective: "published"`. Do not expose a query flag that lets public callers request drafts. Draft previews, if added later, require a separate authenticated preview feature and are outside v1.

The Documents UI may show `extractedRuleCount` from the source document, but it must not imply that those rules are published. Show separate labels:

- `Processing failed`
- `No rules extracted`
- `N drafts awaiting review`
- `N published rules`

Derive draft counts only in server-side operator views with the write token. Public content endpoints remain published-only.

## Source integrity

- The source PDF and source-document reference are immutable evidence for the rule.
- Reviewers may correct extracted wording, citations, pages, and metadata.
- Replacing a source PDF creates a new `complianceDocument`; it does not silently replace evidence under existing rules.
- Mark obsolete rules `superseded` or `stale` instead of deleting them. Published stale rules remain searchable as context but force external fallback in chat.
- Use Sanity's field deprecation pattern for future schema changes; do not delete fields containing production data without a migration.

## Tasks

- [x] Add the dedicated Studio structure and useful document previews.
- [x] Add publication-blocking validation, including `lastReviewedAt`.
- [x] Make source references and evidence clearly visible to reviewers.
- [x] Add public queries for published-rule counts by source document.
- [x] Add operator-only draft count logic without exposing the write token.
- [x] Add distinct UI copy for extracted drafts versus published rules.
- [x] Confirm there is no public draft perspective or preview bypass.

## Manual checkpoint

1. Ingest a PDF and confirm its rules appear under awaiting review.
2. Attempt to publish an untouched extraction; confirm missing review metadata blocks publication.
3. Correct the rule, set `lastReviewedAt`, and publish it.
4. Confirm the published rule appears in the published GROQ query and draft-only rules do not.
5. Mark the rule stale and confirm it remains retrievable with the stale state.
6. Confirm public requests cannot select the drafts perspective.
7. Run `pnpm --dir sanity build`, `pnpm exec tsc --noEmit`, and `pnpm build`.

## Checkpoint record

- Date: 2026-09-27
- Commit: Pending (Milestone 4 completion)
- Reviewer: Antigravity Agent
- Result: Passed
- Notes:
  - Configured dedicated Studio structure with Source Documents (filtered by ready/processing/failed), Rules Awaiting Review (drafts and unreviewed rules), Published Rules (current/stale/superseded), and runtime App Records separated from editorial content.
  - Reorganized rule editor fields into logical reviewer groups: 1. Rule Identity, 2. Authority & Citations, 3. Evidence & Source, 4. Discovery, and 5. Lifecycle & Review.
  - Configured publication-blocking validation on `lastReviewedAt` requiring human reviewer sign-off before publication can proceed.
  - Added public queries for published rule counts by document (`getPublishedRuleCountByDocumentId`, `getPublishedRuleCountsByDocument`) and operator draft counts (`getOperatorDraftRuleCounts`) using server-side writeClient without exposing the write token.
  - Implemented distinct UI copy formatter in `src/lib/documents.ts` distinguishing `Processing failed`, `No rules extracted`, `N drafts awaiting review`, and `N published rules`, and integrated it into the Documents UI.
  - Enforced strict draft isolation in all GROQ queries with `!(_id in path("drafts.**"))` and ID prefix guards.
  - All builds verified cleanly: `pnpm --dir sanity build` (code 0), `pnpm exec tsc --noEmit` (code 0), and `pnpm build` (code 0).


