---
version: 1
mode: "Read"
slug: "src-app-presentation-page-tsx"
primary_target: "src/app/presentation/page.tsx"
related_targets: ["src/app/presentation/presentation.tsx","src/app/presentation/presentation.module.css","src/app/presentation/slides.ts","public/presentation/architecture.svg","public/presentation/architecture.png","public/presentation/architecture.png.provenance.json"]
---

# Public Veyd presentation

## MODE
Read. A hackathon viewer or judge understands Veyd, the author's motivation, the application workflow and Sanity's role by advancing through authored slides.

## THESIS
Make Veyd understandable as a source-to-knowledge workflow, beginning with the product itself and then answering one question per slide.

## OWN-WORLD
Reuse the handbook's paper, cool gray desk, dark ink and serif headings. The presentation's geometry, larger type scale, architecture diagram and DEV × Sanity co-branding are route-specific expressions of the existing world. Veyd and DEV × Sanity are text wordmarks, not an endorsement claim. Root `DESIGN.md`, its sidecar and `PRODUCT.md` remain valid; this refinement does not replace the application-wide visual system.

## STORY
The 13-slide story follows `docs/devto-post-draft.md`: Veyd hero, definition, why the author built it, application architecture, how Sanity is used, project context, PDF ingestion, research chat, confirmed chat import, handbook, project MCP, saved progress and the app entry points. Keep the answers short and describe implemented capabilities. Sanity owns the source-and-review foundation; Gemini drafts and answers; Firecrawl discovers public sources; PostgreSQL keeps project state. The custom read-only MCP endpoint is Veyd's endpoint, not Sanity Context. Close with “Open Veyd” linking to `/chat` and “Open Sanity Studio” linking to the supplied `https://sanity-zeta-six.vercel.app/` URL in a new tab.

## FIRST VIEWPORT
The hero is a large Georgia “Veyd”, followed by “One knowledge base to research, learn, and build across domains.” and the teal line “Research. Learn. Reuse.” The page title is “Veyd: one place to research, learn, and build across domains”. A compact masthead carries the Veyd first-slide button and DEV × Sanity challenge link. Previous/next, contents, native slide selection and fullscreen controls make the paper behave like a presentation. The hero is the default entry; a valid slide hash or saved local position can resume elsewhere.

## FORM
The user pinned a viewport-filling presentation stage and the largest fitting strict 16:9 landscape canvas at every device size, including browser fullscreen. Preserve that geometry without a maximum-width cap or portrait reflow. Other viewport ratios leave cool desk margins. Portrait phones deliberately show a miniature landscape slide; full-size navigation stays outside the paper. The small content text is an approved presentation-format tradeoff, not a claim of phone-size reading comfort.

This is the user's code-first request with a precise subsequent layout/content refinement. No comp or concept seed was requested. Static public content, optional fullscreen, keyboard navigation and local slide position remain in scope; the deck does not mount AppShell, import server clients or call project APIs.

The canonical public route is `/presentation`. Legacy `/demo` redirects there, but that redirect does not preserve the old slide hash. Slide-ID deep links work on `/presentation`, and the existing local-position key is retained.

## FINISH
unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Observed implementation and review

Recorded 2026-10-04 against the final `src/app/presentation/` source, native architecture asset and route/title/architecture refinement. The fresh independent reviewer `/root/impeccable_presentation_route_reviewer` returned **SHIP**. Its sole requested fix, minimum (`14px`) text and (`44px`) height for both closing links on narrow screens, is resolved; no other fixes remain. Typography, paper/desk material, composition, Sanity's central source-and-review role, supporting services, navigation and the strict landscape adaptation on portrait phones are covered by the final review.

### Colors

The CSS module owns reader ink (`--demo-ink: #172333`), supporting text (`--demo-muted: #475a68`), interaction teal (`--demo-accent: #087f87`) and Sanity red (`--demo-sanity: #b92d23`). The retained `--demo-*` names are implementation identifiers, not the public route. Paper is near-white (`#fcfdfd`) on a cool desk (`#edf0f2`). Workflow dividers use (`#b9c9ce`); pale architecture blocks and quiet control hover use (`#edf3f4`). The SVG repeats these values, with Sanity as the red central block and white text. Dark next/closing actions use reader ink and hover to (`#2d4552`). The Studio link uses interaction teal. These are scoped presentation values, not changes to global tokens.

