---
name: conversation-persistence
description: Persist compliance-chat conversations and citations in Sanity, reopen them by exact unguessable URL, and prevent duplicate message submission. Use for milestone 6 persistence work.
---

# Conversation Persistence

Read the [shared protocol](../../../docs/agent-implementation-protocol.md) and [`docs/06-conversation-persistence.md`](../../../docs/06-conversation-persistence.md) completely.

## Approach

1. Extend the message model and projections for `clientMessageId` before changing the chat route.
2. Create the conversation server-side on the first user turn; return its generated ID as an early stream data part and update the URL without interrupting generation.
3. Persist the user message before paid model work. Persist the assistant only from successful stream completion with final citations.
4. Make append operations idempotent for a conversation/client-message pair.
5. Implement exact-ID read and hydration for `/chat/[conversationId]` with stable chronological ordering.
6. Represent interrupted generation and failed assistant persistence honestly in the UI.
7. Search the route/query surface to prove no list, recent-history, search, TTL, or delete capability was introduced.

## Invariants

- IDs are unguessable locators, not an authentication claim.
- Conversations are permanent in v1.
- Tool payloads and scraped pages are not persisted as messages.
- A failed generation retains the user message and creates no fabricated assistant message.

## Done

New, refreshed, unknown, interrupted, duplicate, and no-enumeration scenarios pass the milestone 6 checkpoint.

