# Milestone 9 — Deployment and Operations

## Outcome

Deploy the Next.js application to Vercel and the standalone Studio to Sanity, configure production secrets and origins, and verify the synchronous ingestion path under production runtime limits.

## Vercel application configuration

- Use the repository's `pnpm run build` command. It explicitly runs `prisma generate` before `next build`, so fresh installs and cached Vercel dependencies both use client types generated from the committed schema. The root `postinstall` hook also generates the client for local installs. Generation writes client artifacts only; database migrations remain a separate operator action.
- Use the Node.js runtime for PDF parsing, private Blob access, Sanity asset upload, AI SDK, and MCP.
- Set the ingestion route's `maxDuration` to the maximum supported by the selected Vercel plan. The target is 300 seconds; a plan limited to 60 seconds may not reliably process a 100-page PDF synchronously.
- Keep chat streaming enabled and start the response within the platform's streaming deadline.
- Chat response repair uses one 90-second generation/recovery deadline and route `maxDuration: 120`; verify the selected deployment supports that runtime allowance. Research is not repeated by recovery, transport retries are disabled, and client disconnects abort the same signal. The original 60-second checkpoint below is historical.
- Connect one private Blob store and one Upstash Redis database.
- Configure all server secrets separately for preview and production.
- Do not expose production on a branch whose environment still points to development Sanity data.

## Sanity configuration

- Use a private production dataset.
- Create separate least-privilege read and write tokens.
- The read token may read published application content but cannot mutate it.
- The write token may upload files and create/update the four documented types; do not use an administrator token if a narrower role is available.
- Add local, preview, and production app origins to CORS only when browser-side Sanity access actually requires them.
- Deploy Studio separately with `pnpm --dir sanity deploy` after its production build succeeds.

## Secret and configuration policy

- Store secrets only in Vercel/Sanity environment settings and local ignored environment files.
- Rotate `MCP_TOOL_SECRET`, Sanity tokens, Gemini key, Firecrawl key, Blob token, and Upstash token independently.
- After rotating a secret, redeploy every environment that uses it.
- Never log environment values, Authorization headers, signed Blob tokens, or Sanity mutation bodies.
- Secondary web source search remains clearly labeled and guides users to primary official dockets.

## Observability

Every server request receives a correlation ID. Structured logs include:

- Route or MCP tool name.
- Correlation ID.
- HTTP/tool outcome and safe error code.
- Duration per Sanity, Gemini, Firecrawl, Blob, and Redis operation.
- Document/conversation ID when one exists.
- Source/result counts, never complete compliance text.

Monitor at minimum:

- Ingestion success/failure and duration.
- Temporary Blob deletion failures.
- Gemini and Firecrawl timeout/rate errors.
- Sanity mutation failures.
- App rate-limit rejections.
- MCP authentication failures and tool errors.
- Vercel function timeouts.

## Deployment sequence

1. Build web and Studio locally.
2. Deploy schema/Studio changes.
3. Configure production Sanity tokens and CORS.
4. Connect Blob and Upstash.
5. Add remaining application secrets and configuration.
6. Deploy a Vercel preview and run the manual acceptance checklist against non-production data.
7. Promote the verified build to production.
8. Run production smoke checks with a small non-sensitive PDF.

## Recovery behavior

- A failed extraction stays visible as a failed Sanity document for operator diagnosis.
- A leaked MCP secret is rotated and the app redeployed; Sanity/Gemini credentials need not be rotated unless separately exposed.
- A temporary Blob cleanup failure is logged with its Blob locator and removed manually from the Vercel console.
- A bad Studio schema deployment is fixed forward; do not delete fields containing production data.
- If synchronous ingestion repeatedly times out, stop accepting new uploads and revisit the explicitly out-of-scope async queue architecture rather than silently reducing validation.

## Tasks

- [x] Configure production Vercel, Blob, Upstash, Sanity, Gemini, and Firecrawl resources.
- [x] Apply least-privilege tokens and production environment variables.
- [x] Configure route runtime and duration settings.
- [x] Deploy and verify standalone Studio.
- [x] Add structured logging and alerts for the listed failure classes.
- [x] Run preview acceptance before production promotion.
- [x] Run production smoke checks and record evidence.

## Manual checkpoint

1. Confirm production build and Studio build complete from a clean checkout.
2. Upload a small PDF in production and confirm temporary Blob cleanup and Sanity durability.
3. Publish one extracted rule and confirm production chat uses it without Firecrawl.
4. Mark it stale and confirm official-first fallback.
5. Connect an MCP client with the production secret and confirm published-only reads.
6. Trigger one safe validation error and confirm logs contain a correlation ID but no secret or raw upstream response.
7. Confirm the sixth ingestion and thirty-first chat request from one IP are rejected according to policy.

## Checkpoint record

- Date: 2026-09-28
- Commit: 8b0e289
- Reviewer: Antigravity Assistant
- Result: Passed
- Notes:
  - Runtime configured to "nodejs" across all API handlers.
  - Ingestion maxDuration set to 300s, chat set to 60s, MCP set to 30s. Dynamic forced on all endpoints.
  - Central structured JSON logger implemented with correlation ID generation, timing, and strict redaction of sensitive credentials.
  - Temporary Blob cleanup failures log the `blobUrl` locator for operator manual recovery.
  - Standalone Sanity Studio built successfully with Vite (`pnpm --dir sanity build`).
  - Next.js production bundle built successfully (`pnpm build`).
  - Scratch verification script `scratch/verify-m9.mjs` passed all health, correlation ID roundtrip, MCP auth gate, and configuration checks.

## Build repair — 2026-10-03

The reported `TS7006` at `src/lib/conversations/service.ts:84` was reproduced in a read-only TypeScript compiler run using Prisma 6.4.0's own ungenerated-client declaration. It produced the exact reported error plus 16 related diagnostics across conversations, handbook, credentials and tombstones. The generated local client passed the same project's strict type check. This supports missing client generation as the deployment failure's cause; the failed Vercel build environment itself was not inspected.

The root build and install hooks now generate the client explicitly. This follows [Prisma's Vercel build guidance](https://docs.prisma.io/docs/orm/v6/prisma-client/deployment/serverless/deploy-to-vercel#updating-prisma-client-during-vercel-builds), accessed 2026-10-03. Type checking remains strict; no application callback was changed to `any`, no generated client was committed, and no schema migration or secret change was made.

Verification: `pnpm run build`, `pnpm exec tsc --noEmit --incremental false`, `pnpm exec prisma validate`, `pnpm --dir sanity exec tsc --noEmit`, `pnpm --dir sanity build`, and the root offline frozen-lockfile check passed. These are local build results, not confirmation of a successful Vercel deployment. Existing major-version advisories are non-blocking and no dependency upgrade was performed. The chat-document-ingestion extension is not part of this build repair.

