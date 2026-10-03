export type HandbookCitation = {
  sourceKey: string;
  projectId: string;
  ruleId: string;
  documentId: string;
  documentTitle: string;
  citation: string;
  sourcePages: number[];
  sourceUrl?: string;
  evidenceExcerpt?: string;
  documentRevision?: string;
  ruleRevision?: string;
  lastReviewedAt?: string;
  freshness?: "current" | "review-required";
};

export type HandbookRuleSection = {
  anchor: string;
  number: string;
  ruleName: string;
  description: string;
  requirement: string;
  applicability: string;
  jurisdiction: string;
  regulator?: string;
  effectiveDate?: string;
  expiresAt?: string;
  freshness: "current" | "review-required";
  keywords: string[];
  sourceKey: string;
};

export type HandbookChapter = {
  anchor: string;
  number: string;
  documentId: string;
  title: string;
  industry: string;
  currentRules: HandbookRuleSection[];
  reviewRequiredRules: HandbookRuleSection[];
};

export type SubjectIndexEntry = {
  term: string;
  targets: Array<{
    anchor: string;
    sectionNumber: string;
  }>;
};

export type ProjectHandbookSnapshot = {
  schemaVersion: 2;
  projectId: string;
  projectName: string;
  sourceFingerprint: string;
  generatedAt: string;
  documentCount: number;
  ruleCount: number;
  currentRuleCount: number;
  reviewRequiredRuleCount: number;
  chapters: HandbookChapter[];
  citations: HandbookCitation[];
  subjectIndex: SubjectIndexEntry[];
  reader?: HandbookReader;
};

export type HandbookBlock = {
  kind: "paragraph" | "list" | "formula" | "warning";
  label: string;
  text: string;
  items: string[];
  evidence: "source-backed" | "example" | "recommendation" | "limitation";
  sourceKeys: string[];
};

export type HandbookFigure = {
  title: string;
  caption: string;
  steps: string[];
  sourceKeys: string[];
};

export type HandbookPage = {
  id: string;
  kind: "cover" | "contents" | "chapter" | "content";
  title: string;
  chapter: string;
  blocks: HandbookBlock[];
  figure?: HandbookFigure;
  entries?: Array<{ title: string; page: number }>;
};

export type HandbookReader = {
  title: string;
  purpose: string;
  audience: string;
  scope: string;
  model: string;
  generatorVersion: string;
  limitations: string[];
  pages: HandbookPage[];
  contents: Array<{ title: string; page: number }>;
};

export type HandbookStatus =
  "generating" | "ready" | "empty" | "failed" | "missing" | "stale";

export type HandbookResponse =
  | { status: "ready"; handbook: ProjectHandbookSnapshot }
  | { status: "empty"; handbook: null }
  | {
      status: "missing" | "stale" | "generating" | "failed";
      handbook: null;
      retryAfterSeconds?: number;
    };
