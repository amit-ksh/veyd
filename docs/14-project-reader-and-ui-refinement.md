# Milestone 14 — Project reader and UI refinement

## Approved scope

This milestone implements the user's follow-up UI request and approved AI drafting from published project sources. It supersedes Milestone 13's deterministic-only authoring and single-scroll reader, Milestone 8's original copy, Milestone 6's history-list exclusion, and the required Industry input in Milestone 3. Previous checkpoints remain historical; this milestone reopens acceptance for these changes.

Keep project ownership, published-only retrieval, human publication, document-removal tombstones, read-only project MCP credentials, and the existing source policy. Do not add unit/integration suites, OAuth, Firecrawl document import, background scheduling, or new source taxonomies.

## Handbook contract

- Generate automatically on first open or a changed source fingerprint, not on every read or download.
- Reuse the existing PostgreSQL `ProjectHandbook.snapshot` JSON column; schema version 2 includes the stored reader, contents, pages, evidence labels, citations, and optional explanatory diagrams. No database migration is needed.
- Use `GEMINI_MODEL` and the shared server-only model provider. Bound a generation call at 90 seconds, with no automatic model retries; reject a source corpus over 300,000 characters instead of silently truncating coverage.
- Validate generated structure and require every substantive block and figure to cite only supplied source keys. Require coverage of all inventoried reviewed sources. Reject unknown citations, missing coverage, empty blocks, and code fences. These checks establish provenance, not factual correctness: show an AI-draft notice and require human verification before important decisions.
- Send structure and enums in Gemini's native JSON schema, and enforce all string/array bounds with the original Zod schema before persistence. The combination of nested native bounds exceeded the provider's schema-complexity limit during live verification; removing native bounds does not remove local validation.
- Inventory published, human-reviewed entries with an uncached Sanity client; both each entry and its document must match the authorized project. Preserve exact `sourcePages`, source locations, excerpts, review dates, Sanity document/entry revisions, and source PDF links.
- Separate current sources from review-required sources, including expiration changes without a new source revision. Exclude removed sources. Recheck the fingerprint before commit. A 120-second project lock fails closed on Redis errors; timestamp-guarded writes prevent older workers overwriting newer runs or removal invalidation.
- Organize the AI draft by domain types/approaches, not one disconnected document chapter. Explain essential terms and supported components, relationships, resources, workflows, checks, exceptions, calculations, examples and limitations. Omit unsupported/inapplicable sections. Examples and recommendations are labeled separately from established requirements.
- Audience is not specified; report that input rather than invent a profession or expertise level. The supplied learning/revisiting purpose is used. Source document editions, original figures, application repositories and verified implementation revision ranges are absent from the current records: disclose that limitation; do not invent them.
- Optional process/relationship figures are source-backed illustrative diagrams, clearly labeled, with an enlarge control. Do not represent them as PDF extracts or real screenshots.
- Retain reviewed chapter/section projections for existing MCP readers; expose stored book page anchors and contents as additional read-only results. MCP never triggers generation.

## Reader and exports

Use the layout direction in the user's cable reference (`cable/docs/abc-handbook`): white A5 portrait paper on a quiet gray desk, serif chapter headings, readable body text, short pages, cover and chapter openings.

- Show one focused page at a time with visible page numbers, clickable chapter contents, previous/next buttons, arrow-key navigation and a page selector.
- Save local reading position by user, project and fingerprint. Presentation state is not server authorization.
- Show numbered source markers; reveal the source title, exact location/pages, explanation and source link on hover, keyboard focus or tap. Keep edition/revision details in the optional explorer. Explorer supports search and previous/next, displaying one reference at a time.
- Render PDF and portable HTML from the stored reader without asking AI again. PDF is A5 with linked contents, numbered references and a source appendix. Offline HTML inlines reading content, CSS, controls and diagrams; source links require internet access. The offline file is a snapshot and cannot revoke already-downloaded content after later source removal.
- Ship font assets and their license with the app, and trace fonts/reader assets into server deployments. Unsupported PDF glyphs or pages exceeding layout bounds fail instead of silently producing missing characters or clipping. Offline HTML remains available.

## App UI and API behavior

