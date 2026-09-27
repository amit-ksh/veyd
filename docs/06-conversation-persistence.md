# Milestone 6 — Permanent Conversation Persistence

## Outcome

Persist user and assistant messages in Sanity and allow a conversation to be reopened only when its exact unguessable ID is present in the URL. Do not add a history browser, ownership model, or deletion flow.

## URL and API behavior

- `/chat` starts a new conversation on the first submitted message.
- `/chat/[conversationId]` loads one exact conversation.
- `GET /api/conversations/[conversationId]` returns the conversation and ordered messages.
- There is no `GET /api/conversations`, search endpoint, recent-history endpoint, or delete endpoint.

The ID is a hard-to-guess locator, not authorization. The application is public and unauthenticated; documentation and UI copy must not claim that the conversation is private.

## Persistence sequence

For the first message:

1. Create a `conversation` with a Sanity-generated ID.
2. Persist the user message with a strong reference to it.
3. Send the conversation ID to the client as an early stream data part.
4. Replace the browser URL with `/chat/[conversationId]` without interrupting the stream.
5. Run retrieval and generation.
6. On successful completion, persist the final assistant text and normalized citations.
7. Patch `conversation.updatedAt` after each successful message creation.

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

- [ ] Extend the message schema with `clientMessageId` and update its query projection.
- [ ] Implement create-conversation and append-message services.
- [ ] Integrate persistence into the chat stream lifecycle.
- [ ] Implement the exact-ID conversation read endpoint.
- [ ] Add `/chat` and `/chat/[conversationId]` routing behavior.
- [ ] Add duplicate-submit protection and failure banners.
- [ ] Confirm no list or delete capability exists in API or UI.

## Manual checkpoint

1. Start a new chat and confirm the URL changes to its generated ID during the first response.
2. Refresh the exact URL and confirm messages and citations restore in order.
3. Open a fabricated ID and confirm a non-enumerating `404` state.
4. Interrupt generation and confirm the user message remains while no assistant record is created.
5. Submit the same client message ID twice and confirm only one stored user message exists.
6. Search application routes and queries and confirm there is no history list or delete operation.
7. Run Studio build, type-check, and web production build.

## Checkpoint record

- Date:
- Commit:
- Reviewer:
- Result: Pending
- Notes:

