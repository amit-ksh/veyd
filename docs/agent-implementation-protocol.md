# Feature Implementation Protocol for AI Agents

Use this protocol with the selected repository feature skill.

## 1. Establish the boundary

- Read the feature's milestone document completely.
- Inspect the current repository, dependency manifest, environment template, and directly affected code.
- Check the prior milestone's checkpoint record or verify its acceptance conditions yourself.
- List the files and public interfaces the feature actually needs. Preserve unrelated work.
- If the repository contradicts the milestone contract, follow the milestone and report the migration impact. If the contract itself leaves a product decision open, ask the user before coding.

Completion criterion: the entry conditions, affected interfaces, and non-goals are explicit.

## 2. Implement a vertical slice

- Implement the smallest end-to-end path that proves the feature's risky boundary first.
- Keep route handlers thin. Put reusable Sanity, AI, Blob, Redis, and MCP behavior in server-only library modules.
- Validate every external input and every model/API output at the boundary.
- Preserve the documented trust boundary: browser-safe configuration may reach clients; credentials and write-capable clients remain server-side.
- Handle expected failure states in the same change as the happy path.

Completion criterion: one real user flow reaches its durable outcome without mocks or placeholder responses.

## 3. Complete the feature contract

- Implement every task and invariant in the milestone document.
- Remove obsolete feature code only after its replacement compiles and its callers have moved.
- Keep types, API responses, stored data, and UI states aligned with the milestone.
- Do not broaden scope with authentication, workspaces, queues, taxonomies, extra tools, or automated test suites unless explicitly requested.

Completion criterion: every milestone task is implemented or identified as a user-approved exception.

## 4. Verify the checkpoint

- Run the milestone's type, build, schema, and manual checks.
- Do not substitute unit tests for the documented manual scenarios.
- Inspect resulting Sanity/Blob/Redis/upstream state where the scenario requires it.
- Record failures precisely, fix them, and repeat the affected checks.

Completion criterion: every required checkpoint item passes with observable evidence.

## 5. Hand off

- Summarize behavior delivered, important files, migrations, and environment/dependency changes.
- Report commands and manual scenarios run, including any checks that could not run.
- Update the milestone checkpoint record only when the user wants the repository to retain that evidence.
- Stop at the milestone boundary and wait for review before starting the next feature.

Completion criterion: another engineer or model can reproduce the result and knows whether the next milestone is unblocked.

