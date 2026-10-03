---
title: "Veyd: turning source PDFs into reviewed project knowledge with Sanity"
published: false
tags: devchallenge, sanitychallenge, sanity, ai
---

*This is a submission for the [Sanity Challenge, Path Two: Vibe-Code Something Strange](https://dev.to/challenges/sanity-2026-09-16).*

## What I Built

Veyd is a project workspace for researching documents with a clear path back to the source. Add a PDF, review AI-extracted entries in Sanity Studio, then ask cited questions or read an automatically drafted project handbook. Food and civil projects keep their documents, conversations, books and MCP access separate.

The app also supports research-discovered PDF cards, confirmed import from chat, saved conversations, PDF/offline handbook downloads, read-only project MCP access, and removal of a document from active knowledge while keeping historical citation origins.

## Demo

- **Live app:** [veyd-seven.vercel.app](https://veyd-seven.vercel.app/)
- **Public presentation:** ADD_DEPLOYED_DEMO_URL
- **Walkthrough video or screenshots:** ADD_VIDEO_OR_SCREENSHOT_LINKS
- **Judge access:** ADD_DEMO_SIGN_IN_AND_STUDIO_ACCESS_INSTRUCTIONS

## Code

[Veyd repository](https://github.com/amit-ksh/veyd) — Next.js app, Sanity Studio, schemas and milestone documentation.

## My Build Process

I used Codex to break the app into small implementation milestones and verify each feature against its source and review boundaries. The prompts evolved from project-scoped Food/Civil research to an automatically drafted, cited handbook and confirmed PDF import from chat. I kept the AI output as drafts until someone checks and publishes it in Studio.

Two corrections shaped the build. A private Vercel Blob store rejected a public upload request, so the upload flow was aligned with private storage. A public FDA PDF link did not provide usable bytes through a direct download, so research PDF ingestion now uses Firecrawl retrieval and PDF parsing, with file and page validation before extraction. Those failures changed the implementation rather than becoming success claims in the demo.

## Sanity Project Details

**Sanity project ID:** `erhznx84`

Sanity Content Lake holds the PDF assets and structured document/entry records. Each entry links back to its source document and carries source pages and evidence. Studio groups source documents, drafts awaiting review and published entries. Project-scoped GROQ queries expose published content to chat and the app's custom read-only MCP endpoint. Gemini drafts extraction, answers and handbooks; Firecrawl handles external discovery and PDF parsing. The custom MCP endpoint is not Sanity Context MCP.

<!-- Before publishing: /demo returned 404 on 2026-10-03 and needs deployment and recheck. Replace all remaining ADD_* fields with working public links and judge access instructions. Confirm repository visibility and the Sanity project ID for the deployed environment. If this is a team submission, list each teammate's DEV handle. -->
