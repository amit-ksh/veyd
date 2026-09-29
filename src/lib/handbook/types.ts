export type HandbookCitation = {
  sourceKey: string;
  projectId: string;
  ruleId: string;
  documentId: string;
  documentTitle: string;
  citation: string;
  sourcePages: number[];
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
  schemaVersion: 1;
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
};

export type HandbookStatus = "generating" | "ready" | "empty" | "failed" | "missing" | "stale";

export type HandbookResponse =
  | { status: "ready"; handbook: ProjectHandbookSnapshot }
  | { status: "empty"; handbook: null }
  | {
      status: "missing" | "stale" | "generating" | "failed";
      handbook: null;
      retryAfterSeconds?: number;
    };
