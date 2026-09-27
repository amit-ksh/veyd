export type CitationSourceKind = "sanity" | "official-web" | "secondary-web";

export type Citation = {
  sourceKind: CitationSourceKind;
  title: string;
  url?: string;
  ruleId?: string;
  documentId?: string;
  citation?: string;
};

export type SearchComplianceRulesInput = {
  query: string;
  industry?: string;
  jurisdiction?: string;
  limit?: number; // 1..10, default 5
};

export type ComplianceRuleItem = {
  ruleId: string;
  ruleName: string;
  citation: string;
  requirement: string;
  evidenceExcerpt: string;
  sourcePages?: number[];
  freshnessStatus: string;
  effectiveDate?: string;
  expiresAt?: string;
  lastReviewedAt?: string;
  industry?: string;
  jurisdiction?: string;
  regulator?: string;
  documentId?: string;
  documentTitle?: string;
  fileUrl?: string;
};

export type SearchComplianceRulesOutput = {
  classification: "current" | "stale" | "empty";
  summary: string;
  rules: ComplianceRuleItem[];
  error?: string;
};

export type SearchExternalRegulationsInput = {
  query: string;
  jurisdiction?: string;
  regulator?: string;
};

export type ExternalWebResultItem = {
  title: string;
  url: string;
  snippet: string;
  markdown: string;
  domain: string;
};

export type SearchExternalRegulationsOutput = {
  sourceKind: "official-web" | "secondary-web";
  warning?: string;
  results: ExternalWebResultItem[];
  error?: string;
};
