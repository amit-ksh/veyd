---
title: "Veyd: turning source PDFs into reviewed project knowledge with Sanity"
published: false
tags: devchallenge, sanitychallenge, sanity, ai
---

*This is a submission for the [Sanity Challenge, Path Two: Vibe-Code Something Strange](https://dev.to/challenges/sanity-2026-09-16).*

## What I Built

Veyd is a project workspace for researching documents with a clear path back to the source. Add a PDF, review AI-extracted entries in Sanity Studio, then ask cited questions or read an automatically drafted project handbook. Food and civil projects keep their documents, conversations, books and MCP access separate.

### Why I built it

I wanted a central knowledge base for learning any domain. I build software across different fields, and each new project means researching a domain whose useful information is scattered across repositories and source documents. Veyd gives me one place to collect sources, research and learn from them, and return to the material through a project handbook. I can also share that project knowledge with compatible AI agents through MCP, so they work from the same context.

### Features

- **Project workspaces:** keep documents, conversations, handbooks and MCP credentials separate.
- **PDF to reviewed knowledge:** upload a PDF, inspect AI-extracted drafts against the original in Sanity Studio, then publish verified entries.
- **Research chat:** ask questions against published project knowledge, with citations; use labeled external research when needed. Attach a PDF or confirm import of a research-discovered PDF card from chat.
- **Reusable handbook:** generate a cited, indexed project book; resume reading and download PDF or offline HTML.
- **History and control:** reopen previous chats, offer read-only project knowledge to compatible MCP clients, and remove a document from active context while retaining historical citation origins.

### Architecture at a glance

```text
User → Next.js app/API on Vercel
         ├─ PostgreSQL + Prisma → accounts, projects, chats, handbook snapshots, MCP credentials
         ├─ Private Vercel Blob → temporary PDF upload ingress
         ├─ Gemini → draft extraction, cited answers, handbook writing
         ├─ Firecrawl → external research and public PDF parsing
         └─ Sanity Content Lake → original PDF assets + linked, structured entries
                ↑                         │
         Sanity Studio review              └─ published, project-scoped GROQ reads
                                             → chat, handbook and read-only MCP
```

Upstash Redis handles rate limits and the handbook generation lock. The key boundary is that extraction creates **drafts**; only human-reviewed, published Sanity entries become reusable project knowledge.

## Demo

- **Live app:** [veyd-seven.vercel.app](https://veyd-seven.vercel.app/)
- **Public presentation:** ADD_DEPLOYED_DEMO_URL
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

## Sanity Project Details

**Sanity project ID:** `erhznx84`

## Agent Session

ADD_PUBLIC_AGENT_SESSION_LINK_OR_REMOVE_THIS_OPTIONAL_SECTION

<!-- This is a Path Two draft. Do not switch its heading to Path One unless a real Sanity Context Knowledge Base or eligible full-dataset Context MCP integration is implemented and verified; Veyd's custom MCP endpoint alone does not meet that claim. Before publishing: expand the Antigravity sentence if the author supplies its exact contribution. /demo returned 404 on 2026-10-03 and needs deployment and recheck. Replace all remaining ADD_* fields with working public links and judge access instructions, or remove optional sections that do not apply. If using an Agent Session, curate it, check for secrets and make it public. Confirm repository visibility and the Sanity project ID for the deployed environment. Add a cover image if desired. If this is a team submission, list each teammate's DEV handle. -->
