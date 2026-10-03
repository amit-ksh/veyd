export type DemoPoint = { title: string; description: string };
export type DemoSlide = {
  id: string;
  question: string;
  answer: string;
  points?: DemoPoint[];
  flow?: DemoPoint[];
  note?: string;
  cover?: boolean;
  closing?: boolean;
};

// Static, authored presentation content. No private records or generated examples.
// Implementation evidence and verification limits: docs/16-public-demo-presentation.md.
export const demoSlides: readonly DemoSlide[] = [
  {
    id: "what-is-veyd",
    question: "What is Veyd?",
    answer: "A workspace that turns source documents into knowledge you can question, check and revisit.",
    cover: true,
    flow: [
      { title: "Bring the source", description: "Add PDFs to a project." },
      { title: "Review the knowledge", description: "AI drafts. A human publishes." },
      { title: "Put it to work", description: "Cited chat, handbooks and MCP." },
    ],
  },
  {
    id: "who-is-it-for",
    question: "Who is it for?",
    answer: "People who need to understand document-heavy subjects—and explain where an answer came from.",
    points: [
      { title: "Researchers", description: "Ask focused questions across reviewed project sources." },
      { title: "Practitioners", description: "Keep a reusable handbook close to the original evidence." },
      { title: "Builders", description: "Give compatible AI tools access to project knowledge." },
    ],
    note: "AI-assisted research, not a substitute for expert judgment or the original document.",
  },
  {
    id: "project-context",
    question: "How does context stay focused?",
    answer: "Each project has its own documents, conversations, handbook and MCP credentials.",
    points: [
      { title: "Food Safety", description: "An illustrative project for food-related sources and questions." },
      { title: "Civil Engineering", description: "A separate illustrative project with its own source context." },
    ],
    note: "Create or switch projects in the sidebar. These are examples, not live project data.",
  },
  {
    id: "pdf-ingestion",
    question: "How does a PDF become knowledge?",
    answer: "Give the document a name and upload its PDF. The original file stays connected to the extracted entries.",
    flow: [
      { title: "Validate", description: "PDF only · up to 10 MB · up to 100 pages." },
      { title: "Store", description: "Keep the original as a Sanity file asset." },
      { title: "Extract", description: "Gemini drafts entries with source evidence and pages." },
    ],
    note: "Extraction produces unpublished drafts—not automatically trusted knowledge.",
  },
  {
    id: "human-review",
    question: "Who decides what is trusted?",
    answer: "A human reviewer. AI can draft an entry; it cannot publish one.",
    flow: [
      { title: "Inspect", description: "Review the requirement, excerpt and page references in Studio." },
      { title: "Correct", description: "Check the original source and fix incomplete or inaccurate extraction." },
      { title: "Publish", description: "Reviewed entries become available to project retrieval." },
    ],
    note: "This is Veyd's editorial workflow in Sanity Studio, not the Sanity Workflows product.",
  },
  {
    id: "research-chat",
    question: "How does research chat answer?",
    answer: "Start with the project's published knowledge. Search externally when that knowledge is missing or stale.",
    flow: [
      { title: "Retrieve", description: "Search published, project-scoped Sanity entries first." },
      { title: "Research", description: "Firecrawl supplies external findings when needed." },
      { title: "Explain", description: "Gemini writes an answer with recorded citations." },
    ],
    note: "External sources are labeled official or secondary. Research does not silently add documents.",
  },
  {
    id: "chat-import",
    question: "Can a chat add a document?",
    answer: "Yes—with your confirmation. Attach a PDF or select a research-discovered PDF file card.",
    flow: [
      { title: "Choose", description: "Review the file, its source and the target project." },
      { title: "Confirm", description: "Use “Add to project knowledge” and confirm the import." },
      { title: "Review", description: "Open the imported document and review its extracted drafts." },
    ],
    note: "Web PDFs use Firecrawl retrieval and parsing. Failed or unavailable sources cannot be imported.",
  },
  {
    id: "source-citations",
    question: "Where did that answer come from?",
    answer: "Follow the citation back to the document, source location and evidence—not just a generated summary.",
    points: [
      { title: "Project evidence", description: "Document title, entry reference and physical PDF page numbers." },
      { title: "External evidence", description: "Source links and official/secondary labels when web research is used." },
    ],
    note: "A citation provides traceability. It does not independently guarantee a claim is correct.",
  },
  {
    id: "project-handbook",
    question: "How can you learn it over time?",
    answer: "Read an AI-drafted project handbook built from published sources, with an index and citations.",
    points: [
      { title: "Read", description: "One focused page at a time, contents navigation and source details." },
      { title: "Reuse", description: "The structured book is stored and reused while its sources stay unchanged." },
      { title: "Take it with you", description: "Download a PDF or a portable offline HTML edition." },
    ],
    note: "Source changes trigger a refresh. The generated handbook still needs reader review.",
  },
  {
    id: "saved-progress",
    question: "Can you pick up where you left off?",
    answer: "Previous chats stay with the project, and the reader remembers your position locally.",
    points: [
      { title: "Return to a conversation", description: "Reopen saved messages and their citation records from the sidebar." },
      { title: "Return to the book", description: "Continue reading without generating a new edition on every visit." },
    ],
    note: "Local reading progress is browser-specific; it is not a cross-device bookmark service.",
  },
  {
    id: "project-mcp",
    question: "Can other AI tools use it?",
    answer: "Veyd's custom MCP endpoint exposes read-only project knowledge to compatible bearer-token clients.",
    points: [
      { title: "Project-bound access", description: "Generate a credential for one project, copy it once and revoke it when needed." },
      { title: "Read, not write", description: "Retrieve published entries, document metadata and a current stored handbook." },
    ],
    note: "This is not Sanity Context MCP. Native OAuth connector setup is not implemented.",
  },
  {
    id: "document-removal",
    question: "What if a source no longer belongs?",
    answer: "Remove its active project context while preserving attribution in historical conversations.",
    points: [
      { title: "Active knowledge", description: "Remove the document and derived entries from current retrieval; invalidate the old handbook." },
      { title: "Historical evidence", description: "Keep citation-origin records so previous answers remain attributable." },
    ],
    note: "Removal cannot recall files or exported editions someone has already downloaded.",
  },
  {
    id: "sanity-foundation",
    question: "What does Sanity power?",
    answer: "The structured content foundation: original documents, linked evidence and human-reviewed knowledge.",
    points: [
      { title: "Content Lake + assets", description: "Store PDFs and structured entries with explicit source references." },
      { title: "Schemas + GROQ", description: "Model evidence and retrieve published content within a project." },
      { title: "Sanity Studio", description: "Give people a place to inspect, correct and publish AI drafts." },
    ],
    note: "The current build does not use Sanity Context, Knowledge Bases, Agent Actions or App SDK.",
  },
  {
    id: "ai-responsibilities",
    question: "Where does the AI fit?",
    answer: "Sanity holds the reviewed evidence. Gemini interprets it. Firecrawl brings in external sources.",
    flow: [
      { title: "Sanity", description: "Structured sources, references and publication." },
      { title: "Gemini", description: "PDF extraction, cited answers and handbook drafting." },
      { title: "Firecrawl", description: "Web research and public PDF retrieval/parsing." },
    ],
    note: "Projects, chat history and book snapshots live in PostgreSQL. AI output remains reviewable.",
  },
  {
    id: "try-veyd",
    question: "What should we try first?",
    answer: "Try one PDF: publish a reviewed entry, ask a question and open its handbook.",
    flow: [
      { title: "Create a project", description: "Add one non-sensitive PDF." },
      { title: "Review in Studio", description: "Verify its source; publish one entry." },
      { title: "Ask and revisit", description: "Check an answer's citation and open the book." },
    ],
    closing: true,
    note: "The live app requires sign-in and configured services.",
  },
];