### Typography

Headings use Georgia with Times New Roman/serif fallbacks. Prose, branding and controls use the application's `--font-sans` (Figtree), with Arial/sans-serif fallbacks. The hero title is (`clamp(62px, 14cqw, 220px)`), line-height (`0.96`); its answer is (`clamp(20px, 3.7cqw, 67px)`), line-height (`1.22`), maximum measure (`26ch`). The hero's teal line is (`clamp(13px, 1.8cqw, 31px)`), weight (`700`).

Standard questions use (`clamp(22px, 4.9cqw, 88px)`), line-height (`1.1`), maximum measure (`18ch`); answers use (`clamp(14px, 2.55cqw, 46px)`), line-height (`1.31`), maximum measure (`43ch`). Point/workflow headings use (`clamp(13px, 1.95cqw, 35px)`), weight (`700`); their supporting copy uses (`clamp(11px, 1.6cqw, 29px)`), line-height (`1.38`). Questions and hero copy balance wrapping; ordinary answers and supporting copy use pretty wrapping.

At widths up to (`899px`), standard slide text uses the corresponding pure `cqw` values without minimum-size floors. At widths up to (`599px`), hero title/answer/line also use pure (`14cqw` / `3.7cqw` / `1.8cqw`). The SVG has its own Arial text and scales as one diagram. This keeps explanatory content within the landscape canvas instead of introducing a portrait layout. Navigation and the two closing links retain pixel-based minimum sizes.

### Layout

The fixed stage fills the viewport (`position: fixed; inset: 0; height: 100dvh; min-height: 100dvh; overflow: clip`) and centers the paper. Canvas width is exactly (`min(100vw, 177.77777778dvh)`) with (`aspect-ratio: 16 / 9`), including fullscreen. There is no (`1280px`) cap. Paper rows are (`10% minmax(0, 1fr) 10%`); the middle content area is vertically centered with horizontal padding (`7.2%`), while masthead and toolbar use (`5.4%`).

Flow and factual points remain horizontal: three equal columns, or two columns with a (`92%`) maximum width. The architecture is a native SVG (`1200×340` viewBox), rendered at (`width: 100%; height: auto`) beneath “Sanity connects source PDFs and human review to reusable project knowledge.” Its upper row connects the Veyd app → red Sanity core → reused knowledge. The wider Sanity block names Content Lake, original PDFs/structured entries, Studio review and published project-scoped GROQ reads. A divided lower row identifies Gemini + Firecrawl, PostgreSQL + Prisma, and private Blob + Upstash with their implemented responsibilities. It is an authored explanatory diagram with descriptive alt text, not a product screenshot. None of these become a vertically stacked mobile page.

At widths up to (`899px`), the toolbar is positioned below the paper (`top: calc(100% + 16px)`, horizontal padding `3%`) when the viewport ratio is at or below 16:9. On wider-ratio narrow landscape viewports, it sits within the paper's bottom row. Previous/next/fullscreen labels disappear by (`1100px`); contents becomes an icon by (`899px`); the slide-count label disappears by (`599px`). The native selector and icon controls remain available and at least (`44px`) high. Both closing links retain a minimum font size (`14px`) and height (`44px`) below (`899px`); they remain in a horizontal action row.

### Elevation & Depth

Paper and architecture blocks are flat, without paper shadows or decorative cards. Tonal separation and fine horizontal rules carry structure. Only quick contents receives an overlay shadow (`0 16px 45px #0f2d3540`); its white surface appears above the toolbar.

### Shapes

The slide and SVG architecture blocks are square. Controls, selector, primary closing link and fullscreen status use gently curved corners (`8px`); the Studio action is an underlined text link. The contents surface uses (`12px`) and its rows (`6px`). The DEV text strip uses a small (`3px`) curve. Keep these route-scoped shapes out of global component rules.

