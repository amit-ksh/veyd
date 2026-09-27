# Milestone 0 — Dependencies and Running the Applications

## Outcome

Prepare a reproducible local environment for the Next.js application and the standalone Sanity Studio. This milestone changes configuration and dependencies only; it does not implement product features.

## Required services

| Service | Purpose | Required locally |
| --- | --- | --- |
| Sanity project and private dataset | Durable PDF assets, rules, conversations, and messages | Yes |
| Google AI Studio / Gemini API | PDF rule extraction and answer synthesis | Yes |
| Firecrawl | External search and page extraction | Yes |
| Vercel Blob | Temporary direct browser upload | Yes for full ingestion flow |
| Upstash Redis | Durable rolling-window rate limits | Yes for public-route checks |
| Vercel project | Production Next.js runtime | Deployment only |

## Runtime dependencies

Install compatible AI SDK packages together so their peer versions remain aligned. Commit the resulting `pnpm-lock.yaml`.

```powershell
pnpm add ai @ai-sdk/react @ai-sdk/google `
  @sanity/client@^7.13.2 @sanity/id-utils groq `
  @vercel/blob @upstash/redis @upstash/ratelimit `
  @modelcontextprotocol/sdk pdf-lib zod

pnpm --dir sanity add @sanity/icons
```

The application uses Firecrawl's `POST https://api.firecrawl.dev/v2/search` endpoint through native server-side `fetch`; no Firecrawl SDK is required.

Existing dependencies that remain useful:

- `next`, `react`, and `react-dom` for the application.
- `sanity`, `@sanity/vision`, and `styled-components` for Studio.
- `tailwindcss`, `class-variance-authority`, `lucide-react`, and the existing UI primitives.
- TypeScript and the existing Node/React type packages.

Target-architecture dependencies that can be removed only after their old code is gone:

- `@prisma/client` and `prisma`.
- `better-auth`.
- `@tanstack/react-query` and its devtools.
- `@portabletext/react` if no remaining screen renders Portable Text.

Do not remove a package while an imported source file still depends on it.

## Environment variables

Copy `.env.example` to `.env.local` for the Next.js app. The Studio may read the root `.env` during the current repository setup, but production Studio variables must be configured in its deployment environment.

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Browser-safe | Canonical application origin |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Browser-safe | Sanity project identifier |
| `NEXT_PUBLIC_SANITY_DATASET` | Browser-safe | Dataset name |
| `NEXT_PUBLIC_SANITY_API_VERSION` | Browser-safe | Pinned Sanity API date |
| `SANITY_STUDIO_PROJECT_ID` | Studio build | Studio project identifier |
| `SANITY_STUDIO_DATASET` | Studio build | Studio dataset |
| `SANITY_API_READ_TOKEN` | Server only | Read private published content |
| `SANITY_API_WRITE_TOKEN` | Server only | Upload assets and write app records/drafts |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Server only | Gemini provider credential |
| `GEMINI_MODEL` | Server only | Stable Gemini model ID selected at deploy time |
| `FIRECRAWL_API_KEY` | Server only | Firecrawl search credential |
| `BLOB_READ_WRITE_TOKEN` | Server only | Private Vercel Blob client-upload flow |
| `UPSTASH_REDIS_REST_URL` | Server only | Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Server only | Redis credential |
| `MCP_TOOL_SECRET` | Server only | Bearer secret for `/api/mcp` |

Never prefix secrets with `NEXT_PUBLIC_`. Validate all server variables once in a server-only configuration module and fail startup with variable names, never values.

## Required scripts and commands

The existing root scripts are sufficient initially:

```powershell
pnpm dev
pnpm build
pnpm exec tsc --noEmit
pnpm sanity:dev
pnpm --dir sanity build
```

Run the web app and Studio in separate terminals. Expected local origins are `http://localhost:3000` and `http://localhost:3333`.

## Tasks

- [ ] Install the required dependencies and commit the lockfile.
- [ ] Remove no legacy dependency until its imports have been removed.
- [ ] Create `.env.local` from `.env.example` and populate real secrets locally.
- [ ] Configure the Sanity dataset as private.
- [ ] Add `http://localhost:3000` to Sanity CORS origins.
- [ ] Confirm Vercel Blob and Upstash resources are connected to the Vercel project.
- [ ] Add a server-only environment parser used by later milestones.

## Manual checkpoint

1. `pnpm dev` starts without missing-variable errors after valid values are supplied.
2. `pnpm sanity:dev` opens the standalone Studio.
3. `pnpm exec tsc --noEmit` succeeds.
4. `pnpm build` and `pnpm --dir sanity build` succeed before feature implementation begins.
5. Browser bundles and page HTML do not contain any server-only token.

## Checkpoint record

- Date:
- Commit:
- Reviewer:
- Result: Pending
- Notes:

