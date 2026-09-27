---
name: compliance-manual-acceptance
description: Run and record the compliance app's final manual acceptance checks without creating unit-test or integration-test suites. Use for milestone 10 release verification.
---

# Compliance Manual Acceptance

Read the [shared protocol](../../../docs/agent-implementation-protocol.md) and [`docs/10-manual-acceptance-checklist.md`](../../../docs/10-manual-acceptance-checklist.md) completely.

## Approach

1. Record commit, environment, URLs, reviewer, and browser before starting.
2. Run type, web build, and Studio build checks first; stop if the artifact cannot build reproducibly.
3. Execute the checklist in dependency order: configuration, ingestion, editorial review, chat, persistence, MCP, rate limits, UI/accessibility, then operations.
4. Use non-sensitive fixtures that deliberately cover valid, empty, invalid-binary, oversized, over-page-limit, stale, missing-source, interrupted, duplicate, and unauthorized cases.
5. Verify durable side effects directly in Sanity, Blob, and logs where required. A UI success message alone is not evidence.
6. Record each failure with reproduction steps and leave the release unapproved until fixed and rerun.
7. Record accepted limitations only with explicit user approval, an owner, and a follow-up date.

## Invariants

- This skill adds no unit-test or integration-test framework or test files.
- A skipped check is reported as unverified, never passed.
- Production verification uses small non-sensitive data and avoids destructive cleanup outside documented temporary artifacts.
- Approval requires every required item to pass or an explicitly accepted limitation.

## Done

The milestone 10 record contains reproducible evidence, no required item is unresolved, and the named reviewer has made the release decision.

