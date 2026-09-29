# Repository Agent Instructions

Implement this application one milestone at a time. The technical contracts in [`docs/`](docs/) are authoritative; existing code is evidence of the current state, not permission to change the target behavior.

Before implementing a feature, read:

1. [`docs/README.md`](docs/README.md).
2. [The shared implementation protocol](docs/agent-implementation-protocol.md).
3. The matching feature skill and milestone document below.

| Request | Skill | Technical contract |
| --- | --- | --- |
| Dependencies, environment, local startup | [`$compliance-app-setup`](.agents/skills/compliance-app-setup/SKILL.md) | [`docs/00-dependencies-and-running.md`](docs/00-dependencies-and-running.md) |
| Shared clients, errors, rate limiting, shell | [`$compliance-foundation`](.agents/skills/compliance-foundation/SKILL.md) | [`docs/01-architecture-overview.md`](docs/01-architecture-overview.md) |
| Sanity schemas and GROQ | [`$sanity-compliance-model`](.agents/skills/sanity-compliance-model/SKILL.md) | [`docs/02-sanity-schema-design.md`](docs/02-sanity-schema-design.md) |
| PDF upload and rule extraction | [`$pdf-rule-ingestion`](.agents/skills/pdf-rule-ingestion/SKILL.md) | [`docs/03-api-implementation.md`](docs/03-api-implementation.md) |
| Studio review and publication | [`$rule-review-publication`](.agents/skills/rule-review-publication/SKILL.md) | [`docs/04-rule-review-and-publication.md`](docs/04-rule-review-and-publication.md) |
| Sanity-first research chat | [`$compliance-research-chat`](.agents/skills/compliance-research-chat/SKILL.md) | [`docs/05-compliance-research-chat.md`](docs/05-compliance-research-chat.md) |
| Conversation storage and reopening | [`$conversation-persistence`](.agents/skills/conversation-persistence/SKILL.md) | [`docs/06-conversation-persistence.md`](docs/06-conversation-persistence.md) |
| Public read-only MCP endpoint | [`$compliance-mcp-server`](.agents/skills/compliance-mcp-server/SKILL.md) | [`docs/07-public-mcp-server.md`](docs/07-public-mcp-server.md) |
| Dashboard and responsive UI | [`$compliance-dashboard-ui`](.agents/skills/compliance-dashboard-ui/SKILL.md) | [`docs/08-dashboard-ui.md`](docs/08-dashboard-ui.md) |
| Vercel/Sanity deployment and operations | [`$compliance-deployment`](.agents/skills/compliance-deployment/SKILL.md) | [`docs/09-deployment-and-operations.md`](docs/09-deployment-and-operations.md) |
| Final manual release checks | [`$compliance-manual-acceptance`](.agents/skills/compliance-manual-acceptance/SKILL.md) | [`docs/10-manual-acceptance-checklist.md`](docs/10-manual-acceptance-checklist.md) |
| User-owned projects, sidebar project list/add, project-scoped MCP | [`$compliance-project-context`](.agents/skills/compliance-project-context/SKILL.md) | [`docs/11-project-context-and-mcp-scope.md`](docs/11-project-context-and-mcp-scope.md) |
| Remove a document and its active context while preserving citation origins | [`$compliance-document-removal`](.agents/skills/compliance-document-removal/SKILL.md) | [`docs/12-document-context-removal.md`](docs/12-document-context-removal.md) |
| Automatically generated cited project handbook, book index, reading progress, PDF | [`$compliance-project-handbook`](.agents/skills/compliance-project-handbook/SKILL.md) | [`docs/13-project-handbook.md`](docs/13-project-handbook.md) |

## Using these skills with any model

- In a client that supports repository skills, invoke the listed `$skill-name` directly.
- In any other coding agent, prompt it to read `AGENTS.md`, then the selected `.agents/skills/<name>/SKILL.md`, then the linked milestone document before editing code.
- Ask the model to implement only that milestone and stop after reporting its manual checkpoint evidence.

Preserve these repository-wide rules:

- Ask before resolving a product decision that the milestone documents do not settle.
- Complete and report one milestone checkpoint before starting the next milestone.
- Implement core application code only. Do not add unit-test or integration-test suites unless the user changes that scope.
- Preserve unrelated user changes and do not rewrite secrets in `.env`.
- Use `.env.example` for variable names and placeholders; never commit credentials.
