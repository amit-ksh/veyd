---
title: "Veyd: one place to research, learn, and build across domains"
published: false
tags: devchallenge, sanitychallenge, sanity, ai
---

*This is a submission for the [Sanity Challenge, Path Two: Vibe-Code Something Strange](https://dev.to/challenges/sanity-2026-09-16).*

## What I Built

Veyd is a project workspace for researching documents with a clear path back to the source. Add a PDF, review AI-extracted entries in Sanity Studio, then ask cited questions or read an automatically drafted project handbook. Food and civil projects keep their documents, conversations, books and MCP access separate.

### Why I built it

I wanted a central knowledge base for learning any domain & its standards. I build software across different fields, and each new project means researching a domain whose useful information is scattered across repositories and source documents. Veyd gives me one place to collect sources, research and learn from them, and return to the material through a project handbook. I can also share that project knowledge with compatible AI agents through MCP, so they work from the same context.

### Features

- **Project workspaces:** keep documents, conversations, handbooks and MCP credentials separate.
- **PDF to reviewed knowledge:** upload a PDF, inspect AI-extracted drafts against the original in Sanity Studio, then publish verified entries.
- **Research chat:** ask questions against published project knowledge, with citations; use labeled external research when needed. Attach a PDF or confirm import of a research-discovered PDF card from chat.
- **Reusable handbook:** generate a cited, indexed project book; resume reading and download PDF or offline HTML.
- **History and control:** reopen previous chats, offer read-only project knowledge to compatible MCP clients, and remove a document from active context while retaining historical citation origins.

### Architecture at a glance

[![Veyd architecture: the app connects to Sanity's PDF assets, structured entries and Studio review; published GROQ reads power chat, handbook and MCP. Supporting services are Gemini, Firecrawl, PostgreSQL, private Blob and Upstash.](https://veyd-seven.vercel.app/presentation/architecture.png)](https://veyd-seven.vercel.app/presentation/architecture.png)

Sanity holds the source knowledge and review workflow. PostgreSQL + Prisma keep accounts, projects, chats, handbook snapshots and MCP credentials. Gemini writes drafts and answers; Firecrawl discovers sources and parses public PDFs. Private Vercel Blob provides temporary upload storage.

Upstash Redis handles rate limits and the handbook generation lock. The key boundary is that extraction creates **drafts**; only human-reviewed, published Sanity entries become reusable project knowledge.

## Demo

- **Live app:** [veyd-seven.vercel.app](https://veyd-seven.vercel.app/)
- **Public presentation:** [Veyd presentation](https://veyd-seven.vercel.app/presentation)
- **Sanity app:** [Veyd Sanity Studio](https://sanity-zeta-six.vercel.app/)
- **Walkthrough video or screenshots:** ADD_VIDEO_OR_SCREENSHOT_LINKS
- **Judge access:** ADD_DEMO_SIGN_IN_AND_STUDIO_ACCESS_INSTRUCTIONS

## Code

[Veyd repository](https://github.com/amit-ksh/veyd) — Next.js app, Sanity Studio, schemas and milestone documentation.

## My Build Process

I used Codex to break the app into small implementation milestones and verify each feature against its source and review boundaries. I also used Google Antigravity during implementation. The prompts evolved from project-scoped Food/Civil research to an automatically drafted, cited handbook and confirmed PDF import from chat. I kept the AI output as drafts until someone checks and publishes it in Studio.

Two corrections shaped the build. A private Vercel Blob store rejected a public upload request, so the upload flow was aligned with private storage. A public FDA PDF link did not provide usable bytes through a direct download, so research PDF ingestion now uses Firecrawl retrieval and PDF parsing, with file and page validation before extraction. Those failures changed the implementation rather than becoming success claims in the demo.

## How I Used Sanity

Sanity is Veyd's source-and-review layer:

1. **Content Lake + assets:** store each original PDF with a project-scoped `complianceDocument`, and extracted `complianceRule` drafts that reference the document, source pages and evidence excerpts.
2. **Studio:** group source documents, rules awaiting review and published rules so a person can check and correct a draft before publishing it.
3. **GROQ:** read only published, project-matched entries for cited chat, handbook generation and Veyd's custom read-only MCP endpoint.

Gemini handles extraction, answer writing and handbook drafting; Firecrawl handles external discovery and public PDF parsing.

### Sanity features used

- **Content Lake and file assets:** durable source PDFs and structured, source-linked knowledge entries.
- **Schemas, references and validation:** typed content, linked documents, source pages, evidence excerpts and required review metadata.
- **Studio Structure Tool and document actions:** source/status lists, an awaiting-review queue, freshness views and human editing/publishing. [Studio configuration](https://github.com/amit-ksh/veyd/blob/main/sanity/sanity.config.ts).
- **Mutation API and atomic transactions:** create a batch of unpublished rule drafts together, patch processing results, and remove linked content through bounded transactions. [Ingestion implementation](https://github.com/amit-ksh/veyd/blob/main/src/lib/ingestion/service.ts#L248), [removal implementation](https://github.com/amit-ksh/veyd/blob/main/src/lib/tombstones/remover.ts#L263). These use [SDK mutation transactions](https://www.sanity.io/docs/apis-and-sdks/js-client-transactions), not direct Actions API calls.
- **GROQ queries and ranked search:** project filters, keyword/citation scoring and reference expansion retrieve relevant entries with their source PDFs. [Published queries](https://github.com/amit-ksh/veyd/blob/main/src/lib/sanity/published-queries.ts).
- **Published perspective and API CDN:** server-side readers exclude drafts and use the CDN in production; the separate write client bypasses the CDN. [Client configuration](https://github.com/amit-ksh/veyd/blob/main/src/lib/sanity/clients.ts).
- **Vision plugin:** enabled in Studio for inspecting and trying GROQ queries.

### Sanity schema structure

All six custom document types registered in [the schema index](https://github.com/amit-ksh/veyd/blob/main/sanity/schemaTypes/index.ts) are listed below. The active knowledge model keeps each entry connected to its original source:

`complianceRule.sourceDocument` → `complianceDocument.fileAsset` → Sanity PDF asset.

| Schema | Purpose and current use | Fields |
| --- | --- | --- |
| [`complianceDocument`](https://github.com/amit-ksh/veyd/blob/main/sanity/schemaTypes/complianceDocument.ts) | Active source PDF and extraction record. | `projectId`, `title`, `fileAsset`, `industry`, `originalFileName`, `mimeType`, `fileSizeBytes`, `pageCount`, `processingStatus`, `extractionModel`, `extractedRuleCount`, `uploadedAt`, `extractionCompletedAt`, `failureMessage`. |
| [`complianceRule`](https://github.com/amit-ksh/veyd/blob/main/sanity/schemaTypes/complianceRule.ts) | Active, source-linked entry drafted by AI and reviewed in Studio. | `projectId`, `ruleName`, `description`, `requirement`, `applicability`, `jurisdiction`, `regulator`, `citation`, `effectiveDate`, `expiresAt`, `sourceDocument`, `sourcePages`, `evidenceExcerpt`, `industry`, `keywords`, `freshnessStatus`, `lastReviewedAt`. |
| [`conversation`](https://github.com/amit-ksh/veyd/blob/main/sanity/schemaTypes/conversation.ts) | Earlier Sanity chat-session model; still registered, but current chats use PostgreSQL. | `createdAt`, `updatedAt`. |
| [`message`](https://github.com/amit-ksh/veyd/blob/main/sanity/schemaTypes/message.ts) | Earlier Sanity message model, linked to a conversation; current messages use PostgreSQL. | `conversation`, `role`, `content`, `clientMessageId`, `citations`, `createdAt`. |
| [`industry`](https://github.com/amit-ksh/veyd/blob/main/sanity/schemaTypes/industry.ts) | Deprecated domain/category model retained for migration safety. | `title`, `slug`, `icon`, `summary`. |
| [`chapter`](https://github.com/amit-ksh/veyd/blob/main/sanity/schemaTypes/chapter.ts) | Deprecated authored handbook model; current generated handbook snapshots use PostgreSQL. | `title`, `slug`, `industry`, `order`, `summary`, `estimatedMinutes`, `body`, `rules`. |

**Embedded object:** `message.citations[]` contains `citationItem` objects with `sourceKind`, `title`, `url`, `ruleId`, `documentId` and `citation`. Source kinds distinguish Sanity, official web and secondary web evidence. This is a nested object, not a seventh document type.

**Other relationships:** `message.conversation` references `conversation`; legacy `chapter.industry` references `industry`, and `chapter.rules[]` references `complianceRule`. Chapter `body` contains Portable Text blocks and images. PDF and image files use Sanity's built-in asset types rather than additional custom schemas. Standard Sanity system fields such as `_id` and `_type` are omitted from the field inventory.

Studio requires a human review timestamp before publication. Project-matched, published GROQ reads exclude drafts; the app also excludes removed documents. Projects are PostgreSQL records, linked through `projectId`, not Sanity project documents. The active document/rule `industry` fields are strings, not references to the legacy `industry` schema; the current upload flow derives that value from the project name. The [schema definitions](https://github.com/amit-ksh/veyd/tree/main/sanity/schemaTypes) remain the source of truth.

## Sanity Project Details

**Sanity project ID:** `erhznx84`

## Agent Session

Curated highlights from my implementation conversation, edited for clarity:

- I started with a central knowledge base: research a domain, learn from its sources, revisit a handbook, and share the same context with agents.
- I asked Codex to turn the scope into feature milestones and reusable repository skills, keeping project isolation and human review explicit.
- We built cited research, stored handbooks and confirmed PDF import from chat. Private uploads and failing public PDF downloads led to storage fixes and Firecrawl parsing.
- I refined the UI into a minimal reader and presentation, then asked for type/build checks and manual browser verification.

These are a summary, not a raw exported agent transcript. [Focused session notes](https://github.com/amit-ksh/veyd/blob/main/docs/agent-session-highlights.md) provide the short recording outline.

<!-- This is a Path Two draft. Do not switch its heading to Path One unless a real Sanity Context Knowledge Base or eligible full-dataset Context MCP integration is implemented and verified; Veyd's custom MCP endpoint alone does not meet that claim. Before publishing: deploy and verify /presentation and /presentation/architecture.png, and commit/push the linked session notes. Replace remaining ADD_* fields with working video/screenshot links and judge access instructions, or remove optional fields. The Sanity app URL was supplied by the author; verify judge access separately. Confirm repository visibility, the main branch links and the deployed Sanity project ID. Expand Antigravity's contribution only from the author's evidence. If embedding an actual Agent Session, export a genuine transcript, curate/redact it and make it public; the summary above is not an exported session. Add a cover image if desired. Team submissions must credit DEV handles. -->
