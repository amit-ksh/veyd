# Milestone 13 — Automatically Generated Project Handbook

## Outcome

Create one living handbook for each project from that project's human-published compliance rules. The handbook is automatically generated, organized like a book, readable in the application over repeated visits, and downloadable as a cited PDF.

The handbook is a derived learning and reference view. It does not train a model, edit source rules, or introduce unreviewed compliance guidance.

## Prerequisites

Milestones 11 and 12 must be complete:

- project ownership and project-scoped retrieval provide the authorization boundary;
- removal tombstones prevent deleted documents and rules from returning through a stored handbook snapshot.

Stop if either boundary cannot be proven server-side.

## Locked boundaries

- Every project has at most one current handbook.
- The source corpus is limited to published `complianceRule` records in the selected project and their matching published `complianceDocument` records.
- Chat messages, Firecrawl results, draft rules, cross-project records, and removed sources are never handbook inputs.
- Generation is deterministic compilation of reviewed fields. It does not ask Gemini to invent, summarize, merge, or reinterpret requirements.
- A document becomes one chapter. Its published rules become numbered sections in stable order.
- The web handbook includes a hierarchical table of contents and an alphabetical subject index derived from rule keywords and formal citations.
- The PDF contains the same chapters, rule text, source citations, table of contents, subject index, freshness warnings, and generation metadata as the web handbook.
- This milestone keeps only the current generated snapshot. Historical handbook versions and previously downloaded PDF files are outside scope.
- Automatic means source-driven lazy regeneration: opening the handbook detects a missing or outdated snapshot and starts regeneration without requiring a manual authoring action. No cron, queue, or Sanity webhook is introduced.
- The application never serves or exports an outdated snapshot. While regeneration is required, the UI shows generation status instead of old content.

## Source eligibility and ordering

Use a published, uncached Sanity read to inventory the selected project. A source rule is eligible only when all conditions are true:

1. the rule is published;
2. `rule.projectId` exactly matches the authorized project ID;
3. its dereferenced source document exists and has the same project ID;
4. neither the rule's document nor its derived rule family is excluded by a Milestone 12 removal tombstone.

A mismatched or missing source document is invalid data: exclude the rule, record a safe diagnostic, and fail generation rather than silently producing a partial handbook.

Group eligible rules by source document. Order chapters by normalized document title ascending, then document ID ascending. Within each chapter order rules by:

1. formal citation ascending;
2. rule name ascending;
3. rule ID ascending.

The ID tie-breakers make regeneration stable even when display fields are duplicated.

Published rules with `freshnessStatus: "current"` and no passed `expiresAt` appear in the main chapter body. Published stale, superseded, or explicitly expired rules appear in a clearly separated **Review required** section of their source chapter. They retain citations but must not be styled or described as current obligations.

## Handbook content contract

The stored snapshot is structured data, not HTML. HTML and PDF renderers consume the same snapshot so their substance cannot drift.

```ts
type HandbookCitation = {
  sourceKey: string
  projectId: string
  ruleId: string
  documentId: string
  documentTitle: string
  citation: string
  sourcePages: number[]
}

type HandbookRuleSection = {
  anchor: string
  number: string
  ruleName: string
  description: string
  requirement: string
  applicability: string
  jurisdiction: string
  regulator?: string
  effectiveDate?: string
  expiresAt?: string
  freshness: "current" | "review-required"
  keywords: string[]
  sourceKey: string
}

type HandbookChapter = {
  anchor: string
  number: string
  documentId: string
  title: string
  industry: string
  currentRules: HandbookRuleSection[]
  reviewRequiredRules: HandbookRuleSection[]
}

type SubjectIndexEntry = {
  term: string
  targets: Array<{
    anchor: string
    sectionNumber: string
  }>
}

type ProjectHandbookSnapshot = {
  schemaVersion: 1
  projectId: string
  projectName: string
  sourceFingerprint: string
  generatedAt: string
  documentCount: number
  ruleCount: number
  currentRuleCount: number
  reviewRequiredRuleCount: number
  chapters: HandbookChapter[]
  citations: HandbookCitation[]
  subjectIndex: SubjectIndexEntry[]
}
```

