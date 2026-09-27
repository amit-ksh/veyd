# Milestone 6 — User-Scoped Conversation Persistence in PostgreSQL

## Outcome

Persist user and assistant messages in PostgreSQL via Prisma, scoped to the authenticated user (`User -> Conversation -> Message`). Conversations are private to the user who created them, while compliance rules and document assets remain queried from Sanity Content Lake.

## URL and API behavior

- `/chat` starts a new conversation for the authenticated user.
- `/chat/[conversationId]` loads the user's specific conversation.
- `GET /api/conversations/[conversationId]` returns the conversation and ordered messages for the authenticated user.
- `GET /api/conversations` returns the list of conversations belonging to the current user.
- Requests without a valid session receive HTTP `401 Unauthorized`.
- Attempting to access another user's conversation returns HTTP `404 Not Found` or `403 Forbidden`.

## Persistence sequence

For the first message:

1. Create a `Conversation` record in PostgreSQL linked to `session.user.id`.
2. Persist the user message record linked to the conversation.
3. Send the conversation ID to the client as an early stream data part.
4. Replace the browser URL with `/chat/[conversationId]` without interrupting the stream.
5. Run Sanity retrieval and Gemini synthesis.
6. On successful completion, persist the assistant response and citations in PostgreSQL.
7. Update `conversation.updatedAt`.

For later messages, verify the exact conversation exists before writing. Never accept a client-supplied conversation ID for creation.

## Consistency rules

- Persist the user message before calling paid AI services.
- Persist the assistant message only from the stream completion callback, after final text and citations are known.
- If generation fails, retain the user message and show a retryable failed-turn state in the UI; do not fabricate an assistant record.
- If assistant persistence fails after the user saw a complete stream, show a clear “response was not saved” warning and log the request/conversation IDs.
- Use server-generated UTC timestamps.
- Do not persist tool-call payloads or full scraped pages as message content.
- Conversations and messages are permanent in v1. No TTL, scheduled cleanup, or application deletion path is implemented.

## Response contract

`GET /api/conversations/[conversationId]`:

```ts
type ConversationResponse = {
  conversation: {
    id: string
    createdAt: string
    updatedAt: string
  }
  messages: Array<{
    id: string
    role: "user" | "assistant"
    content: string
    citations: Citation[]
    createdAt: string
  }>
}
```

Return `404` for an unknown ID. Never return a list of other IDs or include Studio/system fields not needed by the UI.

## Ordering and duplicate submission

- Sort messages by `createdAt asc`, with `_createdAt asc` as a stable secondary order if required.
- Disable the composer while a turn is in progress.
- Attach a client-generated message ID to each submitted user message and store it as an explicit `clientMessageId` field with a uniqueness check in application code. A repeated submission with the same conversation/message pair returns the existing message rather than creating a duplicate.
- The schema must add `clientMessageId` to user messages before this milestone is complete.

## Tasks

- [x] Extend the message schema with `clientMessageId` and update its query projection.
- [x] Implement create-conversation and append-message services.
- [x] Integrate persistence into the chat stream lifecycle.
- [x] Implement the exact-ID conversation read endpoint.
- [x] Add `/chat` and `/chat/[conversationId]` routing behavior.
- [x] Add duplicate-submit protection and failure banners.
- [x] Confirm no list or delete capability exists in API or UI.

## Manual checkpoint

1. Start a new chat and confirm the URL changes to its generated ID during the first response.
2. Refresh the exact URL and confirm messages and citations restore in order.
3. Open a fabricated ID and confirm a non-enumerating `404` state.
4. Interrupt generation and confirm the user message remains while no assistant record is created.
5. Submit the same client message ID twice and confirm only one stored user message exists.
6. Search application routes and queries and confirm there is no history list or delete operation.
7. Run Studio build, type-check, and web production build.

## Checkpoint record

- Date: 2026-09-27
- Commit: f483377
- Reviewer: Antigravity Agent
- Result: Passed
- Notes:
  - Removed REGULATORY_OFFICIAL_DOMAINS restriction; allowed open web research with official vs secondary source classification and explicit primary document guidance.
  - Implemented User -> Conversation -> Message schema in PostgreSQL via Prisma with clientMessageId.
  - Synchronized Sanity Message schema with clientMessageId for deduplication.
  - User message persisted before upstream AI calls; assistant message persisted only upon stream completion.
  - Early stream emission of data-conversation-id allows client to update URL to /chat/[conversationId] seamlessly without stream interruption.
  - Exact-ID read endpoint (GET /api/conversations/[conversationId]) returns 401 for unauthenticated and 404 for unknown/cross-user requests (non-enumerating).
  - Confirmed no list or delete endpoints exist in API or UI.
  - Verified with automated tests (verify-m6.mjs), Next.js production build, Studio build, and TypeScript type-check.