### Components

The dark Next button advances; Previous and fullscreen use quiet transparent controls. Boundary buttons are disabled with muted text, and disabled Next becomes pale. Hover changes the surface; active controls move down (`1px`). Interactive keyboard focus is teal (`3px`, offset `3px`). The skip link reveals on focus; slide changes announce their number and title through a status region.

The closing action row pairs the dark “Open Veyd” link with the underlined teal “Open Sanity Studio” link. The Studio URL is the supplied external deployment; the link opens a new tab with `noopener noreferrer` and a screen-reader announcement. At narrow widths, Open Veyd uses (`max(14px, 2.1cqw)`) text and Studio uses (`max(14px, 1.8cqw)`); both have (`min-height: 44px`). This resolves the final review's closing-link issue without changing slide geometry.

Quick contents is a numbered list with the current slide marked by text state and a check. It has two columns by default and one below (`599px`), scrolls internally, and stays bounded by the viewport. At narrow portrait ratios its maximum height is (`48dvh`). Selecting a contents item closes it and focuses the slide heading; Escape or Close returns focus to Contents. The native selector supplies direct slide choice.

Navigation supports arrows, PageUp/PageDown and Home/End, ignores modified keys and editable controls, and suspends slide shortcuts while contents is open. Navigation updates the slide-ID hash and stores only that ID under `veyd:public-demo:slide:v1`; valid hashes take precedence over local position, and unavailable storage is tolerated. Fullscreen targets the presentation stage, follows the browser's actual fullscreen state and reports unavailable/failed requests honestly. Reduced-motion preference removes transitions and smooth scrolling. No autoplay is present.

### Final evidence and limits

The current final review evidence in `.impeccable/review/` is `presentation-architecture-cdp.png`, `presentation-reviewed-fullscreen.png`, `presentation-closing-desktop.png`, `presentation-closing-mobile.png`, `demo-redesign-desktop.png`, `demo-redesign-mobile.png` and `demo-redesign-mobile-contents.png`. The retained `demo-*` filenames are QA artifact names. Earlier architecture and closing capture variants are superseded. These ignored QA captures are not shipping raster assets.

The presentation displays `public/presentation/architecture.svg`. The companion `architecture.png` is a Chromium render of that code-authored SVG at (`1200×340`), provided for reuse with the post. `architecture.png.provenance.json` records the source, authoring date (`2026-10-04`), implementation references and reproducible render method; provenance is also embedded in the PNG. The completed asset scan passed with one raster and zero missing provenance records. No AI-generated imagery or external font/assets are involved in this diagram.

The completed checkpoint passed 91 manual browser layout checks: all 13 slides at (`1920×1080`, `1440×900`, `1280×720`, `1024×768`, `844×390`, `390×844`, `320×568`). Geometry, slide-body fit, viewport-bound controls and absence of document overflow or unexpected internal scrolling passed. Buttons, native selector, contents, boundary states, arrows/Home/End, local restore, deep links and real fullscreen enter/exit passed. No page errors or project API calls were observed. The shared root authentication-session check may still occur; the deck does not depend on it.

Final non-incremental TypeScript checking and the production Next.js build passed. `/presentation` is static (`5.11 kB` route, `99.7 kB` first-load JavaScript). The 91 layout checks and navigation/fullscreen/local-position checks passed for the current refinement, with no runtime errors or project API calls. New-route deep links work; the legacy `/demo` redirect's hash limitation remains explicit above. This documentation pass records the completed checks without rerunning the browser, detector or build.

No new dependencies, environment variables, backend calls or unit/integration suites were added. The authored SVG and its provenanced PNG companion are the scoped architecture assets. This review approves the public presentation; it does not certify backend behavior, Safari/iOS fullscreen or physical-device/projector behavior. User acceptance, deployment and hackathon submission remain outside this checkpoint. Global design tokens and identity are unchanged; only the two route-name narrative references in `DESIGN.md` and their matching sidecar strings are updated to `/presentation`.
