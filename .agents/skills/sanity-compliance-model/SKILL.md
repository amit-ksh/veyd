---
name: sanity-compliance-model
description: Implement or evolve the Sanity schemas, Studio structure, TypeScript projections, and GROQ for compliance documents, rules, conversations, and messages. Use for milestone 2 content-model work.
---

# Sanity Compliance Model

Read the [shared protocol](../../../docs/agent-implementation-protocol.md) and [`docs/02-sanity-schema-design.md`](../../../docs/02-sanity-schema-design.md) completely.

## Approach

1. Inspect all existing schema types, queries, seed data, and callers before changing registration.
2. Implement the four documented types with `defineType`, `defineField`, and `defineArrayMember`; model relationships as references.
3. Add validation for required fields, enums, ranges, unique arrays, and effective/expiry ordering. Mirror those rules in later Zod boundaries.
4. Build Studio previews and structure that separate editorial content from application records.
5. Implement published-perspective GROQ projections with `defineQuery`; validate numeric slice bounds before interpolation.
6. Define explicit TypeScript result types and migrate callers away from `any`.
7. Preserve production fields through deprecation and migration rather than direct deletion.

## Invariants

- Sanity generates ordinary IDs; ID conventions never encode relationships.
- Extracted rules can exist as invalid drafts until reviewed, but runtime queries never return drafts.
- Array projections include `_key`.
- There is no industry taxonomy and no conversation-list query.

## Done

Studio builds, validation behaves as documented, draft isolation is proven, and every required query returns the exact typed projection in milestone 2.

