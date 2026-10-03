---
version: 1
slug: "src-app-demo-page-tsx"
primary_target: "src/app/demo/page.tsx"
related_targets: ["src/app/demo/presentation.tsx","src/app/demo/demo.module.css","src/app/demo/slides.ts"]
---

# Public Veyd presentation

## THESIS
Make Veyd understandable as a source-to-knowledge workflow, one question per slide.

## OWN-WORLD
Reuse the handbook's white paper, cool gray desk and serif headings. Veyd and DEV × Sanity are text wordmarks, not an endorsement claim.

## STORY
Introduce the product and audience; show each implemented feature; separate Sanity, AI and external research responsibilities; close with the live app.

## FIRST VIEWPORT
A large “What is Veyd?” question, a short answer and the source → review → reuse sequence. Previous/next, contents and slide selection make the book behave like a presentation.

## FORM
User-pinned standard 16:9 landscape on desktop; readable vertical adaptation on mobile. Code-first, no new visual identity or concept seed. Static public content, optional fullscreen, keyboard navigation, local reading position.

## FINISH
unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Observed implementation and review

Recorded 2026-10-03 after the independent finish review returned **ship** with no material fixes. All six final captures were valid review evidence: `demo-desktop.png`, `demo-sanity-desktop.png`, `demo-closing-desktop.png`, `demo-mobile.png`, `demo-contents-mobile.png` and `demo-mobile-320.png` in `.impeccable/review/`. `demo-browser-results.json` records 91 passed browser checks. These captures are QA evidence; the presentation ships no raster assets.

The slide is white paper on a cool desk (`#edf0f2`), with reader ink (`#172333`), muted supporting text (`#536171`) and deep teal interaction/focus (`#087f87`). Veyd and DEV × Sanity are text branding; the DEV strip uses reader ink and Sanity uses red (`#b92d23`). These colors and co-branding are scoped to this presentation.

Desktop paper uses 16:9 geometry within a maximum width (1280px), constrained by viewport height on shorter desktop screens. Each slide presents one Georgia question (`clamp(36px, 4.7cqw, 64px)`) and a large answer (`clamp(23px, 2.5cqw, 34px)`), followed by two or three factual points or a numbered source/review/reuse flow. Below 900px, the page adapts vertically; below 600px, points and flow stack, questions are (34px), and answers are (23px). Keep this larger scale within `/demo`.

Navigation controls have a minimum height (44px), visible teal focus (3px, offset 3px), disabled boundaries, a native selector and quick contents. Keyboard navigation, slide deep links, local reading position and fullscreen status were checked. No new palette, imagery system or application-wide slide rules were introduced. Shared observed conventions are recorded in root `DESIGN.md` and `.impeccable/design.json`.
