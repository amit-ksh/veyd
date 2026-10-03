---
name: project-reader-ui
description: Implement the persisted AI-written project book and refined research/documents UI in Milestone 14, including citations, exports, history and loading states.
---

# Project reader and UI

Read [Milestone 14](../../../docs/14-project-reader-and-ui-refinement.md), the docs index and shared implementation protocol before editing. This contract supersedes the specific earlier milestone exclusions it names; preserve all other project, publication and removal boundaries.

1. Inspect the stored snapshot, source inventory and affected UI/API response shapes. Keep AI authoring separate from snapshot reading/export. Completion: dependencies and existing callers are identified, including MCP.
2. Implement source-bounded AI drafting with validated citation keys, source coverage, explicit evidence labels and versioned persisted pages. Completion: generation produces a reusable snapshot and fails visibly on missing support or changed sources.
3. Render the A5 reader and exports from that snapshot. Use the cable handbook only as a layout reference, not as domain content. Completion: contents, page navigation, progress, citation reveal, reference explorer and figures work across desktop/mobile.
4. Refine the app copy, chat Markdown, document form/rows, previous chats and token creation response. Completion: user/project isolation and one-time plaintext-token display survive loading, failure, project switching and reconciliation.
5. Run the milestone's build and manual checks without adding unit/integration suites. Report visual/factual validation limits separately from passing compilation. Stop at the checkpoint for review.

Ask the user before adding OAuth, Firecrawl ingestion, new authoring inputs or source-image extraction. Use skeletons for page data and circular loaders only inside pending action buttons.