- Text-only Veyd branding; generic Research Chat, Documents and Handbook labels. Remove the bottom platform footer and regulatory-focus UI copy. Backend domain field names and established retrieval policy remain compatible.
- Show the current project's latest 50 previous chats in the sidebar and a mobile history panel. History API requires session authentication, project ownership and user-scoped conversation reads; other projects are never listed.
- Format user and AI messages as readable, safe Markdown, including paragraphs, headings, lists, links, code blocks and horizontally scrollable tables. Raw HTML and remote images are not rendered.
- Add Document has only document name and PDF input. The ingest request contains project ID, title and Blob URL; derive the legacy Sanity `industry` value from the server-authorized project name. Ignore client-supplied industry. Existing stored categories are not migrated.
- Simplify document rows: title and plain metadata, one PDF action, a compact menu for Studio/removal. Preserve extraction/publication states and errors without a wall of badges.
- Respond immediately to project selection and chat submission. Reconcile authoritative server responses. Keep cached document rows visible during refresh, cancel stale fetches and isolate caches by authenticated user/project. Do not optimistically invent extracted entries, generated token values, successful deletion or publication.
- Page content uses skeleton loaders; pending action buttons use circular loaders with retained labels and disabled repeat submission. Respect reduced motion.
- MCP token creation reads the actual `plaintextToken` response field. Show its copy control only in the creating session; support manual copy when Clipboard access fails. Never store plaintext tokens in persistent browser storage.

## Frontend API cache refinement

The user approved a minimal React Query refinement and explicitly restricted IEVO to a read-only reference. Its query-key and mutation-invalidation patterns informed the approach; no IEVO code, dependencies, authentication handling or UI components are copied or modified.

- Keep resource identity in `src/lib/query-keys.ts`: authenticated user, project and resource/detail ID. Do not add refresh counters, message counts or modal-open state to keys.
- Use one typed same-origin request helper in `src/lib/client-api.ts`, and resource query/mutation hooks in `src/hooks/use-app-queries.ts`. Forward query cancellation signals. Display safe application errors, not unstructured provider/proxy responses or secrets.
- Projects, documents and credential metadata are fresh for 60 seconds; previous-chat lists for 30 seconds. Reopening a fresh resource reuses its cache. Disable automatic retries and window-focus refetch; keep explicit refresh/retry controls.
- Saved-chat details and handbook metadata revalidate on mount. Do not display cached handbook pages before that mount's freshness check succeeds, or after a failed check. Only a fresh missing/stale result may start AI generation; downloads reuse stored content. Poll every three seconds only while generation is in progress and the read has no error.
- Update caches with authoritative mutation responses and invalidate only affected keys. Ingestion refreshes the original project's documents/handbook; chat completion refreshes its history/detail; token creation/revocation refreshes only its credentials. Removal invalidates documents/conversations and discards the cached handbook even on failure, because a partial removal may already have installed a tombstone.
- Clear and cancel the query client on authenticated-user changes/logout. Project selection cancels old project reads and clears local chat/upload state; never use another project's data as a placeholder. These measures supplement, not replace, server authorization.
- Preserve same-project document rows during refresh or transient failure; hide them on authorization/not-found errors. First-load content uses skeletons. Refresh/retry/mutation buttons retain their labels, disable repeat clicks and use circular loaders. Keep chat streaming, authentication and Blob transfers in their existing SDK lifecycles rather than caching a stream or file transfer as query data.
- Keep a newly issued plaintext token only in the current open modal's local state, never query/mutation-cache data or persistent storage. Discard it on close, project/user change or revocation. Cache only credential metadata.