Copy only the reviewed rule fields required by this contract. Do not copy PDF bytes, evidence excerpts, file URLs, chat content, or source text beyond the reviewed rule fields into the snapshot.

### Book structure

The web and PDF render in this order:

1. Cover: project name, handbook title, generation time, and freshness statement.
2. Table of contents: every chapter and numbered rule section.
3. Chapters: source document title, current rule sections, then any **Review required** section.
4. Source notes: one entry per `sourceKey`, in first-use order.
5. Subject index: normalized keywords and formal citations mapped to section numbers.

Each rule section displays `description`, `requirement`, and `applicability` as separate labeled blocks. It displays a visible source marker that resolves to a source note containing document title, formal citation, and source page numbers. The web source note links only to an authorized project document/rule view. The PDF source note is self-contained and must not depend on an authenticated URL to remain attributable.

Normalize subject-index terms by trimming and collapsing whitespace and compare case-insensitively. Preserve a deterministic human-readable spelling, de-duplicate section targets, and sort terms and targets stably. Do not generate new topics beyond stored keywords and citations.

## Persistence contract

PostgreSQL coordinates the current generated snapshot:

```prisma
model ProjectHandbook {
  id                    String    @id @default(cuid())
  projectId             String    @unique
  status                String    // generating | ready | empty | failed
  sourceFingerprint     String?
  snapshot              Json?
  documentCount         Int       @default(0)
  ruleCount             Int       @default(0)
  currentRuleCount      Int       @default(0)
  reviewRequiredCount   Int       @default(0)
  generationStartedAt   DateTime?
  generatedAt           DateTime?
  lastErrorCode         String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, status])
}
```

Add `handbook ProjectHandbook?` to `Project`. Validate the JSON snapshot at every read and write with a versioned Zod schema. A malformed or unknown snapshot version is unavailable and must be regenerated; never cast arbitrary JSON into the renderer.

The generation service writes `status: "generating"` before work, builds the complete snapshot in memory, and commits the ready or empty state in one PostgreSQL update. Partial chapters are never stored as ready. A failed attempt stores only a safe error code and timestamps, not rule content or upstream bodies.

## Source fingerprint and automatic regeneration

Compute a SHA-256 fingerprint from a canonical serialization of:

- authorized project ID and project name;
- every eligible rule ID and `_rev`;
- the source document ID and `_rev` for each rule;
- the reviewed handbook fields used in the snapshot;
- the applicable removal-tombstone IDs and statuses;
- handbook `schemaVersion` and generator version.

Sort every input before serialization. Do not rely on timestamps alone.

The authorized handbook page first fetches a lightweight current-source inventory and compares its fingerprint with the stored ready snapshot:

- matching fingerprint: render the stored snapshot;
- no eligible rules: atomically store `empty` and show the empty state;
- missing, failed, or mismatched snapshot: automatically call the generation endpoint and show progress;
- concurrent generation: observe the existing run instead of starting another.

Use a short project-scoped Upstash lease to serialize generation. Recheck the source fingerprint after acquiring the lease and immediately before committing. If content changes during generation, discard the candidate snapshot and retry through the normal stale path. Release the lease in a `finally` path and allow an expired lease to recover a crashed run.

A pending, deleting, complete, or failed removal tombstone makes any snapshot containing that document unavailable immediately, even before regeneration finishes. The old snapshot must not be returned by the page API, PDF endpoint, cache, or MCP.

## API contracts

All routes require a Better-Auth session and server-side project ownership. Cross-project and unknown project IDs return the same non-enumerating `404`.

### Read handbook state

`GET /api/projects/[projectId]/handbook`

```ts
type HandbookResponse =
  | { status: "ready"; handbook: ProjectHandbookSnapshot }
  | { status: "empty"; handbook: null }
  | { status: "missing" | "stale" | "generating" | "failed"; handbook: null; retryAfterSeconds?: number }
```

The route never returns stale snapshot content. Use `Cache-Control: private, no-store` because authorization, fingerprints, and removal state are user-specific.

### Generate or refresh

`POST /api/projects/[projectId]/handbook/generate`

No request body is required. The route is idempotent for the current fingerprint. Return:

- `200` with `ready` or `empty` when the current result is already available or completes within the request;
- `202` with `generating` and retry metadata when another valid lease owns the run;
- `409 HANDBOOK_SOURCE_CHANGED` when the source changes during compilation;
- the shared safe error envelope for authorization, validation, Sanity, or persistence failures.

The client starts this request automatically when the read route returns `missing`, `stale`, or a retryable `failed` state. Bound retries and stop with a visible Retry action after repeated failure; automatic behavior must not create an infinite request loop.

### Download PDF

`GET /api/projects/[projectId]/handbook.pdf`

Generate the PDF from the current validated ready snapshot using the existing `pdf-lib` dependency. Before rendering, recompute and compare the source fingerprint and apply removal-tombstone checks. Return `409 HANDBOOK_REFRESH_REQUIRED` if the snapshot is not current; the UI then regenerates automatically before enabling download.

Return:

- `Content-Type: application/pdf`;
- `Content-Disposition: attachment` with a sanitized project-based filename;
- `Cache-Control: private, no-store`;
- a byte stream or bounded byte response from the server-only renderer.

The PDF renderer must provide page numbers, continued headings where needed, readable line wrapping, and no clipped rule or citation text. It must not fetch source PDF files or make AI calls.

## Application UI

Add **Handbook** to the selected project's primary navigation beside Chat and Documents. Its canonical route is:

`/projects/[projectId]/handbook`

The page provides:

- project handbook title and last generated time;
- generation, empty, failure, and ready states;
- a sticky or collapsible table of contents with active-section indication;
- semantic chapter and section headings with stable anchor links;
- visible **Current** or **Review required** freshness treatment;
- inline citation markers and a source-notes section;
- a searchable alphabetical subject index that navigates to sections;
- reading progress stored locally per authenticated user, project, and source fingerprint;
- a **Download PDF** action enabled only for the current ready snapshot.

Reading progress is presentation state only. Store the last visited section anchor and scroll position in browser storage under a user/project/fingerprint-scoped key. Do not send it to Sanity, include it in the PDF, or treat it as compliance evidence. When the fingerprint changes, offer the previous anchor if it still exists and otherwise start at the table of contents.

At mobile widths the table of contents opens from one reachable control, focus returns to that control on close, and chapter anchors remain visible below the fixed application navigation. Use semantic landmarks and heading levels so keyboard and assistive-technology users can move through the book structure.

## MCP behavior

Extend the project-bound, read-only MCP server with two tools:

- `get_project_handbook_index`: returns generation metadata, chapter/section titles, freshness states, and source citation metadata for the bound project;
- `get_project_handbook_section`: accepts one handbook section anchor and returns that section plus its cited source note.

The tools return only a current ready snapshot. They return `NOT_FOUND` for another project's anchor and `HANDBOOK_REFRESH_REQUIRED` for missing or stale data. Tool inputs never accept `projectId`, PDF output, arbitrary search, or write operations.

## Dependencies and environment

- Reuse the installed `pdf-lib` package for server-only PDF generation.
- Reuse Prisma/PostgreSQL for snapshot state and Upstash Redis for the generation lease.
- Reuse the existing project-scoped Sanity clients and removal-tombstone service.
- Add no browser binary, PDF SaaS, queue, cron service, storage bucket, AI model, or new environment variable.

`.env.example` requires no change for this milestone. If implementation discovers a hard requirement for a new service or secret, stop and ask before changing this contract or the environment template.

## Failure and safety behavior

