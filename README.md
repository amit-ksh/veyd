# Compliance Handbook

A universal, cross-industry **compliance engine** that doubles as an **interactive
onboarding handbook** — built for the [Sanity Challenge](https://dev.to/challenges/sanity-2026-09-16)
(Path Two: Vibe-Code Something Strange).

**User → Workspace → Handbook**, plus an **MCP tool** so an AI agent can verify
compliance itself instead of guessing.

## Why this shape

- **Content vs. state are split on purpose.** The handbook's actual words — chapters,
  compliance rules, checklists, citations — live in **Sanity**, editable by a
  compliance/legal team with no code deploy. **Postgres (Prisma)** holds everything
  transactional: who's in which workspace, what they've acknowledged, and the
  audit trail of every verification. Sanity answers "what's the rule?"; Postgres
  answers "did we check it, and when?"
- **The MCP tool is the same code path as the UI.** `/api/mcp` exposes
  `search_compliance_rules`, `verify_compliance`, `get_handbook_for_industry`, etc.
  The in-app **Verify** tab calls the exact same `verifyComplianceTool` handler
  (`src/lib/mcp/tools.ts`) through a plain REST route. A human clicking checkboxes
  and an AI agent calling the tool produce identical, auditable
  `VerificationLog` rows — no separate "AI answer" that isn't traceable to a rule.
- **better-auth + a database hook** gives every new user a personal workspace on
  sign-up, so `User -> Workspace -> Handbook` holds from message one, before
  anyone invites teammates.

## Stack

Next.js 14 (App Router) · TypeScript · better-auth · Prisma/Postgres · Sanity ·
next-sanity · TanStack Query · Tailwind CSS · `@modelcontextprotocol/sdk`

## Project layout

```
prisma/schema.prisma         Users, workspaces, memberships, progress, verification log
sanity/schemaTypes/          industry / chapter / complianceRule document types
sanity/seed.mjs              Sample "Food Processing" dataset (HACCP, allergens, OSHA...)
src/lib/auth.ts              better-auth config (+ auto-create workspace on sign-up)
src/lib/sanity/queries.ts    GROQ queries + types for handbook content
src/lib/mcp/tools.ts         The 5 tools: list_industries, get_handbook_for_industry,
                              search_compliance_rules, verify_compliance,
                              get_verification_history
src/app/api/mcp/route.ts     MCP server exposed over Streamable HTTP, bearer-gated
src/app/(dashboard)/workspace/[workspaceId]/
  page.tsx                   Overview: progress %, recent checks, failing count
  handbook/                  Chapter list + reader (Portable Text) + "acknowledge" button
  verify/                    Search a rule, check its checklist, get PASS/FAIL/NEEDS_REVIEW
```

## Setup

1. **Install deps** (root app + Studio):
   ```bash
   npm install
   cd sanity && npm install && cd ..
   ```
2. **Sanity project**: create one at sanity.io/manage (or `npx sanity@latest init` inside
   `sanity/`), then fill in `NEXT_PUBLIC_SANITY_PROJECT_ID`, `SANITY_API_READ_TOKEN`
   (viewer token) and `SANITY_API_WRITE_TOKEN` (editor token) in `.env`.
3. **Postgres**: point `DATABASE_URL` at a Postgres instance, then:
   ```bash
   npm run db:push
   ```
4. **Auth secret**: `BETTER_AUTH_SECRET` — generate with `openssl rand -base64 32`.
5. **Seed sample content**:
   ```bash
   npm run sanity:seed
   ```
6. **Run it**:
   ```bash
   npm run dev        # app on :3000
   npm run sanity:dev # Studio on :3333 (optional, for editing content)
   ```

## Pointing an agent at the MCP endpoint

`POST /api/mcp` with header `Authorization: Bearer $MCP_TOOL_SECRET` speaks MCP
over Streamable HTTP. Point any MCP-capable agent at it and it can call
`search_compliance_rules` → `verify_compliance` against a real workspace id, the
same way the in-app Verify panel does.

## Honest limitations / what's stubbed

- **The MCP transport wiring in `route.ts` targets the current
  `@modelcontextprotocol/sdk` Streamable HTTP API.** That SDK's surface has moved
  fast; verify `transport.handleRequest` against the exact SDK version you install
  and adjust if it's changed — the tool *logic* in `src/lib/mcp/tools.ts` is stable
  and can be re-wired to whatever transport shape the SDK expects.
- Only one industry (Food Processing) is seeded; add more `industry` + `chapter`
  + `complianceRule` documents in the Studio (or extend `seed.mjs`) to cover
  other industries — the whole app is data-driven off Sanity, no code changes needed.
- No workspace invite flow yet (adding a teammate to an existing workspace) —
  memberships exist in the schema but there's no UI to create them beyond the
  auto-created personal workspace.
- Portable Text rendering is minimal (no custom marks/embeds beyond the default
  `@portabletext/react` components).
