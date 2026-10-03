# Milestone 16 — Public demo presentation

## Approved scope

Create `/demo`, a public read-only presentation for the [DEV × Sanity Challenge](https://dev.to/challenges/sanity-2026-09-16). The user approved code-first implementation, handbook aesthetics, larger text, one question at a time, Veyd + DEV × Sanity branding, and standard presentation page format.

This milestone uses the dashboard/reader UI skills for visual and accessibility conventions. It does not replace the authenticated application or add Sanity Context, Knowledge Bases, Agent Actions, App SDK or Sanity Workflows. The public deck must distinguish Sanity's content foundation from Gemini AI and Firecrawl research. No claim of Path One eligibility is made.

## Technical contract

- A static Next.js `/demo` page with its own metadata and a client presentation component. Do not mount AppShell, import server clients or read project APIs.
- Authenticated app and API authorization remain unchanged. The root query provider may still check the current authentication session; the deck does not depend on that result.
- Maintainable typed slide content stored in the repository, not generated on every visit.
- Exactly one question/slide visible at a time. Use large serif questions, short plain-language answers and useful workflow relationships rather than dense tables or decorative cards.
- Standard 16:9 landscape paper on desktop. Narrow screens adapt vertically without reducing text to miniature slide scale. Preserve the white-paper/cool-desk handbook visual language.
- Previous/next buttons, arrow keys, Home/End, native slide selector and quick contents. Ignore presentation keys while users edit controls. Deep-link slide IDs and save only the local slide ID; gracefully tolerate unavailable storage.
- Optional browser fullscreen with honest error handling. No autoplay, new dependencies, paid API calls or writes to project knowledge.
- Text Veyd and DEV × Sanity branding; link the challenge brief without implying endorsement or award status. A final “Open Veyd” link uses the existing authenticated app entry point.
- Explain projects, PDF ingestion, human publication, research/citations, confirmed chat import, handbooks/exports, history, MCP and removal. Identify illustrative Food/Civil examples explicitly.
- Do not publish account credentials, actual project content, tokens, secret configuration or unsupported marketing statistics.

## Manual checkpoint

- [x] Open `/demo` anonymously and confirm no project API reads or writes.
- [x] Verify every slide against implemented code; distinguish the custom MCP server from Sanity Context.
- [x] Navigate with buttons, selector, contents, arrow keys and Home/End; verify boundaries, focus, deep links and saved position.
- [x] Exercise fullscreen and reduced motion; check keyboard access and accessible control names.
- [x] Inspect desktop 16:9 layout and 390/320 px mobile layouts, including long slides and contents; verify no horizontal clipping.
- [x] Run non-incremental TypeScript checking, a production build and whitespace checks. Add no unit/integration suites.
- [x] Complete the independent visual review and record observed design conventions without imposing this slide layout on the rest of the app.

## Dependencies and environment

No new dependencies or environment variables. Existing Next.js/React and Lucide icons suffice. No `.env` or `.env.example` changes are needed.

## Checkpoint record

Date: 2026-10-03. Initial feature-behavior baseline: `87a977d`; the existing broader UI work was independently committed as `87c7d09` while this feature was being implemented. This milestone does not modify those application components. Implementation is the working-tree addition of `/demo`; browser/build verification, independent finish review and design recording passed. User acceptance remains open. No deployment, submission or commit is implied by this checkpoint.

Observed verification:

- Non-incremental TypeScript checking passed. The final Next.js production build passed and prerendered `/demo` as a static route (6.1 kB route, 101 kB first-load JavaScript). The build used a temporary isolated `.next-demo-qa` output with the existing generated Prisma client; it did not stop the user's development server or change `next.config.mjs`. This is not a fresh Prisma-generation or deployment check.
- The real anonymous local `/demo` returned 200. A disposable Playwright browser, without auth fixtures or private data, passed 91 checks. The public deck made only shared `GET /api/auth/get-session` calls; no project API reads or writes were observed. Browser runtime-error list was empty.
- All 15 slides retained 16:9 geometry and fitting content at 1440×900, 1280×720 and 1024×768 desktop viewports. All 15 had no horizontal overflow at 390 px; the longer citation page was additionally checked at 320 px. Six final cover/Sanity/closing/mobile/contents captures were opened and visually inspected. Mobile uses readable vertical pages rather than miniature landscape text.
- Buttons, native selector, contents with heading focus, Home/End and arrow navigation passed. First/last disabled states, deep links, locally restored reading position, real browser fullscreen and an unavailable-fullscreen message passed. Browser checks used reduced-motion preference. The local viewport-fit failure on the closing slide was corrected by shortening its copy; final checks passed.
- The hookless UI detector ran once on the four demo source files and returned no findings. No raster assets, new dependencies, environment changes, unit/integration suites, credentials or project-data mutations were added.
- A fresh-context independent visual reviewer returned **ship** with the five required review sections, valid evidence for all six captures and no material fixes. It confirmed typography, paper/desk style, branding, readable mobile adaptation, navigation, closing action and the separation of source/AI responsibilities. This is approval of the presentation, not certification of backend behavior.
- The isolated verification build was removed after successful checks, and Next's temporary `tsconfig.json` changes were restored to the existing committed configuration. Source and QA evidence remain; the user's development server was not stopped.
- A separate documentation pass recorded observed incumbent tokens in root `DESIGN.md`, nine actual primitive previews in `.impeccable/design.json` (schema version 2), and presentation-specific facts in its surface brief. JSON parsing, canonical section order, whitespace and FINISH preservation passed. It introduced no new application-wide identity or code changes.

Limits: this verifies the presentation, not every live backend capability it describes. Prior milestones retain their live-service acceptance limits. No physical projector, assistive-technology audit, cross-browser Safari/iOS fullscreen verification, offline deck export, deployment or hackathon submission is claimed.

## Feature-claim evidence

The deck is authored explanatory content, not a snapshot of a user's knowledge base. File locations below were verified against the implementation on 2026-10-03; changes after this baseline can move line numbers. Food/Civil projects are explicitly illustrative. The [challenge brief](https://dev.to/challenges/sanity-2026-09-16) was read on 2026-10-03 for audience/branding and the distinction between Sanity Context MCP and this app's custom endpoint; no challenge eligibility is claimed.

| Claim | Verified implementation location |
| --- | --- |
| Project ownership/context | `src/lib/projects/service.ts:76`; `src/lib/sanity/published-queries.ts:25` |
| PDF limits and original asset | `src/lib/ingestion/validator.ts:9`; `src/lib/ingestion/service.ts:182` |
| AI creates draft entries, human review | `src/lib/ingestion/service.ts:252`; `sanity/schemaTypes/complianceRule.ts:223` |
| Published Sanity-first retrieval and cited pages | `src/lib/chat/tools.ts:53`, `:89`, `:141`; `src/lib/sanity/clients.ts:22` |
| Confirmed project import; Firecrawl PDF parsing | `src/lib/chat-files/service.ts:92`, `:270`; `src/lib/chat-files/firecrawl-pdf.ts:203` |
| Saved citations, including removal origins | `src/lib/conversations/service.ts:91`, `:116` |
| Stored handbook, unchanged-source reuse, removal invalidation | `src/lib/handbook/service.ts:103`, `:144`, `:231`, `:362` |
| Reader progress and downloadable editions | `src/components/project-book-view.tsx:124`, `:223` |
| Saved conversations | `src/components/chat-history.tsx:59`; Milestone 6 |
| Custom project-scoped MCP | `src/lib/mcp/tools.ts:25`; `src/app/api/mcp/route.ts:152`; Milestones 7/11 |
| Document/derived-rule removal | `src/lib/tombstones/remover.ts:198`, `:221`, `:262` |
| Sanity schema/source structure | `sanity/schemaTypes/complianceRule.ts:4`, `:133`; `src/lib/sanity/published-queries.ts:25` |

## Change inventory

- Added `src/app/demo/page.tsx`, `presentation.tsx`, `slides.ts`, `demo.module.css`; this milestone; minimal confirmed `PRODUCT.md`; observed `DESIGN.md`/design sidecar; code-first UI configuration and a scoped surface brief.
- Modified only the docs milestone index outside the new presentation files. Generated build/type configuration adjustments are temporary verification output, not intended product changes.
- Design documentation records observed conventions after the finish review. Presentation geometry and DEV × Sanity co-branding stay scoped to `/demo`.
