# Document entry review

Primary target: `src/components/document-review-dialog.tsx`
Related targets: `src/components/document-row.tsx`, `src/hooks/use-document-review.ts`
Mode: Operate. Extend the existing Documents surface; do not change the global visual system.

## Direction contract

THESIS: Evidence first, deliberate selected-entry publication; no automatic approval.

OWN-WORLD: Inherit Veyd's white/slate surfaces, dark actions, sans-serif controls and cyan focus.

STORY: Open a document's pending entries, compare citations and PDF pages, correct text, select reviewed entries and explicitly confirm publication.

FIRST VIEWPORT: Protected-focus review dialog, document title above pending entries; each entry has selection and expandable evidence/editing. The persistent bottom action names the selected count. Mobile stacks controls without losing the action.

FORM: Local extension, no seed required. Native checkboxes and dialog provide familiar selection and focus containment. Skeleton content loading; circular button loading.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Scope boundary

This is a local extension of Documents for explicit owner review and selected-entry publication. Root `DESIGN.md` remains the visual authority; this brief records the implemented surface without changing global tokens, typography or branding. Studio remains available. No shipping raster assets are introduced.

## Observed implementation — 2026-10-04

### Layout, components and responsive behavior

The ready document row adds a dark “Review entries” button when extracted entries exist. Its more-actions menu retains “Review in Studio”. Opening review presents a native modal dialog with the heading, guidance, document title and total awaiting review. Entry summaries pair a native selection checkbox with the requirement, citation and individual PDF-page links. “Review evidence & edit” expands the original source excerpt and labeled correction fields. The source excerpt remains visible separately from the editable supporting excerpt. Source: `src/components/document-row.tsx`, `src/components/document-review-dialog.tsx`.

The dialog inherits white surfaces, slate text and borders, dark actions, cyan field focus and the application's compact sans typography. Teal underlined PDF links distinguish evidence navigation; rose validation/error text and emerald success text supplement their explicit messages. The modal has gently rounded corners (16px), an overlay shadow and a dimmed backdrop. This surface introduces no new global visual roles.

The modal is centered, occupies at most 95vw with an 896px width cap, and is bounded to 94dvh. Its fixed header and persistent footer surround a vertically scrolling entry list. Interior horizontal padding is 20px, increasing to 24px from the existing small breakpoint (640px). Correction fields use one column on narrow screens; paired metadata fields become two columns at that breakpoint. Entry names, requirements, citations and excerpts wrap. Selection tools and footer controls also wrap, keeping the approval and publication action in the dialog. The footer names the selected count and states that only selected entries and their corrections are saved. Source: `src/components/document-review-dialog.tsx`.

### Review, confirmation and result states

Nothing is preselected. Owners choose up to 50 entries per batch, inspect evidence and correct fields, then check the explicit source-review approval. Selection changes and edits clear that approval. Corrections remain local until the selected entries are published; closing or reloading with unpublished corrections requests confirmation to discard them. Invalid selected fields expose validation messages and block publication. The action reads “Publish selected (count)”. Source: `src/components/document-review-dialog.tsx`, `src/lib/review/types.ts`.

Review holds a revision-bound snapshot. Window focus does not silently refresh the editor; Reload deliberately clears selection, approval and local corrections before fetching the latest entries. Loading the entry list uses `ContentSkeleton`; reloading and publishing use `CircularLoader`. An initial load failure offers Reload entries. Empty review names the absence of drafts and links to Studio. A bounded list with further drafts explains that owners can publish a selection and reload to continue. Source: `src/components/document-review-dialog.tsx`, `src/hooks/use-document-review.ts`.

Publishing locks editing, selection, reload and dismissal while the request is pending. A confirmed result removes only the published entries, clears selection/approval and reports the published count while unselected entries remain drafts. Errors retain local corrections and show an alert; uncertain or stale publication tells the owner to reload before retrying. The query cache updates only after a confirmed result, then refreshes document and handbook data. Source: `src/components/document-review-dialog.tsx`, `src/hooks/use-document-review.ts`.

The dialog uses `showModal()`, a named heading and description, an explicit Tab/Shift+Tab loop, Escape dismissal through the same close handler, and focus restoration to the invoking control on unmount. Busy publication prevents dismissal. Native checkboxes, inputs, textarea, date fields and select retain familiar form affordances. Source: `src/components/document-review-dialog.tsx`.

### Publication boundary

The private review API requires an authenticated owner and checks the source document's project, readiness and removal status. Publication requires explicit review confirmation, validated fields and the pinned draft revisions. Sanity edit/publish actions execute as one atomic batch with draft and existing published revision conditions; there is no automatic publication or optimistic approval. These are source observations rather than evidence that every live conflict or failure condition has been exercised. Sources: `src/app/api/projects/[projectId]/documents/[documentId]/review/route.ts`, `src/lib/review/service.ts`.

## Scoped finish review

Disposition: **ship**. The independent finish reviewer inspected the actual UI at 1440 × 1000, 390 × 844 and 320 × 700 and reported no material findings. Evidence captures: [desktop](../review/review-desktop.png), [mobile](../review/review-mobile.png) and [320px](../review/review-320.png). The handoff confirms contained scrolling, wrapped controls, visible evidence and publication actions, keyboard focus looping, Escape dismissal and focus restoration at the inspected states. This documentation pass verified the component/service source and the capture paths; the visual verdict belongs to that independent review.

Screen-reader behavior, mobile software-keyboard behavior, and all loading/error states were not independently verified by that finish review. Their behavior above is recorded from source. The captures do not prove all live ownership, revision-conflict, removal-race or upstream-failure cases. Existing detector warnings about 11px DocumentRow badges predate this dialog and are outside this local extension. The review images are evidence, not shipping raster assets.
