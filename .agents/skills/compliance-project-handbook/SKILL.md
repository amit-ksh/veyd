---
name: compliance-project-handbook
description: Implement or audit automatically generated, cited, book-indexed project handbooks with web reading progress, PDF download, and project-bound MCP reads. Use for milestone 13.
---

# Compliance Project Handbook

Build one evidence-bound handbook from each project's reviewed published rules.

1. Read [`docs/13-project-handbook.md`](../../../docs/13-project-handbook.md) and the shared implementation protocol completely.
2. Verify Milestones 11 and 12 first. Completion means ownership, project-scoped retrieval, and removal tombstones are enforced on every source path.
3. Inventory eligible published rules and matching source documents with the authorized project ID. Reject incomplete or cross-project relationships instead of compiling a partial book.
4. Compute the deterministic source fingerprint and generate the versioned structured snapshot. Copy reviewed fields and citations; keep Gemini, chat content, web findings, PDF bytes, and evidence excerpts out of generation.
5. Serialize generation with the project lease. Serve only a fingerprint-current, schema-valid snapshot, and invalidate it immediately when a cited source enters removal.
6. Render the web handbook, table of contents, subject index, freshness states, source notes, and local reading progress from that snapshot.
7. Render the downloadable PDF from the same snapshot with complete citations, page numbers, readable wrapping, and no clipped content.
8. Add only the two documented project-bound read-only MCP tools. Their schemas never accept a project ID.
9. Run every isolation, regeneration, removal, citation, accessibility, layout, and build checkpoint. Stop after reporting evidence.

Keep manual editing, AI-authored material, version history, sharing, scheduling, and additional export formats outside this milestone.

