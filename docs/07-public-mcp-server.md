# Milestone 7 — Bearer-Protected Read-Only MCP Server

## Outcome

Expose published Sanity knowledge to external MCP clients through `/api/mcp`. The server is stateless, read-only, bearer-protected, and shares retrieval code with the web application.

## Transport and authentication

- Use `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`.
- Use the SDK's stateless Streamable HTTP transport suitable for Web Standard requests.
- Accept MCP requests at `POST /api/mcp`.
- Return method-not-allowed for unsupported transport methods unless the selected SDK requires a specific GET/DELETE response for capability negotiation.
- Require `Authorization: Bearer <MCP_TOOL_SECRET>` before parsing or dispatching the MCP request.
- Compare the supplied secret without logging it and use a timing-safe comparison when values have equal byte length.
- Return HTTP `401` with `WWW-Authenticate: Bearer` for missing or invalid credentials.

Do not reuse the MCP bearer secret for Sanity, Gemini, Firecrawl, Blob, or Redis.

## Shared service boundary

MCP tools call the same published Sanity query services used by chat and document pages. Tool handlers must not contain duplicate GROQ strings or instantiate a draft-capable client.

The MCP module must have no imports from:

- `writeClient`.
- Sanity mutation/action helpers.
- Gemini or Firecrawl clients.
- Blob upload/delete functions.
- Conversation/message writers.

## Tool contracts

### `search_compliance_rules`

Input:

```ts
{
  query: string
  industry?: string
  jurisdiction?: string
  includeStale?: boolean // default false
  limit?: number         // 1..20, default 10
}
```

Output contains ranked published rules and their source-document metadata. With `includeStale: false`, exclude `stale`, `superseded`, and expired rules. Never expose evidence outside the published rule projection.

### `get_compliance_rule`

Input: `{ ruleId: string }`.

Output: one complete published rule projection or a tool error with code `NOT_FOUND`.

### `list_compliance_documents`

Input:

```ts
{
  industry?: string
  status?: "processing" | "ready" | "failed"
  limit?: number  // 1..50, default 20
  offset?: number // 0..500, default 0
}
```

Output contains document metadata only. Do not include failure stack traces, tokens, or draft rule IDs.

### `get_compliance_document`

Input: `{ documentId: string }`.

Output contains the document detail projection and durable Sanity file URL. It does not return PDF bytes inline.

## Error mapping

Invalid tool input is rejected by Zod before the handler. Expected handler errors return a concise MCP tool error payload with a stable code. Unexpected failures are logged with a correlation ID and return `INTERNAL_ERROR` without internal messages.

Authentication failures are HTTP failures. Tool validation, not-found, and Sanity failures are MCP results so compatible clients can display them correctly.

## Operational behavior

- Create a fresh stateless server/transport per request unless the exact installed SDK documents a safe reusable stateless instance.
- Set a request timeout and abort Sanity work on disconnect where supported.
- Log authentication outcome, tool name, duration, result count, and error code. Do not log secrets, full query text, or returned compliance content.
- Set `Cache-Control: no-store` on MCP responses.
- Do not enable permissive cross-origin browser access; MCP clients call the server directly.

## Tasks

- [x] Extract shared published-query services from chat/document routes.
- [x] Implement strict bearer authentication.
- [x] Register the four tools with exact Zod input schemas.
- [x] Add stateless Streamable HTTP request handling.
- [x] Add safe MCP error translation and structured logging.
- [x] Confirm no write-capable dependency is reachable from the MCP module.

## Manual checkpoint

1. Connect an MCP inspector/client with the correct bearer secret and list all four tools.
2. Search and fetch a published rule and document.
3. Confirm a draft-only rule cannot be found.
4. Confirm stale rules are hidden by default and included only when requested.
5. Call without a token and with a bad token; confirm `401` and no tool execution.
6. Inspect the advertised tools and source imports; confirm there are no write, upload, extraction, web-research, or conversation tools.
7. Run type-check and production build.

## Checkpoint record

- Date: 2026-09-27
- Commit: 927525a
- Reviewer: Automated agent verification & manual checklist
- Result: Passed
- Notes:
  - Verified timing-safe bearer authentication: returns 401 with `WWW-Authenticate: Bearer realm="Compliance MCP"` for missing or invalid tokens before transport initialization.
  - Connected MCP client via `StreamableHTTPClientTransport` at `http://localhost:3000/api/mcp` and verified all 4 tools: `search_compliance_rules`, `get_compliance_rule`, `list_compliance_documents`, `get_compliance_document`.
  - Tested search, rule retrieval, and document listing/retrieval against published Sanity dataset.
  - Verified draft isolation: accessing draft documents or draft rules explicitly returns `isError: true` with code `NOT_FOUND`.
  - Stale rules are excluded by default in `search_compliance_rules` unless `includeStale: true` is passed.
  - Audited source imports: 0 write client, upload, Gemini extraction, Firecrawl, or conversation persistence dependencies reachable from `src/app/api/mcp` or `src/lib/mcp`.
  - Passed `pnpm exec tsc --noEmit` and `pnpm build` with zero errors.

