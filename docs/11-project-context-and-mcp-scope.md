# Milestone 11 — Project Context and Project-Scoped MCP Access

## Outcome

Add user-owned application projects so one account can keep independent compliance domains such as **Food** and **Civil**. Every document, extracted rule, conversation, chat retrieval, and MCP read belongs to exactly one project. The sidebar lists projects and provides an **Add project** action.

This milestone introduces an application workspace boundary, not another Sanity project or dataset. All application projects continue to use the configured Sanity dataset and PostgreSQL database.

## Locked v1 boundaries

- A project is private to the authenticated user who created it.
- Team membership, invitations, shared projects, roles, and organization accounts are outside this milestone.
- Project names are free text, trimmed to 1–100 characters. Food and Civil are examples, not seeded values or taxonomy entries.
- A user may create multiple projects. Names do not have to be globally unique.
- Every project-owned record has one required project ID; records cannot belong to multiple projects.
- MCP credentials are bound server-side to one project. MCP callers never supply or override a `projectId` tool argument.
- Existing global content must be migrated deliberately; it must not become visible in every project.

## Data ownership

PostgreSQL is authoritative for project identity and access:

```prisma
model Project {
  id        String   @id @default(cuid())
  ownerId   String
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  owner        User                   @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  conversations Conversation[]
  mcpCredentials ProjectMcpCredential[]

  @@index([ownerId, updatedAt])
}

model ProjectMcpCredential {
  id         String    @id @default(cuid())
  projectId  String
  label      String
  tokenHash  String    @unique
  tokenHint  String
  createdAt  DateTime  @default(now())
  lastUsedAt DateTime?
  revokedAt  DateTime?

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, revokedAt])
}
```

Add `projects Project[]` to `User` and a required `projectId` relation to `Conversation`. Messages inherit their project through the conversation.

Sanity remains authoritative for compliance documents and rules. Add a required `projectId` string to `complianceDocument` and `complianceRule`. This is an external PostgreSQL identifier, not a Sanity reference. Copy it from the selected project during ingestion and from the source document into every extracted rule. Studio validation must require it, and editors must not be able to move a rule to another project independently of its source document.

## Migration gate

Before making `projectId` required, inventory every existing:

- PostgreSQL conversation;
- Sanity compliance document;
- draft, published, and versioned compliance rule.

The operator must choose one destination project for each legacy record or explicitly remove it. The migration accepts an explicit mapping file from old record IDs to project IDs, validates that every destination project exists, performs a dry run, and stops on any unmapped or multiply mapped record. Do not infer a project from `industry`, title, owner email, or content text.

The dry run must also prove both ownership invariants before writing:

- every migrated conversation's `userId` equals the destination project's `ownerId`;
- every draft, published, and versioned rule is assigned to the same project as its referenced source document.

A record that violates either invariant blocks the migration and requires an explicit corrected mapping. Never repair it by copying a project ID from whichever side was read first.

After migration, add required constraints and indexes. Do not expose mixed scoped/unscoped reads during rollout.

## Project API

All endpoints require a valid Better-Auth session.

### `GET /api/projects`

Return only projects owned by `session.user.id`, ordered by `updatedAt desc`, then `id asc`.

```ts
type ProjectListResponse = {
  projects: Array<{
    id: string
    name: string
    createdAt: string
    updatedAt: string
  }>
}
```

### `POST /api/projects`

Request: `{ name: string }`. Trim and validate 1–100 characters. Return HTTP `201` with the created project. Duplicate names are allowed. Project creation must not seed documents, rules, or conversations.

### Project selection and URLs

Use project IDs in canonical application routes so selection survives refresh, sharing, and browser navigation:

- `/projects/[projectId]/chat`
- `/projects/[projectId]/chat/[conversationId]`
- `/projects/[projectId]/documents`

`/chat` and `/documents` redirect to the most recently updated owned project. If the user has no project, show the project creation state instead of inventing a project. A project ID not owned by the current user returns a non-enumerating `404`.

## Project-scoped application behavior

The selected project is resolved and authorized server-side before any Sanity, AI, Blob, or PostgreSQL work.

