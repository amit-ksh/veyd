---
name: compliance-dashboard-ui
description: Implement or refine the compliance app's responsive Chat and Documents dashboard, including upload, streaming, citation, failure, accessibility, and mobile states. Use for milestone 8 UI work.
---

# Compliance Dashboard UI

Read the [shared protocol](../../../docs/agent-implementation-protocol.md) and [`docs/08-dashboard-ui.md`](../../../docs/08-dashboard-ui.md) completely. Inspect the two linked design images before changing visual direction.

## Approach

1. Audit existing global styles, tokens, primitives, routes, and legacy navigation before creating components.
2. Establish the supplied palette as semantic CSS variables, then add only the neutral/status tokens required for readable states.
3. Build the responsive shell and link-backed Chat/Documents navigation before feature-specific layouts.
4. Implement the complete chat state machine: empty, sending, tool activity, streaming, complete, secondary-source warning, reopened, interrupted, rate-limited, and persistence failure.
5. Implement the complete document state machine: selected, uploading, processing, ready, no rules, failed, draft count, and published count.
6. Keep rule editing/publication in Studio. Remove legacy workspace/handbook/verification navigation only after replacement routes work.
7. Verify keyboard flow, live regions, focus, contrast, reduced motion, and narrow/mobile layouts with real content and long errors.

## Invariants

- The reference is design direction, not a source for unrelated features.
- The UI never exposes hidden reasoning, raw tool payloads, secrets, or scraped Markdown.
- Drag-and-drop has a file-picker equivalent.
- There is no authentication, workspace selector, conversation browser, or in-app rule editor.

## Done

All milestone 8 desktop/mobile, chat, upload, accessibility, source-warning, and legacy-removal checks pass with a production build.

