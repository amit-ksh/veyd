# Veyd

Veyd is a project-based document research application. Users ingest PDFs, explicitly review and publish selected AI-extracted entries as project owners in Veyd or review them in Sanity Studio, ask cited questions, and read persisted project handbooks. Projects, conversations and MCP credentials are user-owned and project-scoped.

The implementation contracts in `docs/` remain authoritative. AI extraction creates drafts; only human-reviewed published entries are active knowledge. Research does not autonomously import files, and MCP is read-only. The reader and application use text-based Veyd branding.

## Public presentation

The user requested a public, read-only web presentation for the DEV × Sanity Challenge: https://dev.to/challenges/sanity-2026-09-16. Its audience is hackathon viewers and judges. It explains what Veyd is, whom it helps, its implemented features, and Sanity's role. It uses Veyd and DEV × Sanity text branding. The user approved building directly in code, reusing the handbook aesthetic, with larger text, one question at a time and standard presentation page format.

Sanity Content Lake, file assets, structured schemas, GROQ and Studio are implemented. Gemini provides the app's AI generation; Firecrawl provides external research and PDF retrieval/parsing. The app's custom MCP server is not Sanity Context or a Sanity Knowledge Base. Do not claim use of unimplemented Sanity AI products, challenge qualification, awards or compliance certification.

The public presentation must not expose private project data, account details, credentials or unpublished content. No registration, submission, deployment or changes to stored source data are part of this milestone.
