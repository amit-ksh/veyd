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

Gemini handles extraction, answer writing and handbook drafting; Firecrawl handles external discovery and public PDF parsing. Veyd's MCP endpoint is **not** Sanity Context MCP.

### Sanity schema structure

The active knowledge model keeps each entry connected to its original source:

`complianceRule.sourceDocument` → `complianceDocument.fileAsset` → Sanity PDF asset.

| Type | What it stores |
| --- | --- |
| `complianceDocument` | `projectId`, title, PDF asset, original filename, size, page count, processing status and extraction metadata. |
| `complianceRule` | `projectId`, name, description, requirement, applicability, authority/citation, source document reference, pages, evidence excerpt, keywords, freshness and `lastReviewedAt`. |

Studio requires a human review timestamp before publication. Project-matched, published GROQ reads exclude drafts; the app also excludes removed documents. Projects are PostgreSQL records, linked here through `projectId`, not Sanity project documents. The [schema definitions](https://github.com/amit-ksh/veyd/tree/main/sanity/schemaTypes) remain the source of truth; registered legacy types are retained for migration safety, not used as the current chat/handbook store.

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