Primary references: [TanStack Query keys](https://tanstack.com/query/v5/docs/framework/react/guides/query-keys), [query cancellation](https://tanstack.com/query/v5/docs/framework/react/guides/query-cancellation), and [mutation invalidation](https://tanstack.com/query/v5/docs/framework/react/guides/invalidations-from-mutations). Accessed 2026-10-03. No new dependency or environment variable is required for this refinement.

## Upload bug follow-up

The user reported a Vercel Blob `400`. A minimal request reproduced: `Cannot use public access on a private store`. Change the browser upload access to `private` and explicitly set PDF content type. Verify private upload and authenticated server read, then remove temporary diagnostic objects. Do not change the user's store visibility or secrets.

## Dependencies and reproduction

New runtime dependencies: `react-markdown`, `remark-gfm`, `@pdf-lib/fontkit`. Existing Gemini, Sanity, PostgreSQL, Blob and Upstash services remain required. `.env.example` documents roles; no new environment variable is required and `.env` is preserved.

Reproduce with `pnpm install --frozen-lockfile`, `pnpm build`, then `pnpm start`. The app's download controls call the authorized `handbook.pdf` and `handbook.html` endpoints. Maintain authoring in `src/lib/handbook/generator.ts`, data validation in `schema.ts`, reader styling/controls in `reader.css` and `offline-reader.js`, and the React reader in `src/components/project-book-view.tsx`.

Font source: [Noto Sans upstream](https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf/NotoSans), with the vendored SIL Open Font License. Accessed 2026-10-03. Vercel access contract: [private storage](https://vercel.com/docs/vercel-blob/private-storage). OpenAI connection guidance: [Codex MCP](https://developers.openai.com/codex/mcp), [ChatGPT connection](https://developers.openai.com/plugins/deploy/connect-chatgpt), [OAuth](https://developers.openai.com/plugins/build/auth). Accessed 2026-10-03. Existing project-bound bearer tokens work with clients supporting HTTP bearer headers; ChatGPT private custom connections need OAuth, which is outside this milestone.

Gemini's structured-output contract supports a subset of JSON Schema and warns about large/complex schemas: [official structured-output documentation](https://ai.google.dev/gemini-api/docs/structured-output). Accessed 2026-10-03.

## Using the application

1. **Create a project:** choose **Add** beside Project in the desktop sidebar, enter a name, and choose **Create Project**. On mobile, open the project selector and choose **Add project…**. Select a project before uploading or researching; each has its own documents, chats, handbook and MCP credentials.
2. **Add documents:** open **Documents**, choose a PDF, enter its name, then choose **Add document**. Extraction creates drafts. Review and publish entries in Sanity Studio before they become knowledge-base or handbook sources. Limits remain 10 MB and 100 pages.
3. **Use Firecrawl through research:** ask Research Chat to find supporting sources or answer a question. The existing flow searches the project's published knowledge first and uses official-first Firecrawl web research when needed. Web results are citations, not imported documents. There is no Firecrawl document-import flow in this milestone; download a relevant PDF and add/review it yourself.
4. **Resume research:** open **Previous chats** in the sidebar or the mobile history control. The list contains only conversations belonging to the selected project and authenticated user.
5. **Read the handbook:** open **Handbook** after publishing sources. A missing or changed book is drafted automatically; later reads and exports reuse the stored pages. A failed AI call offers retry. Contents, sidebar shortcuts, references and the page selector support revisiting the book. PDF and offline HTML downloads do not invoke AI.
6. **Connect an MCP client:** choose **Connect MCP** while the intended project is selected, name a token, generate it and copy it immediately. Configure the client's Streamable HTTP server with the displayed endpoint and an `Authorization: Bearer` credential using the client's secret-management mechanism. Use a publicly reachable HTTPS deployment for remote clients. Do not commit tokens, put them in URLs or share them in screenshots. Codex supports HTTP bearer configuration; follow the linked official MCP guide. ChatGPT private custom connections require OAuth, which this application does not yet implement. These tools retrieve published project content and saved handbook pages; they cannot upload, publish or remove documents.

## Continuing with another coding model

Use this prompt for this milestone only:

> Read AGENTS.md, docs/README.md, docs/agent-implementation-protocol.md, .agents/skills/project-reader-ui/SKILL.md and docs/14-project-reader-and-ui-refinement.md completely. Inspect the current changes and checkpoint record. Continue only Milestone 14's incomplete checks or repairs; preserve existing work and secrets. Ask before unresolved product decisions or changing the configured model. Do not add unit/integration suites. Record actual evidence and remaining limitations, then stop for review.

## Manual checkpoint

- [ ] Create/switch two projects; lists, conversations, handbooks and MCP remain isolated.
- [ ] Upload a valid PDF with name/file only; confirm private ingress and unchanged human publication boundary. Invalid size/type errors remain actionable.
- [ ] Observe button spinners and page skeletons, including reduced-motion and error/retry states.
- [ ] Open previous chats on desktop/mobile; verify both user and AI formatting, tables, long text and safe links.
- [x] Generate a real project book; verify citation coverage and explanations against the published reviewed extracts. No calculations apply to the available entry; full original-document/legal review remains a separate limit below.
- [x] Navigate book with contents, buttons, keyboard and selector; reload and resume; inspect desktop/mobile at 320–390 px and desktop width.
- [x] Open citation on hover/focus/tap, search the reference explorer, enlarge a diagram where applicable.
- [x] Export and visually inspect A5 PDF and offline HTML; verify contents destinations, page numbers, references, source links and offline reading controls.
- [ ] Reopen without source changes: no AI generation; change/publish/remove a source: stale/removed content unavailable and refresh produces the new book.
- [ ] Generate an MCP token and copy it; close/reopen: only token hint remains. Revoke and confirm client rejection.
- [x] Verify cached repeat navigation, refresh/error/retry, project isolation, one-time token cache exclusion and handbook freshness in a non-mutating desktop/mobile browser check. This frontend checkpoint does not replace the live authorization and mutation checks above.
- [x] Run TypeScript checks, `pnpm build` and `pnpm --dir sanity build`; report actual checks and remaining limits, then stop for review.

## Checkpoint record

Date: 2026-10-03. Baseline: `e1578b4d40c4b72a854a7a5a8552a07e2e59fbdd`. Implementation revision: the commit containing this checkpoint; resolve it with `git log -1 --format=%H -- docs/14-project-reader-and-ui-refinement.md`. Reviewer: coding agent; build verification passed, live acceptance and user review remain pending. This is not a deployed release.

Observed evidence:

- Application production builds and non-incremental TypeScript checks passed. Sanity Studio build passed. Skill metadata validation and `git diff --check` passed. No unit/integration suites were created.
- Real private Blob upload and authenticated server read passed after reproducing the public/private access mismatch. The temporary diagnostic Blob object was deleted; no user document was removed.
- Read-only source inventory found one eligible published document and one reviewed entry in Food Safety, including source pages 4, 5 and 8. No source documents or entries were changed during generation checks.
- Non-mutating desktop/mobile browser fixtures verified two formatted chat roles, rendered tables, blocked raw-HTML execution, previous-chat visibility, name/file-only upload presentation, removed platform footer, token-button spinner, one-time token copy and token hiding on reopen. Fixtures verify UI behavior, not real authentication, token issuance or authorization rejection.
- Desktop/mobile React fixtures and the actual offline export exercised book controls, citation focus/tap, reference search, diagram enlargement and saved position. The final stored book has 13 reader pages; the PDF has 14 A5 pages (419.53 × 595.28 points), including a source appendix. All PDF pages were rendered and visually inspected; contents and source-reference link destinations are valid. The actual export has one visible reading page, no horizontal overflow at 320–390 px, and no meaningful internal overflow at 390 px after correcting mobile spacing and default figure margins. Narrower screens retain vertical scrolling when needed to preserve readable text.
- A mobile project-selector bug was reproduced: the desktop outside-click handler closed the mobile menu before its selection click. Including both menu containers fixed selection; non-mutating fixtures confirmed the Civil selection clears Food documents and history. This is UI evidence, not authenticated two-project authorization evidence.
- Server build traces include both Noto Sans fonts and the offline reader CSS/JavaScript.
- The cache refinement's controlled development-browser comparison used the same flow before/after: Documents → Research Chat → Documents, then open/close Connect MCP twice. Intercepted reads fell from 5 to 2 for projects, 5 to 2 for documents, and 2 to 1 for credentials; history remained 2. These counts include development mount/replay requests, not a production latency or bandwidth benchmark. All API calls were fixtures; no live records were changed.
- A subsequent desktop/mobile fixture batch passed 12 checks: cached rows during refresh; transient error/retry; cached-row hiding on access denial; Food/Civil switch with skeletons and separate history; pending token button/copy visibility with plaintext absent from query and mutation data; token hiding on reopen; response-driven revocation; handbook freshness denial without AI generation; formatted saved-chat hydration; document-removal cache invalidation; reduced-motion mobile skeletons; and no horizontal overflow on the 390 px document page. The four desktop/mobile screenshots were visually inspected and the browser recorded no runtime errors. This does not establish live token revocation, server isolation, source removal or extraction correctness.
- After the cache refinement, non-incremental TypeScript checking and `pnpm build` passed again. The isolated preview was stopped and its temporary generated-build copy removed; the user's development server was not stopped. IEVO and `.env` were not modified, and no dependency or test suite was added for the cache changes.
- Commit preparation repeated `pnpm exec tsc --noEmit --incremental false`, `pnpm build`, `pnpm --dir sanity exec tsc --noEmit` and `pnpm --dir sanity build`; all passed. No compilation error was reproduced. Studio's dependency-range warning was fixed by aligning its declared `styled-components` range from `^6.1.13` to the required `^6.1.15`; the locked/installed `6.5.3` version did not change. Offline frozen-lockfile checks passed for both manifests. Existing transitive dependency peer/deprecation warnings and Sanity's major-version advisory do not prevent these builds; no major-version upgrade was attempted. Pending text files were scanned for embedded local credentials, with no findings. `.env` and generated build outputs are excluded from the commit.
- A production-preview route initially failed while a concurrent development server shared `.next` output. Rechecking with an isolated generated-build copy resolved that local verification conflict. Agent-owned preview servers were stopped and the temporary generated-build copies removed; the user's existing development servers were left running.

Live AI generation now passes after the user added prepaid credits. Earlier attempts hit quota/high demand/depleted credits. The originally supplied `-list` IDs returned model-not-found; the user approved trying the corresponding `-lite` IDs in order with process-only overrides. Both `gemini-3.1-flash-lite` and `gemini-3.5-flash-lite` successfully generated structured output after the native schema-complexity repair. `gemini-2.5-flash-lite` reported that it is unavailable to new users and was not retried after that result.

The final Food Safety book is stored as ready, drafted with `gemini-3.5-flash-lite`, generator `2.0.4`, from one published PDF and one reviewed entry. Read and generation calls with unchanged sources returned the same edition timestamp rather than invoking AI again. Draft review caught an unsupported legal-validity inference and an unsupported either/or control substitution in earlier editions; those drafts were regenerated with stricter source-fidelity instructions. The final wording and numbered references were compared with the supplied reviewed record. There were no applicable formulas. This is not an independent legal review or a review of the entire original PDF. Missing editions, original figures, target audience and implementation evidence remain visible limitations.

`.env`, credentials and the configured default model remain unchanged (`gemini-3.8-flash`). The successful Flash-Lite overrides applied only to verification processes; future generation in the normally started app still uses its configured model. No source documents or published entries were edited.

Still required before acceptance: live authenticated two-project isolation, source-change/publication/removal refresh, full upload/extraction validation, reduced-motion/error-state end-to-end checks, and live MCP credential issuance/revocation. Do not treat earlier milestone acceptance or UI fixtures as passing these checks. No deployment was performed.

## Change inventory

### Handbook drafting repair (2026-10-04)

Final authenticated browser verification returned `ready` with 35 pages and 15 citations, and the existing reader loaded with zero `/handbook/generate` requests. Application type and isolated production builds passed; Studio build also passed.

The configured model returned a schema-invalid draft for a project with five published reviewed entries: figure steps exceeded 70 characters and one block contained more than five list items. The drafting instructions now explicitly state the existing string and array bounds, and tell the model to split long explanations/lists without dropping evidence. Local validation, citation coverage, source isolation, the 90-second timeout and zero automatic model retries remain unchanged. Schema-generation failures return a safe `UPSTREAM_FAILURE` message; server diagnostics contain only validation paths/codes, never generated text. Generator version: `2.0.5`; no model, environment or dependency change.

An in-memory live drafting check produced 23 pages from all five sources after the prompt correction. The owner-checked generation service subsequently saved a 19-page edition with all five citations and generator `2.0.5`; a fresh read returned `ready`, and a repeat generation call reused it. During live review the project's published corpus grew to 15 entries; its old edition correctly became stale, and regeneration saved a 35-page edition with all 15 citations. This verifies structural validation, source-key coverage, source-change invalidation and persistence, not independent factual verification of the AI explanations. The verification agent did not change published source records or the configured model.

Comparison base: `e1578b4d40c4b72a854a7a5a8552a07e2e59fbdd`. The implementation and this checkpoint are committed together; resolve the ending revision with the command above and use `git diff --name-status <baseline> <implementation-revision>` to reproduce the added/modified inventory. No deployment is claimed.

- **Added:** this milestone, `.agents/skills/project-reader-ui/SKILL.md`; project conversation-list and `handbook.html` API routes; `chat-history`, `chat-markdown`, `document-row`, `handbook-page`, `project-book-view` and `ui/skeleton` components; shared `client-api.ts`, `query-keys.ts` and `use-app-queries.ts`; handbook `generator.ts`, `html.ts`, `reader.css`, `offline-reader.js`; licensed Noto Sans font assets.
- **Modified:** application and Studio dependency manifests/lockfiles, `.env.example`, `AGENTS.md`, docs index and deployment asset tracing; app metadata, page wrappers, shell/styles, authentication/project/removal/MCP-token UI, user-scoped query provider; ingest, handbook generation/PDF routes; handbook compiler, schema/types, source fingerprints, leases, service and PDF renderer; read-only MCP handbook projections.
- **Not changed:** `.env` secrets/default model, published source documents/rules, database schema, existing review/publication boundary and external deployment.
