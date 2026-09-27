---
name: compliance-mcp-server
description: Implement or audit the public bearer-protected MCP endpoint that exposes read-only published Sanity document and rule retrieval. Use for milestone 7 MCP work.
---

# Compliance MCP Server

Read the [shared protocol](../../../docs/agent-implementation-protocol.md) and [`docs/07-public-mcp-server.md`](../../../docs/07-public-mcp-server.md) completely.

## Approach

1. Reuse the published-query services already proven by the web app; move shared logic before registering tools.
2. Authenticate the HTTP request before transport parsing or tool dispatch. Keep `MCP_TOOL_SECRET` independent from every upstream credential.
3. Instantiate the SDK's stateless Streamable HTTP server/transport in the lifecycle supported by the installed SDK version.
4. Register exactly the four documented tools with strict Zod inputs and bounded pagination.
5. Translate expected failures into concise MCP tool errors and authentication failures into HTTP `401`.
6. Audit imports and runtime behavior to prove MCP cannot reach writes, uploads, extraction, Firecrawl, or conversation mutation.
7. Connect a real inspector/client and verify draft isolation rather than relying only on compilation.

## Invariants

- Published Sanity content is the only MCP data source.
- Missing or invalid bearer credentials execute no tool code.
- The endpoint has no permissive browser CORS requirement.
- Logs exclude secrets, full query text, and returned compliance content.

## Done

An authenticated client can use exactly four read tools, unauthenticated calls fail early, drafts remain invisible, and the milestone 7 import/capability audit passes.

