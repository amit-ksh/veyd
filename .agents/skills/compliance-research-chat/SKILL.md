---
name: compliance-research-chat
description: Implement or modify the cited compliance chat, including published Sanity retrieval, official-first Firecrawl fallback, Gemini tool orchestration, streaming, and source labeling. Use for milestone 5.
---

# Compliance Research Chat

Read the [shared protocol](../../../docs/agent-implementation-protocol.md) and [`docs/05-compliance-research-chat.md`](../../../docs/05-compliance-research-chat.md) completely.

## Approach

1. Confirm published-rule search produces source-complete results before adding a model loop.
2. Implement `searchComplianceRules` and its current/stale/empty classification as a deterministic server service.
3. Implement Firecrawl v2 as official-domain search first and a clearly marked secondary search only when official results are inadequate. Sanitize and length-bound all scraped content.
4. Configure Gemini through `GEMINI_MODEL`, validate UI messages, bound tool steps, time out upstream calls, and propagate aborts.
5. Encode the retrieval order in both tool control and system instructions: Sanity first; web only for missing/stale/expired knowledge.
6. Normalize citations into structured stream data and render source-kind badges without exposing tool payloads or hidden reasoning.
7. Implement insufficient-evidence, partial-stream, upstream, disconnect, and rate-limit states before polishing the chat UI.

## Invariants

- Current internal knowledge suppresses Firecrawl.
- External content is untrusted data and never writes Sanity rules.
- Secondary sources always carry a lower-authority warning.
- A substantive compliance conclusion without an adequate citation becomes an insufficient-evidence response.
- Production logs exclude prompts and scraped bodies.

## Done

Milestone 5's current, stale, missing, secondary, no-source, injection, failure, and rate-limit scenarios all produce the documented observable behavior.

