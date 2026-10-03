export type DemoPoint = { title: string; description: string };

export type DemoSlide = {
  id: string;
  title: string;
  answer: string;
  kind?: "hero" | "architecture" | "closing";
  points?: DemoPoint[];
  flow?: DemoPoint[];
};

// Public, authored copy based on docs/devto-post-draft.md. No project records or credentials.
export const demoSlides: readonly DemoSlide[] = [
  {
    id: "hero",
    title: "Veyd",
    answer: "One knowledge base to research, learn, and build across domains.",
    kind: "hero",
  },
  {
    id: "what-is-veyd",
    title: "What is Veyd?",
    answer: "A project knowledge workspace that connects source documents to answers you can trace and revisit.",
    flow: [
      { title: "Collect", description: "Bring PDFs into a project." },
      { title: "Review", description: "Publish checked, structured knowledge." },
      { title: "Reuse", description: "Ask, read, and connect agents." },
    ],
  },
  {
    id: "why-veyd",
    title: "Why I built Veyd",
    answer: "I build software across different domains. Each project sends me back through scattered documents and repositories to learn the subject.",
    points: [
      { title: "One place to research", description: "Keep the useful sources and conversations together." },
      { title: "One context to reuse", description: "Return through a handbook or give an agent the same knowledge." },
    ],
  },
  {
    id: "architecture",
    title: "How is Veyd built?",
    answer: "Sanity connects source PDFs and human review to reusable project knowledge.",
    kind: "architecture",
  },
  {
    id: "sanity-foundation",
    title: "How is Sanity used?",
    answer: "Sanity is the source-and-review layer behind every reusable answer.",
    points: [
      { title: "Content Lake + assets", description: "Store original PDFs and linked, structured entries." },
      { title: "Sanity Studio", description: "Inspect AI drafts against the source, then publish reviewed entries." },
      { title: "GROQ", description: "Retrieve only published entries from the selected project." },
    ],
  },
  {
    id: "project-context",
    title: "How do projects stay focused?",
    answer: "Each project keeps its own documents, chats, handbook, and MCP access.",
    points: [
      { title: "Create a space", description: "Start a project for the domain you are learning." },
      { title: "Keep context separate", description: "Switch projects without mixing their source knowledge." },
    ],
  },
  {
    id: "pdf-ingestion",
    title: "How does a PDF become knowledge?",
    answer: "Upload a named PDF, check its AI-extracted entries in Studio, and publish what is correct.",
    flow: [
      { title: "Upload", description: "The original PDF becomes a Sanity asset." },
      { title: "Extract", description: "Gemini drafts entries with source evidence and pages." },
      { title: "Publish", description: "A person reviews the draft in Sanity Studio." },
    ],
  },
  {
    id: "research-chat",
    title: "How do you research?",
    answer: "Ask in chat. Veyd searches published project knowledge first and returns an answer with citations.",
    points: [
      { title: "Project evidence", description: "Follow citations to the document and source pages." },
      { title: "External discovery", description: "When needed, Firecrawl finds and labels outside sources." },
    ],
  },
  {
    id: "chat-import",
    title: "Can a chat add a source?",
    answer: "Attach a PDF or choose a discovered PDF card, then confirm that it should enter the project.",
    flow: [
      { title: "Discover", description: "See a file card in the research conversation." },
      { title: "Confirm", description: "Choose Add to project knowledge." },
      { title: "Review", description: "Check the extracted drafts before publication." },
    ],
  },
  {
    id: "project-handbook",
    title: "How do you learn over time?",
    answer: "A cited project handbook turns published knowledge into a book you can revisit.",
    points: [
      { title: "Read", description: "Move through focused pages, contents, and source references." },
      { title: "Take it with you", description: "Download PDF or portable offline HTML editions." },
    ],
  },
  {
    id: "project-mcp",
    title: "How do agents use the same context?",
    answer: "Connect a compatible AI client to Veyd's read-only, project-scoped MCP tools.",
    points: [
      { title: "Published knowledge", description: "Retrieve reviewed document and entry details." },
      { title: "Project handbook", description: "Read the current book index and sections." },
    ],
  },
  {
    id: "saved-progress",
    title: "How do you pick up again?",
    answer: "Reopen previous chats, continue your handbook, and manage the documents that form active context.",
    points: [
      { title: "Return", description: "Saved conversations retain their citations." },
      { title: "Keep it current", description: "Removing a document clears its active context and refreshes the book." },
    ],
  },
  {
    id: "try-veyd",
    title: "See Veyd in action",
    answer: "Add a source. Review what AI found. Ask a question and open the handbook.",
    kind: "closing",
  },
];
