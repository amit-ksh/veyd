---
primaryTarget: src/components/chat-file-ingestion.tsx
relatedTargets:
  - src/components/chat-file-cards.tsx
  - src/components/app-shell.tsx
---

## Direction contract

THESIS: Extend Research Chat with confirmed PDF imports; keep the existing interface and publication boundary.

OWN-WORLD: Existing slate/cyan palette, white bordered cards, restrained icons, dark primary actions, compact typography.

STORY: Readers see a PDF, choose Add to project knowledge, inspect its destination/name, then confirm or cancel.

FIRST VIEWPORT: Preserve sidebar and conversation. Put source cards below their messages; put Attach PDF beside the chat workflow. Center confirmation with Cancel and a named, loading primary action.

FORM: Local extension of the incumbent app, not a new direction or redesign. No seed or generated imagery applies.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Scope boundary

The user authorizes only Milestone 15. Record the existing component language here; do not create a new global brand system or redesign unrelated routes. Browser fixtures are labeled synthetic and are not live-service evidence. This extension ships no raster assets.

## Observed implementation — 2026-10-03

These notes describe the current chat PDF extension, not a project-wide design system. The documentation boundary is this existing brief. No PRODUCT.md, DESIGN.md, design sidecar, new branding, assets or skills are introduced.

Local execution exception to FINISH: the user restricted this work to the Milestone 15 extension and did not authorize global product/design documentation or new creative choices. The scoped finish review and observed notes are therefore recorded here; the general FINISH wording above is retained. This is a surface-only documentation handoff, not completion of the standard global DESIGN.md workflow.

### Colors and typography

