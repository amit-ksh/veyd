---
name: Veyd
description: Observed application and handbook visual conventions.
colors:
  ink: "#020618"
  action-ink: "#020617"
  action-hover: "#1e293b"
  paper: "#ffffff"
  desk: "#f8fafc"
  surface-muted: "#f1f5f9"
  text-muted: "#64748b"
  border: "#e2e8f0"
  border-strong: "#cbd5e1"
  cyan: "#00c9d2"
  cyan-hover: "#00b0b8"
  cyan-light: "#e6fafb"
  reader-ink: "#172333"
  reader-link: "#087f87"
  auth-blue: "#324c6e"
  auth-blue-hover: "#26394f"
typography:
  title:
    fontFamily: "Figtree, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: "32px"
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Figtree, sans-serif"
    fontSize: "14px"
    lineHeight: "20px"
  label:
    fontFamily: "Figtree, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "16px"
  reader-headline:
    fontFamily: "Georgia, serif"
    fontSize: "clamp(24px, 6cqw, 34px)"
    fontWeight: 400
    lineHeight: 1.15
  reader-body:
    fontFamily: "Arial, sans-serif"
    fontSize: "15px"
    lineHeight: 1.75
rounded:
  lg: "8px"
  xl: "12px"
  xl2: "16px"
  full: "9999px"
spacing:
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
components:
  button-confirm:
    backgroundColor: "{colors.action-ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    typography: "{typography.body}"
    padding: "8px 16px"
  button-confirm-hover:
    backgroundColor: "{colors.action-hover}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.action-hover}"
    rounded: "{rounded.lg}"
    typography: "{typography.label}"
    padding: "8px 12px"
  button-send:
    backgroundColor: "{colors.cyan}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    size: "32px"
  button-reader:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.action-hover}"
    rounded: "{rounded.lg}"
    padding: "7px 12px"
    height: "36px"
  input-document:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    typography: "{typography.body}"
    padding: "8px 12px"
  navigation-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.xl}"
    typography: "{typography.label}"
    padding: "8px 12px"
  card-document:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.xl2}"
    padding: "16px"
  chip-ready:
    backgroundColor: "#ecfdf5"
    textColor: "#047857"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  paper-reader:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.reader-ink}"
    rounded: "{rounded.xl}"
    width: "min(100%, 640px)"
---

# Design System: Veyd

## Overview

**Creative North Star: "handbook aesthetic"**

The existing application uses compact sans-serif controls, white panels, cool slate backgrounds and dark text. Cyan marks interaction and focus. The handbook reader adds white paper on a gray desk, serif chapter headings and generous reading space.

This record describes the incumbent implementation in `src/app/globals.css`, `tailwind.config.ts`, `src/components/` and `src/lib/handbook/reader.css`. Presentation geometry and DEV × Sanity co-branding belong to the `/demo` surface brief.

**Key Characteristics:**

- White and slate surfaces with dark action controls.
- Cyan interaction accents and visible keyboard focus.
- Compact application typography beside a serif handbook hierarchy.
- Borders and restrained shadows distinguish panels, paper and overlays.

## Colors

### Primary

Dark Ink supplies application text, selected desktop navigation and primary controls. Action Ink records the closely related Tailwind slate tone used by document-confirmation buttons; Action Hover supplies their hover state. Interaction Cyan supplies send controls, progress and focus, with Cyan Hover and Cyan Light recording existing interaction variants.

### Secondary

Reader Teal supplies handbook links, reference numbers and section details. The authentication form retains the Blue and Blue Hover values defined in the existing `brand` palette.

### Neutral

Paper is the panel and page background. Desk and Muted Surface provide the application's cool background and secondary surfaces; Muted Text supplies supporting labels. Border and Strong Border separate panels and controls. Reader Ink supplies reading text. Semantic success, warning and error treatments remain in the global status variables and the document-row status variants.

The light variables are authoritative for the current screens. The `.dark` block contains existing monochrome OKLCH overrides; this record does not claim that every screen has been verified in that theme.

## Typography

The root layout loads Figtree into `--font-sans`; application controls use the sans-serif UI family. Application titles are bold, with compact body and label sizes as recorded above. Chat prose uses a larger reading rhythm (15px, line-height 1.75).

The handbook explicitly uses Arial for controls and prose, with Georgia for page headings. Its cover and chapter headings have larger container-relative clamps than the ordinary reader headline. At narrow reader widths, prose becomes slightly smaller (14px, line-height 1.65). These reader roles are contextual rather than replacements for application typography.

## Layout

The application uses a desktop sidebar (256px) from the medium breakpoint (768px). Below it, a sticky compact header and horizontal Chat/Documents/Handbook tabs carry navigation. Main content is centered within a maximum width (1024px), with padding that grows from mobile to large screens (12px, 24px, 32px). Document rows stack controls on mobile and align them horizontally from the small breakpoint (640px).

The reader is centered within a maximum width (1100px). Its paper has a narrower reading width, a minimum page height (740px), and interior padding (44px 48px 56px). At widths up to 640px, paper padding becomes (26px 24px 36px), toolbar controls wrap, and page selection moves beneath previous/next. Floating side navigation is hidden at widths up to 800px. Print styling uses A5 portrait pages and removes reader controls.

## Elevation & Depth

Borders and tonal surfaces carry most structure. The shared card shadow is a small two-layer lift; reader paper has a broader two-layer shadow on its desk. Toolbars, reference popups and side panels have separate existing shadows appropriate to their overlay roles. Translucent card and toolbar surfaces use backdrop blur. Exact shadow and transition values are retained in the sidecar.

## Shapes

Controls use gently curved corners; application navigation and icon buttons use a larger curve. Document cards use rounded containers, and status chips and circular navigation use a full radius. Reader paper and its desk have their own rounded edges. The global `--radius` is (0.75rem); the observed component radii are recorded in frontmatter rather than forced into one value.

## Components

Document confirmation buttons use dark fills, white text and a lighter dark hover. Outline attachment controls use white fills and a slate border. Cyan square send buttons use a dark arrow. Busy or disabled controls reduce opacity and prevent unavailable actions. The shared Button API additionally exposes default, outline, secondary, ghost, destructive and link variants; preserve its established API when that primitive is used.

Inputs are white, bordered and padded, with rounded corners and visible focus. The document-name field adds a cyan ring; the authentication form uses the global focus outline. Desktop navigation uses a dark selected row, while mobile tabs use a white selected tab on a slate strip. Document cards pair title and metadata with labeled Ready/Processing/Needs attention chips, so status has text as well as color.

Reader buttons are compact bordered controls with a minimum height and disabled opacity. Reader paper pairs Georgia headings with Arial prose, page numbers, references and a toolbar. Global interactive focus uses a cyan outline (2px, offset 2px); reader controls repeat this treatment. Reduced-motion styles shorten global motion and disable reader spinner/pulse animation.

## Do's and Don'ts

### Do:

- **Do** reuse the existing white/slate/dark/cyan roles for application controls.
- **Do** keep the reader's Georgia headings and Arial prose in their reading context.
- **Do** preserve visible focus, disabled states and text labels for status.
- **Do** retain the implemented wrapping and stacked mobile navigation patterns.

### Don't:

- **Don't** apply `/demo` slide geometry or challenge branding to other application surfaces.
- **Don't** replace existing application controls with the presentation's larger type scale.
- **Don't** treat an extracted theme token as evidence that every screen supports that theme.
