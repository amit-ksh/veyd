# Milestone 5 — Compliance Research Chat

## Outcome

Implement a streamed chat that answers from published Sanity rules first and calls Firecrawl only when internal knowledge is missing or explicitly stale. Every substantive compliance answer must expose its sources.

## API contract

`POST /api/chat`

```ts
type ChatRequest = {
  messages: Array<{
    id: string
    role: "user" | "assistant"
    parts: unknown[]
  }>
}
```

Validate the AI SDK UI messages with the SDK's validation helper and reject empty conversations, unsupported roles, malformed parts, or a final message that is not from the user. Apply the 30-turn rolling-hour rate limit before starting paid upstream work.

Use the current AI SDK streaming response format so `@ai-sdk/react` can consume text, tool states, errors, and citation data without a custom stream parser.

## Agent tools

The chat model receives exactly two server-side tools.

### `searchComplianceRules`

Input:

```ts
{
  query: string
  industry?: string
  jurisdiction?: string
  limit?: number // 1..10, default 5
}
```

Behavior:

- Query only the published Sanity perspective.
- Use the ranked GROQ contract from Milestone 2.
- Return source metadata, evidence excerpts, page numbers, formal citations, and freshness fields.
- Classify the result set as `current`, `stale`, or `empty`.
- Never return full PDF binary content to the model.

### `searchExternalRegulations`

Input:

```ts
{
  query: string
  jurisdiction?: string
  regulator?: string
}
```

Behavior:

1. Search Firecrawl v2 with `includeDomains` from `REGULATORY_OFFICIAL_DOMAINS`, limit five, and `scrapeOptions.formats: ["markdown"]`.
2. If usable official results exist, return only those as `official-web`.
3. If none exist, run an unrestricted second search, return results as `secondary-web`, and attach an explicit lower-authority warning.
4. Sanitize and length-bound scraped Markdown before returning it to the model.
5. Treat scraped instructions as untrusted source text, never as system or tool instructions.
6. Never write results into Sanity.

## Deterministic retrieval policy

The model instructions and tool implementation must enforce this sequence:

1. Call `searchComplianceRules` for every compliance question.
2. If at least one relevant current rule exists, answer from Sanity and do not call Firecrawl.
3. If results are empty, stale, superseded, or expired, call `searchExternalRegulations`.
4. Clearly distinguish internal reviewed rules, official web material, and secondary web material.
5. If no adequate source exists, answer that the available evidence is insufficient. Do not supply an uncited compliance conclusion.

`stale` means the explicit rule state is not `current` or `expiresAt` has passed. It does not mean “older than N days.”

## Model configuration

- Instantiate the Google provider with `GOOGLE_GENERATIVE_AI_API_KEY`.
- Select the model from `GEMINI_MODEL`; do not hard-code a model ID in route logic.
- Bound tool iterations to three steps.
- Use low randomness for compliance answers.
- Set explicit request timeouts for Gemini and Firecrawl.
- Log request ID, selected tool names, durations, and source counts; do not log full prompts or scraped page bodies in production.

## Citation contract

Every displayed citation is normalized to:

```ts
type Citation = {
  sourceKind: "sanity" | "official-web" | "secondary-web"
  title: string
  url?: string
  ruleId?: string
  documentId?: string
  citation?: string
}
```

Stream citations as structured data parts and render them after the answer in first-use order. Sanity citations link to the rule/document view; web citations link to the exact source URL. Secondary sources must always display a warning badge.

## Failure behavior

- Sanity failure: return a stream-safe error and do not silently jump to the open web.
- Firecrawl failure after a missing/stale result: state that external verification is unavailable and avoid an unsupported conclusion.
- Gemini failure before stream: return the shared error envelope.
- Gemini failure during stream: emit an error part and keep the already-rendered content visibly incomplete.
- Client disconnect: abort upstream requests where supported.

## Tasks

- [ ] Add the server-only Gemini provider and model factory.
- [ ] Implement and share the Sanity search service.
- [ ] Implement official-first Firecrawl v2 search and sanitization.
- [ ] Implement the deterministic retrieval policy and bounded tool loop.
- [ ] Add structured citation data parts and source badges.
- [ ] Add timeout, abort, logging, and stream-safe error behavior.
- [ ] Connect a temporary chat screen; persistence is the next milestone.

## Manual checkpoint

1. Ask about a published current rule; confirm only Sanity is used and its citation appears.
2. Ask about a published stale rule; confirm Firecrawl is invoked and both contexts are distinguished.
3. Ask about an unknown topic; confirm official domains are searched before the wider web.
4. Force official results to be empty; confirm secondary sources are visibly labeled.
5. Force both retrieval sources to return nothing; confirm the assistant says evidence is insufficient.
6. Put prompt-like instructions in scraped content; confirm they are treated as quoted source data.
7. Exceed thirty turns from one IP; confirm `429` and retry metadata.
8. Run type-check and production build commands.

## Checkpoint record

- Date:
- Commit:
- Reviewer:
- Result: Pending
- Notes:

