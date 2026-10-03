---
name: chat-document-ingestion
description: Implement confirmed project ingestion of uploaded or research-discovered PDFs from chat, including file cards, saved receipts and secure downloads. Use for Milestone 15.
---

# Chat document ingestion

Read the docs index, shared implementation protocol and [Milestone 15](../../../docs/15-chat-document-ingestion.md) completely.

1. Trace chat discovery, saved-message metadata, project authorization and the existing PDF ingestion pipeline. Completion: candidate IDs, owned upload paths and durable receipt boundaries are explicit.
2. Prove the provider-backed PDF and confirmation boundary first. Resolve only server-stored candidates; screen public HTTPS/DNS, retrieve original bytes through Firecrawl, validate the PDF, then parse all physical pages before storage. Follow Milestone 15's provider trust and response bounds rather than claiming app-side redirect pinning. Completion: unsafe, fabricated and partial sources fail before durable writes.
3. Reuse the ingestion pipeline and versioned existing message JSON for processing/ready/failed receipts. Preserve legacy citation arrays, human publication and removed-source attribution. Completion: a confirmed import is durable and repeats cannot duplicate successful or uncertain work.
4. Add file cards and a focus-contained confirmation to the existing chat UI. Keep local files/Blob locators outside query caches; invalidate original-project metadata after mutations. Completion: cancel, retry, project switching, saved-chat refresh and mobile interaction behave honestly.
5. Run Milestone 15's build and manual checkpoint without unit/integration suites. Separate fixture checks from live service evidence and stop for review.