The components use white surfaces, slate borders and text, dark primary actions, cyan focus rings and rose errors. Cards use slate-200 borders; attachment controls and the document-name input use slate-300 borders. Titles use slate-900, metadata slate-600, primary buttons slate-950 with white text and a slate-800 hover. Attachment/Cancel hover surfaces use slate-50. Focus rings use cyan-600; file-card primary actions add a ring offset. Errors use rose-700. The dialog backdrop uses slate-950 at 50% opacity. These are the existing Tailwind utility roles, with no added palette tokens. Sources: [attachment and dialog](../../src/components/chat-file-ingestion.tsx#L195), [file cards](../../src/components/chat-file-cards.tsx#L35).

Compact type follows the incumbent sans styling: metadata and small actions use 0.75rem/1rem; card names and form text use 0.875rem/1.25rem; the confirmation heading uses 1.125rem/1.75rem. Names, primary actions and the heading use weight 600; the field label and Cancel use weight 500. Confirmation explanatory text uses relaxed leading (1.625). This feature declares no new font family. The root applies `font-sans` and loads a Figtree CSS variable; these notes do not assert a new resolved font-family rule. Sources: [root layout](../../src/app/layout.tsx#L7), [confirmation text](../../src/components/chat-file-ingestion.tsx#L280), [file-card text](../../src/components/chat-file-cards.tsx#L45).

### Layout, shape and depth

The attachment area stays within the shell's centered 48rem chat width. File cards appear below the corresponding message and before its citations. Attachment rows, local selections and card actions wrap with 0.75rem gaps. Card title containers have zero minimum width, and titles wrap at word boundaries. Card actions align with the text column using 1.75rem left padding. Sources: [message placement](../../src/components/app-shell.tsx#L1494), [attachment placement](../../src/components/app-shell.tsx#L1975), [card layout](../../src/components/chat-file-cards.tsx#L38).

Cards are white, bordered, flat containers with 0.75rem corners and 0.75rem padding. Controls use 0.5rem corners; small attachment/card actions have 0.75rem horizontal and 0.5rem vertical padding. Modal actions have 1rem horizontal and 0.5rem vertical padding. The confirmation is a native modal dialog, centered with automatic margins, 1rem corners and an extra-large shadow over its dimmed backdrop. Its width is `calc(100% - 2rem)`, capped at 32rem; height is capped at 90dvh with vertical scrolling. Form padding is 1.25rem, increasing to 1.5rem at the existing 640px small breakpoint; groups are separated by 1.25rem. Sources: [local selection](../../src/components/chat-file-ingestion.tsx#L222), [dialog and form](../../src/components/chat-file-ingestion.tsx#L270), [modal actions](../../src/components/chat-file-ingestion.tsx#L332).

In the 390px screenshot, Cancel and Confirm share a row. At 320px they wrap into separate right-aligned rows; both actions remain visible. The source URL wraps at any character. The attachment helper and row also wrap at narrow widths. This is the existing flexible layout, with no mobile-specific redesign. Sources: [URL and actions](../../src/components/chat-file-ingestion.tsx#L310), [390px capture](../review/mobile.png), [320px capture](../review/mobile-320.png).

### Confirmation, loading and result behavior

Selecting a non-empty local PDF within the 10 MB client limit stores the File locally and shows its name, size and “Selected locally, not uploaded.” The helper also states the 100-page limit and confirmation requirement. The selection can be removed. Add to project knowledge opens confirmation; a local document name defaults to the filename without the PDF suffix, bounded to 200 characters. Research cards open the same confirmation with their candidate title. Sources: [selection and validation](../../src/components/chat-file-ingestion.tsx#L76), [local card](../../src/components/chat-file-ingestion.tsx#L222).

Confirmation names the fixed current project, provides the required editable document name, labels official or secondary web provenance and links the candidate URL where applicable. It states that extracted entries require review/publication before chat, handbook or MCP use. `showModal()` supplies native focus containment, the dialog has a named heading/description, and initial focus goes to Cancel. Cancel and Escape close an idle confirmation without invoking its upload/import function; canceling retains the selected local file. Sources: [dialog lifecycle](../../src/components/chat-file-ingestion.tsx#L63), [confirmation contents](../../src/components/chat-file-ingestion.tsx#L270).

Confirm starts the work. Local imports first show “Uploading PDF…” and then “Adding document…”; web imports show “Adding document…”. The primary action displays that phase with a 1rem spinner, disabled under reduced motion. Busy state disables attachment, removal, name editing, Cancel and repeated confirmation; the shell also disables chat submission, suggestions, New Session and other file-import actions. The handler guards against repeated in-flight submission. The dialog closes on a returned receipt; ready receipts become file cards, while pending/failed outcomes retain their explicit error/status. A thrown request error is shown in the dialog. Sources: [confirmed import](../../src/components/chat-file-ingestion.tsx#L94), [busy controls](../../src/components/chat-file-ingestion.tsx#L332), [shell busy guards](../../src/components/app-shell.tsx#L437), [follow-up guards](../../src/components/app-shell.tsx#L1662).

File cards render the server-returned state: “PDF link · not yet validated”, “Import started · check Documents”, “Added to Documents · review required”, “Could not add document” or “Source removed”. They show source, known size and page count. Available research PDFs and retryable failures offer Add to project knowledge. Durable, processing or uncertain failed receipts offer Open in Documents; removed cards suppress source links and import/document actions. External links open with `noopener noreferrer`. Sources: [card states](../../src/components/chat-file-cards.tsx#L21), [card actions](../../src/components/chat-file-cards.tsx#L70).

The shell reconciles the returned receipt into message metadata and the returned conversation URL. Attachment state remounts on the shell's project/requested-conversation/session key, and project/new-session handlers clear the web candidate. The ingestion component checks its original project/conversation and mounted state before applying a result. These are observed client guards, not proof of backend ownership, persistence or cache acceptance. Sources: [project switch](../../src/components/app-shell.tsx#L198), [new session](../../src/components/app-shell.tsx#L437), [receipt reconciliation](../../src/components/app-shell.tsx#L526), [attachment key](../../src/components/app-shell.tsx#L1980), [result scope guard](../../src/components/chat-file-ingestion.tsx#L156).

## Scoped finish review

Disposition: **ship**, with no material fixes for the reviewed local extension. The four captures were opened and visually checked: [desktop](../review/desktop.png) (1440 × 1000, locally selected PDF in empty chat), [desktop ready](../review/desktop-ready.png) (1440 × 1000, synthetic imported receipt in ongoing chat), [mobile](../review/mobile.png) (390 × 844, research-source confirmation), and [mobile 320](../review/mobile-320.png) (320 × 844, wrapped confirmation actions). They preserve the shell, readable source/status hierarchy and usable confirmation layout at the captured widths.

The captures explicitly use a Fixture project, synthetic chat/receipt content and fixture service responses. They support the scoped visual verdict only. They do not establish real Blob upload/cleanup, external PDF download validation, Sanity draft extraction/publication, durable saved-chat refresh, original-project cache behavior, or the ownership/duplicate/unsafe-source scenarios in [Milestone 15's manual checkpoint](../../docs/15-chat-document-ingestion.md). The live checkpoint remains pending, as does Milestone 14's outstanding live acceptance. Loading, error, removed and retry states above are recorded from source; those states are not all shown in the four captures.

The implementation handoff reports 12 passing browser fixture checks covering local selection and Escape/Cancel without POST, initial Cancel focus, disabled pending confirmation and ignored pending Escape, one metadata-only web import without an arbitrary URL, refresh-restored ready metadata, an error without false success, narrow-dialog containment, cleared selection on project navigation and no JavaScript errors. These are reported fixture checks; this documentation pass inspected source and the four saved captures. Authenticated browser Blob token issuance and a project switch during an in-flight import were not demonstrated by that fixture review. The reviewer reached the scoped finish ceiling and reported no material fixes.

Not canonized: the surrounding shell's unrelated visual conventions and any inferred brand language are outside this feature brief. The review captures are evidence files, not shipping raster assets.
