# DEV × Sanity Challenge: submission facts for Veyd

Checked 2026-10-03 against the [official challenge page](https://dev.to/challenges/sanity-2026-09-16), its [contest-specific rules](https://dev.to/page/sanity-challenge-v26-09-16-contest-rules), and [Sanity Context documentation](https://www.sanity.io/docs/ai/sanity-context). This is research for the demo and DEV post, not a submitted entry.

## Deadline and entry format

- The rules give **October 4, 2026 at 11:59 PM PDT** as the entry deadline (October 5 at 12:29 PM IST). The challenge page currently displays both “Live” and “Ended” beside its status, despite this dated rule. Check the actual DEV submission control before relying on the deadline. [Rules](https://dev.to/page/sanity-challenge-v26-09-16-contest-rules), [challenge page](https://dev.to/challenges/sanity-2026-09-16).
- Publish a DEV post using the selected path's **Submission Template** and the required `#sanitychallenge` tag. The Path Two template prepopulates `devchallenge`, `sanitychallenge`, `sanity`, and `ai`. One submission is allowed per path; both paths require separate posts. [Challenge page](https://dev.to/challenges/sanity-2026-09-16), [rules](https://dev.to/page/sanity-challenge-v26-09-16-contest-rules).
- Every entry must include its **Sanity project ID or a public dataset URL**. If judges must sign in to test the app, the page asks for testing credentials **and/or instructions**. Do not put production credentials or API tokens in a public post. [Challenge page](https://dev.to/challenges/sanity-2026-09-16), [rules](https://dev.to/page/sanity-challenge-v26-09-16-contest-rules).
- The Path Two template asks for: **What I Built**, **Demo** (deployed app link plus walkthrough video or screenshots), **Code** (repository link), **My Build Process** (AI-native IDE, prompts that worked and failed, course corrections), and **Sanity Project Details**. An embedded agent session is optional; if used, it must be made public to judges and reviewed for secrets first. [Path Two template on the challenge page](https://dev.to/challenges/sanity-2026-09-16).
- For a team entry, one person publishes and lists collaborators' DEV handles. Nontrivial borrowed open source work must be credited. [Challenge page](https://dev.to/challenges/sanity-2026-09-16).

## Which path the current app can describe accurately

**Path Two is the plausible presentation target, conditional on an honest build-process account.** Its judging criteria are the build writeup, functionality, schema thoughtfulness, and originality. App SDK and Sanity Workflows are explicitly encouraged bonuses, not requirements. Veyd's current repo has a Next.js UI, Sanity document/rule schemas, published GROQ reads, and a Sanity Studio editorial workflow. AI extraction/chat/handbook generation use Gemini; external research/PDF parsing uses Firecrawl. See `src/lib/sanity/clients.ts`, `src/lib/sanity/published-queries.ts`, `src/lib/mcp/tools.ts`, `src/app/api/mcp/route.ts`, and `docs/16-public-demo-presentation.md`. [Challenge page](https://dev.to/challenges/sanity-2026-09-16).

**Do not describe Veyd as a Sanity Context or Knowledge Bases integration.** Path One asks for an agent connected to a *Sanity Context MCP* backed by a Knowledge Base; the challenge also accepts a Context MCP over the full dataset with embeddings enabled. Sanity describes Context as its hosted MCP service. Veyd instead implements its own project-scoped, bearer-protected MCP endpoint over published Sanity queries. Its Sanity Content Lake, Studio, schemas, and GROQ usage are real, but they do not establish Path One's Context requirement. See `src/lib/mcp/tools.ts`, `src/app/api/mcp/route.ts`, and `docs/16-public-demo-presentation.md`. [Challenge page](https://dev.to/challenges/sanity-2026-09-16), [Sanity Context](https://www.sanity.io/docs/ai/sanity-context), [Knowledge Bases](https://www.sanity.io/docs/ai/sanity-context-knowledge-bases).

For the article, describe the app's own draft → human review → publication steps as an editorial process in **Sanity Studio**. Do not call them the separate Sanity **Workflows** product. Likewise, do not claim Sanity Agent Actions, App SDK, or native Context MCP unless the implementation is later changed and reverified. [Challenge page](https://dev.to/challenges/sanity-2026-09-16); current code and `docs/16-public-demo-presentation.md`.

## Verified links and remaining author inputs

- The user supplied [the public app URL](https://veyd-seven.vercel.app/); a read-only HTTP check on 2026-10-03 returned 200. The expected `/demo` route returned 404 and needs deployment and recheck before appearing as a live link in the post.
- The repository remote is [github.com/amit-ksh/veyd](https://github.com/amit-ksh/veyd); verify that judges can open it. The Sanity project ID in the local Studio configuration is `erhznx84`; verify the deployed environment uses the same ID and reveals only intended content.
- Add a real screenshot or short walkthrough video, plus judge access instructions for the authenticated app and Studio through an appropriate channel. Do not put production credentials or API tokens in a public post.
- The article includes genuine milestone/prompt direction and course corrections from this project's build history, not a manufactured verbatim transcript.

Sources accessed 2026-10-03. The challenge page's “Live Ended” status text is internally ambiguous; the rules provide the exact dated deadline. This note does not determine eligibility or submission acceptance.
