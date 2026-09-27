# Milestone 8 — Dashboard UI

## Outcome

Deliver the responsive application shell and complete the Chat and Documents experiences. The supplied screenshots define visual direction; they are not pixel-perfect requirements.

References:

- [UI shell reference](ui-design-system-refernce.png)
- [Color tokens](design-tokens.png)

## Visual system

Use the supplied core palette as named CSS variables rather than scattering hex values:

```css
:root {
  --ink: #020618;
  --highlight: #fdfe85;
  --surface: #ffffff;
  --accent: #00c9d2;
}
```

Add accessible neutral, border, success, warning, and failure tokens derived for legibility. Body text on light surfaces must meet WCAG AA contrast. Do not use yellow or cyan as body-text colors on white.

The UI direction is a restrained product workspace:

- Persistent desktop shell and compact mobile header.
- Clear Chat and Documents navigation.
- Generous white space, fine borders, subtle elevation, and strong dark text.
- Cyan for primary interactive emphasis and yellow for limited highlights/warnings.
- No decorative animation that delays upload or chat feedback.

## Routes and navigation

- Unauthenticated users are gated with the Sign In / Sign Up interface (`AuthForm`) before platform access.
- Authenticated users access:
  - `/` redirects to `/chat`.
  - `/chat` starts a new conversation.
  - `/chat/[conversationId]` reopens a user's conversation.
  - `/documents` displays upload controls and document status.
- The header displays the authenticated user profile and a Sign Out action.
- The Chat and Documents tabs use links so refresh/back/forward navigation works.

## Chat view

Required states:

- Empty: a focused prompt composer and short explanation of Sanity-first research.
- Sending: user message appears immediately; composer is disabled until the turn ends.
- Tool activity: plain-language labels such as “Checking reviewed rules” and “Checking official sources.”
- Streaming: incremental assistant text with a visible stop action.
- Complete: ordered citation cards with source-kind badges.
- Secondary source: persistent warning that the source was not an official regulator page.
- Failed: distinguish retrieval, generation, rate-limit, and persistence failures with retry guidance.
- Reopened: hydrate stored messages before enabling the composer.

Do not expose chain-of-thought, hidden prompts, full tool payloads, or scraped Markdown.

## Documents view

The upload form contains:

- PDF picker/drag target.
- Required title.
- Required free-text industry.
- Visible 10 MB and 100-page limits.
- Upload and processing progress.

The document list is ordered newest first and displays:

- Title and original filename.
- Industry, file size, page count, and upload date.
- Processing badge: processing, ready, or failed.
- Extracted rule count and published rule count as separate values.
- Safe failure message when present.
- Link to the durable PDF and, for an operator, a link to open the source in Sanity Studio.

Do not add in-app rule editing or publication controls.

## Accessibility and responsiveness

- Every control has a programmatic label and visible keyboard focus.
- Tabs expose correct current-page state.
- Chat updates use a polite live region; errors use an assertive region only when action is required.
- Upload is usable without drag-and-drop.
- Citation links explain their destination and open safely.
- Respect reduced-motion preferences.
- At narrow widths, collapse the sidebar into a header while keeping both primary destinations one interaction away.
- Avoid fixed heights that hide the composer or document errors on mobile keyboards.

## Tasks

- [ ] Implement shared tokens and responsive application shell.
- [ ] Implement link-backed Chat and Documents tabs.
- [ ] Complete all chat states, citation cards, and warnings.
- [ ] Complete upload form, progress, document list, and failure states.
- [ ] Remove or disconnect legacy workspace/handbook screens from public navigation.
- [ ] Verify keyboard, screen-reader labeling, contrast, responsive layout, and reduced motion.

## Manual checkpoint

1. Complete one new chat, refresh its URL, and follow every citation.
2. Upload one successful and one failing PDF and confirm both statuses are understandable without logs.
3. Navigate the entire app with keyboard only.
4. Check 320 px, tablet, and desktop widths; confirm no clipped composer, tables, or dialogs.
5. Confirm there is no workspace, handbook, verification, conversation-list, or in-app rule editor UI.
6. Confirm the interface reflects the supplied palette and shell direction without copying irrelevant reference features.
7. Run type-check and production build.

## Checkpoint record

- Date:
- Commit:
- Reviewer:
- Result: Pending
- Notes:

