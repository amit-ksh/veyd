# Veyd demo runbook — DEV × Sanity

Use this as an **8-minute recording outline**, not a promise that every AI call will finish within the timestamp. The story is one source becoming a reviewed entry, a cited answer, and a reusable handbook. Open `/presentation` locally, or [the public presentation](https://veyd-seven.vercel.app/presentation) after deployment, then show the authenticated app and [Sanity Studio](https://sanity-zeta-six.vercel.app/).

## Prepare the real data

- Have one non-sensitive, text-readable PDF (10 MB / 100 pages maximum) whose source and page numbers you have checked. Prepare a **Food Safety** project with at least one published, human-reviewed entry and a generated handbook. Keep a second project such as **Civil Engineering** to show isolation. These are examples; use your actual project names on screen.
- Leave one draft ready for review in Studio. Open the original PDF at the cited page so the review is visible, not merely a click on Publish.
- For the Firecrawl segment, prepare an actual saved research chat that contains an **available PDF file card** from an official source. The card must have a working source link and must not already be imported. If upstream discovery is unavailable during recording, use a previously saved real card or omit that live segment; do not present AI-written card text as an import control.
- Open Veyd, `/presentation` locally (or publicly after deployment), and [Veyd Studio](https://sanity-zeta-six.vercel.app/) in separate tabs. For local Studio, use `pnpm sanity:studio` at `http://localhost:3333`. On a hosted recording, open the supplied Studio URL separately; the document row's existing localhost action is outside this presentation update.
- Check that Gemini, Firecrawl, Sanity, Blob, PostgreSQL and Redis are configured for the flows you will record. Keep credentials, the one-time MCP token, account email, and unrelated project records out of the capture. Record with a dedicated demo account and data you can show publicly.

## Record the story

| Approx. time | Show on screen | Say in one sentence |
| --- | --- | --- |
| 0:00 | `/presentation`: hero, **What is Veyd?**, **Why I built Veyd**, architecture and **How is Sanity used?**; open the app. | “I built Veyd to research, learn and reuse domain knowledge in one place, including the same context for agents.” |
| 0:30 | Sign in. In the sidebar, use **Project → Add** to show project creation, then switch between the two prepared projects. | “Each project keeps its documents, chats, handbook and MCP access separate.” |
| 1:10 | **Documents → Add a document**: name the PDF, select it, submit; show the processing/Ready state and **Open PDF**. | “The original PDF is kept as a Sanity file asset; AI extraction creates drafts.” |
| 2:00 | **Veyd Studio → Source Documents**: open the file record, processing status and project ID. Then **Rules Awaiting Review**: compare a draft's requirement, evidence excerpt and source pages with the PDF, correct it, set the review field and publish. Finish at **Published Rules**. | “Sanity holds the linked source and structured entry; a person checks the evidence before it becomes published knowledge.” |
| 3:10 | Back in **Research Chat**, ask a narrow question answered by the published entry. Open the citation and its PDF page. | “Chat retrieves published project content first, and each answer can point back to its source.” |
| 4:00 | In a project without relevant published entries, reopen the prepared research chat. Show the Firecrawl-backed PDF file card, its source link, **Add to project knowledge**, and the confirmation dialog. Then show the new document under **Documents**. | “External research stays separate until I confirm an import; the resulting entries still need review.” |
| 5:10 | Show **Attach PDF** as the second chat import path. Open **Previous chats** and return to the cited conversation. | “Chat can start from a local file or a discovered source, and the saved discussion remains with its project.” |
| 5:40 | Return to the prepared project's **Handbook**. Use **Contents**, page controls and a numbered reference; download **PDF** and **Offline** HTML. | “The cited book is stored and reused while its reviewed sources remain current.” |
| 6:35 | **Connect MCP**: show the project name, endpoint and existing credential metadata. In a preconfigured compatible MCP client, run one read-only lookup and show the returned published entry. | “The custom MCP endpoint reads this project's published knowledge.” |
| 7:20 | In a separate throwaway project, open a document's action menu and **Remove from project**; reopen an older cited chat if you prepared one. End on the `/presentation` closing slide. | “Removal clears active context while historical answers retain their source attribution.” |

Allow extra time for upload, extraction and first handbook generation. A shorter video can use a previously completed, real ingestion and show the review, cited answer and book in full. Do not imply that a prepared result was produced instantaneously in the recording.

## Sanity screens the judges should see

1. **Source Documents:** the original PDF asset, project ID, page count and processing state.
2. **Rules Awaiting Review:** a draft linked to its source document, with the requirement, evidence excerpt and physical source page numbers. Compare it with the PDF before publication.
3. **Published Rules:** the reviewed entry. Show that Research Chat uses it, while drafts are excluded from published retrieval.

These are the app's own Sanity schemas, Studio desk structure and GROQ-backed published reads. Gemini performs extraction, chat and handbook drafting; Firecrawl performs external research and public PDF retrieval/parsing. Veyd's project-scoped MCP endpoint is custom. Do not label it **Sanity Context**, a **Knowledge Base**, the **App SDK** or the Sanity **Workflows** product.

## Capture and publish checks

- Capture the public slide, project switch, PDF/source pair, Studio draft and published entry, cited chat answer, actionable research PDF card, handbook reference and PDF/HTML exports, and MCP result. Use those frames as the DEV post's screenshots or a short edited walkthrough.
- Show an actual generated file card, not a formatted block of model text. If a service fails, show the failure honestly and record the verified flow separately.
- Keep the app URL and Studio URL judge-accessible, prepare judge sign-in and Studio access instructions, and verify that the repository link is public before posting. A local `localhost` link will not work for judges.
- If you demonstrate token creation, pause or mask the one-time plaintext token before sharing the video. Show only endpoint and credential metadata publicly.
- Before submitting, review the [DEV post draft](devto-post-draft.md) and the [official challenge requirements](devto-challenge-research.md). The official rules list **October 4, 2026 at 11:59 PM PDT** as the deadline; the challenge page currently has inconsistent “Live Ended” status text, so verify the posting control directly.
