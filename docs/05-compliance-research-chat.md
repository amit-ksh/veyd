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

1. Search Firecrawl v2 across the open web without domain restrictions, limit five, and `scrapeOptions.formats: ["markdown"]`.
2. Classify sources based on domain authority: official regulatory domains (.gov, .mil, .europa.eu) as `official-web`, and general web sources as `secondary-web`.
3. Require the model to proactively guide users on where to locate primary official regulatory documents and registries.
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
- Share one 90-second abort deadline across initial generation, research and answer repair; combine it with the client disconnect signal. The chat route allows 120 seconds for authorization/persistence overhead. Transport retries are disabled.
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

## Bounded final-answer repair

Chat remains streamed Markdown; the handbook schema is not applied to ordinary answers. If the bounded tool loop completes successfully but its final text is empty, run synthesis-only recovery with the same question, actual tool results and tracked citations. Do not repeat Sanity or Firecrawl searches, add tools, ingest files or accept model-authored citation metadata.

Validate recovery output as nonempty Markdown (up to 20,000 characters), an answered/insufficient-evidence status and indexes referencing only the retrieved citations. Answered recovery requires a source; numbered markers must match selected sources. Convert the validated result to the existing Markdown/message format and derive its source markers from those validated indexes. When no sources were retrieved, return a deterministic insufficient-evidence message without another paid model call.

Allow at most three recovery model calls total within the original deadline. Reuse each malformed response with schema feedback and the original evidence until it validates or the bounds are exhausted. This is response-format recovery, not verification that every model explanation is factually correct. The source-fidelity and secondary/stale warning instructions still apply.

Hold the stream's final completion event until repair and persistence finish. Save exactly one complete assistant answer with the existing citations/files; emit one final completion event. Preserve all displayed text parts so reloaded history matches the streamed response, and pass preliminary text to recovery as the existing draft. Never repair or persist provider-failed, truncated, filtered or disconnected streams. Partial text stays visibly incomplete, with a safe retry message. Exhausted repair leaves the user message intact and does not create an assistant record. Log attempt counts and identifiers, not prompts, source bodies or provider error details.

## Tasks

- [x] Add the server-only Gemini provider and model factory.
- [x] Implement and share the Sanity search service.
- [x] Implement official-first Firecrawl v2 search and sanitization.
- [x] Implement the deterministic retrieval policy and bounded tool loop.
- [x] Add structured citation data parts and source badges.
- [x] Add timeout, abort, logging, and stream-safe error behavior.
- [x] Connect a temporary chat screen; persistence is the next milestone.

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

### Response recovery follow-up — 2026-10-04

The actual route/AI SDK manual fixture reproduced an empty final answer with retrieved current sources: zero saved assistant messages and a stream error. After recovery was added, it produced one saved cited answer without another search. Eleven temporary manual scenarios passed: normal answers without repair; current, missing and stale-source recovery; exact preliminary-text/history matching; consecutive malformed-response reuse; invalid-response rejection after three recovery calls; no-source insufficient evidence without paid recovery; provider-interrupted and truncated streams not saved/retried; and client abort during recovery preventing persistence. Successful scenarios checked exactly one finish event, matching streamed/stored text, known source references and a shared abort signal. Fixtures were removed, not retained as a unit/integration suite.

A real in-memory recovery with the unchanged `gemini-3.8-flash` model and an existing published Pharma project entry returned nonempty Markdown with its known source marker. No chat, source or publication record was added or changed by that check. Application type-checking and the isolated production build passed. This verifies response structure and retrieval provenance, not independent factual accuracy or an authenticated browser/deployed flow. Changes are committed with the handbook schema repair; resolve the revision with `git log -1 --format=%H -- src/lib/chat/response-repair.ts`. No model, secret, dependency or database schema change is required.

- Date: 2026-09-27
- Commit: Pending (Master)
- Reviewer: Antigravity Assistant & User
- Result: Passed
- Notes: Published rule search tested with draft isolation and freshness classification; deterministic policy tested to suppress Firecrawl when current internal rules match; prompt-injection sanitization verified; 30-turn IP rate limit verified on POST /api/chat with 429 and Retry-After headers; pnpm exec tsc --noEmit, pnpm build, and pnpm --dir sanity build all exited 0.

