---
name: compliance-deployment
description: Prepare, deploy, and operationally verify the compliance app on Vercel with Sanity Studio, private Blob, Upstash, least-privilege secrets, runtime limits, and structured logs. Use for milestone 9.
---

# Compliance Deployment

Read the [shared protocol](../../../docs/agent-implementation-protocol.md) and [`docs/09-deployment-and-operations.md`](../../../docs/09-deployment-and-operations.md) completely.

## Approach

1. Inventory target Vercel, Sanity, Blob, Upstash, Gemini, and Firecrawl environments without printing credentials.
2. Build web and Studio from a clean state before changing live configuration.
3. Configure private production data, least-privilege Sanity tokens, independent secrets, correct origins, Node runtime, and the maximum supported ingestion duration.
4. Deploy Studio/schema changes before an app version that depends on them.
5. Deploy a preview against non-production data and run the manual acceptance path before production promotion.
6. Add structured correlation, timing, result-count, and safe-error logs for every upstream boundary; verify redaction with a controlled failure.
7. Promote the verified artifact and run small, non-sensitive production smoke checks for ingestion, publication, chat, and MCP.

## Invariants

- A hosting plan that cannot sustain synchronous extraction is reported as a blocker; validation is not weakened to hide timeouts.
- Secrets are stored in environment managers and rotate independently.
- Schema changes are fixed forward and fields with production data follow deprecation/migration.
- External writes or paid resource creation stay within the user's deployment authorization.

## Done

Milestone 9's preview and production checks pass, operational failure procedures are reproducible, and logs prove useful without exposing protected data.