- Upload token requests and ingestion requests carry the selected project ID through an authorized server-controlled context.
- `complianceDocument.projectId` is written at document creation.
- Every extracted `complianceRule` copies the same project ID.
- Document list/detail and published-rule count queries require `$projectId`.
- Chat creates and appends only conversations in the selected project.
- Internal rule retrieval always filters `projectId == $projectId` before scoring.
- Rule projections/services verify that the dereferenced source document has the same project ID before returning its title or file URL; a mismatched rule is treated as invalid data, logged safely, and excluded.
- A conversation URL is valid only when its `conversation.projectId` and owner both match the route.
- Citations retain their originating project, rule, and document identifiers.
- Rate-limit policy remains per IP unless a later contract changes it.

Every shared service that reads a rule or document takes a required trusted `projectId`. Optional industry filtering remains a refinement inside the selected project and never substitutes for project scoping.

## MCP credentials and isolation

Replace the single global `MCP_TOOL_SECRET` runtime authorization path with project credentials stored as non-reversible hashes in PostgreSQL.

- Generate at least 32 random bytes and display the plaintext token once at creation.
- Store only a slow or keyed cryptographic hash, a short non-secret hint, label, timestamps, and project relation.
- Resolve the bearer token before constructing the MCP server.
- Reject missing, unknown, or revoked tokens with `401` before parsing MCP payloads.
- Bind the resolved `projectId` into all four tool handlers on the server; do not include `projectId` in tool input schemas.
- `get` tools return `NOT_FOUND` for IDs outside the credential's project.
- Logs may contain project ID and credential ID, but never plaintext tokens or hashes.
- Credential creation, listing, revocation, and rotation are available only to the owning authenticated user. Listing returns metadata, never token material.

Keep the four MCP tools read-only. Project scoping changes their authorization context, not their write capabilities.

## Sidebar and project creation UI

The authenticated application sidebar contains:

1. Current project name.
2. An **Add project** button.
3. The complete list of the user's projects.
4. Chat and Documents navigation for the selected project.

Selecting a project navigates to that project's last active primary page without leaking state from the previous project. The create dialog/form has one required name field, clear validation, submission progress, and safe retry behavior. On mobile, the project list remains reachable from the compact navigation in one interaction. Keyboard focus moves predictably when the project menu or create dialog opens and closes.

Empty states distinguish:

- no projects yet;
- selected project has no conversations;
- selected project has no documents.

## Security invariants

- Treat every route, body, query, and stored project ID as untrusted until ownership is verified.
- Never authorize from a client cookie containing only a selected project ID.
- Cross-project IDs return the same non-enumerating result as unknown IDs.
- Sanity queries include an indexed `_type` constraint and direct `projectId == $projectId` filter.
- Project A content must never be passed to Gemini while serving Project B.
- Project deletion is outside this milestone.

## Tasks

- [ ] Add the Prisma project and MCP credential models and migrate conversations.
- [ ] Add required project fields and validation to Sanity documents and rules.
- [ ] Build and dry-run the explicit legacy-record assignment migration.
- [ ] Implement project create/list and owner-resolution services.
- [ ] Move application routes and conversations to canonical project URLs.
- [ ] Scope ingestion, document reads, rule search, chat, citations, and Studio views.
- [ ] Replace global MCP authorization with project-bound credential resolution.
- [ ] Add the sidebar project list and accessible Add project flow.
- [ ] Audit every query and route for a required trusted project context.

## Manual checkpoint

1. Create Food and Civil projects and confirm both appear in the sidebar after refresh.
2. Upload and publish a different rule in each project.
3. Confirm Food Documents, Chat, conversations, and citations never return Civil content, and vice versa.
4. Try cross-project document, rule, and conversation IDs and confirm non-enumerating failures.
5. Create one MCP credential per project and confirm each sees only its project's published documents and rules.
6. Revoke one credential and confirm it immediately receives `401` while the other still works.
7. Confirm no MCP tool accepts a caller-controlled `projectId` and no write tool exists.
8. Check the sidebar and Add project flow at 320 px, tablet, and desktop widths with keyboard-only navigation.
9. Run Prisma validation/migration checks, `pnpm exec tsc --noEmit`, `pnpm build`, and `pnpm --dir sanity build`.

## Checkpoint record

- Date:
- Commit:
- Reviewer:
- Result: Pending
- Notes:
