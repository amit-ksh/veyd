---
name: compliance-project-context
description: Implement or audit user-owned application projects, project-scoped content and conversations, sidebar project creation/listing, and project-bound MCP credentials for the compliance app. Use for milestone 11.
---

# Compliance Project Context

Implement one isolation boundary shared by PostgreSQL, Sanity, application routes, AI retrieval, and MCP.

1. Read [`docs/11-project-context-and-mcp-scope.md`](../../../docs/11-project-context-and-mcp-scope.md) and the shared implementation protocol completely.
2. Inventory every current route, query, mutation, conversation service, citation, and MCP tool that reads or writes project-owned data. Completion means every path is classified as scoped or intentionally global.
3. Add PostgreSQL project ownership and project-bound MCP credentials. Store token hashes only and show plaintext tokens once.
4. Add required Sanity `projectId` fields and build the explicit legacy-record assignment migration. Stop for operator input on every unmapped record; never infer scope from content.
5. Thread a trusted, server-authorized project ID through ingestion, documents, chat, conversations, citations, and MCP. MCP tool schemas must not accept project IDs.
6. Add canonical project routes plus the accessible sidebar list and Add project flow.
7. Prove isolation with Food and Civil projects across app and MCP checkpoint scenarios. Fix any cross-project visibility before handoff.

Keep team sharing, roles, project deletion, global search, and cross-project chat outside this milestone. Stop after the milestone checkpoint.