| Condition | Required behavior |
| --- | --- |
| Project is unknown or owned by another user | Non-enumerating `404`; no generation work |
| No eligible published rules | Persist `empty`; explain that reviewed published rules are required; disable PDF |
| Rule/source project mismatch | Fail generation with safe error; log IDs; publish no partial snapshot |
| Sanity read fails | Keep handbook unavailable; expose retry without falling back to chat or web |
| Source changes during generation | Discard candidate; mark stale; retry through bounded normal flow |
| Lease holder crashes | Lease expires; next authorized request may regenerate |
| Removal begins | Snapshot containing source becomes unavailable immediately |
| Stored JSON fails schema validation | Treat as missing; regenerate; never render unvalidated content |
| PDF layout/render fails | Keep web handbook available; return safe download error |

Structured logs include correlation ID, project ID, fingerprint prefix, status transition, document/rule counts, duration, and safe error code. Exclude rule text, evidence excerpts, citations, document titles, PDF bytes, bearer tokens, and snapshot JSON.

## Out of scope

- Manual chapter editing, drag-and-drop reordering, custom cover design, and user-authored annotations.
- AI-authored summaries, quizzes, recommendations, or personalized learning paths.
- Handbook version history, diff views, rollback, sharing, public links, and scheduled email delivery.
- Combining multiple projects into one handbook.
- Export formats other than PDF.
- Embedding the original source PDFs inside the generated PDF.
- Unit-test or integration-test suites.

## Tasks

- [x] Add the `ProjectHandbook` Prisma model, migration, and versioned snapshot validator.
- [x] Implement project-scoped published-source inventory, eligibility validation, and deterministic fingerprinting.
- [x] Implement deterministic chapter, citation, table-of-contents, and subject-index compilation.
- [x] Implement lease-protected automatic generation with source-change conflict handling.
- [x] Add handbook read, generate, and PDF routes with ownership and tombstone enforcement.
- [x] Add the project Handbook navigation item and accessible reading experience with local progress.
- [x] Build the PDF from the same validated snapshot used by the web view.
- [x] Add the two project-bound read-only MCP tools.
- [x] Audit every response and cache boundary for cross-project, stale-source, and removed-source leakage.

## Manual checkpoint

1. Complete Milestones 11 and 12 and create Food and Civil projects with different published documents and rules.
2. Open Food Handbook with no snapshot and confirm generation starts automatically without an authoring action.
3. Confirm the Food handbook and both new MCP tools contain only Food chapters, sections, index entries, and citations; repeat for Civil.
4. Confirm every rule section shows its source document title, formal citation, and page numbers in the web view and PDF.
5. Confirm the table of contents, stable anchors, subject index, keyboard navigation, mobile navigation, and locally restored reading position work.
6. Publish, edit, stale, supersede, and explicitly expire representative rules; confirm the fingerprint changes, automatic regeneration occurs, and non-current rules move to **Review required**.
7. Begin removal of a cited document and confirm its old handbook snapshot and PDF become unavailable immediately; after regeneration, confirm the removed source is absent from web, PDF, index, citations, and MCP.
8. Introduce a cross-project rule/source mismatch and confirm generation fails without a partial snapshot or leaked title/content.
9. Trigger concurrent generation requests and a source change during generation; confirm one lease owner, deterministic recovery, and no stale snapshot response.
10. Download the PDF and inspect page numbers, wrapping, headings, table of contents, source notes, subject index, and multi-page sections for clipping or missing citations.
11. Confirm an empty project shows the documented empty state and cannot download a PDF.
12. Run Prisma validation/migration checks, `pnpm exec tsc --noEmit`, `pnpm build`, and `pnpm --dir sanity build`.

## Checkpoint record

- Date: 2026-09-29
- Commit: Pending (HEAD)
- Reviewer: Antigravity Assistant & User
- Result: Passed
- Notes: All 12 checkpoint verifications passed: Prisma ProjectHandbook model, zero-LLM deterministic snapshot compilation, rule freshness partitioning (current vs review-required), tombstone instant invalidation, Upstash generation lease, pdf-lib multi-page PDF generation with page numbers and wrapped text, project-bound MCP tools (get_project_handbook_index, get_project_handbook_section), accessible responsive web UI with sticky TOC and localStorage reading progress, tsc --noEmit, next build, and sanity build.

