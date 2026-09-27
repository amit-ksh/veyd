/**
 * TypeScript types for Sanity Content Model (Milestone 2)
 * All types mirror the Sanity schemas in /sanity/schemaTypes
 */

export type ProcessingStatus = "processing" | "ready" | "failed";
export type FreshnessStatus = "current" | "stale" | "superseded";
export type SourceKind = "sanity" | "official-web" | "secondary-web";
export type MessageRole = "user" | "assistant";

export interface ComplianceDocumentListItem {
  _id: string;
  title: string;
  industry: string;
  originalFileName: string;
  fileSizeBytes: number;
  pageCount: number;
  processingStatus: ProcessingStatus;
  extractedRuleCount: number;
  publishedRuleCount?: number;
  uploadedAt: string;
  extractionCompletedAt?: string | null;
  failureMessage?: string | null;
  fileUrl?: string | null;
}

export interface ComplianceDocumentDetail {
  _id: string;
  title: string;
  industry: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  pageCount: number;
  processingStatus: ProcessingStatus;
  extractionModel?: string | null;
  extractedRuleCount: number;
  publishedRuleCount?: number;
  uploadedAt: string;
  extractionCompletedAt?: string | null;
  failureMessage?: string | null;
  fileUrl?: string | null;
}

export interface OperatorDraftRuleCounts {
  awaitingReviewTotal: number;
  draftsByDocument: Record<string, number>;
}

export interface ComplianceRuleSourceDocument {
  _id: string;
  title: string;
  fileUrl?: string | null;
}

export interface ComplianceRuleSearchResult {
  _id: string;
  _score?: number;
  ruleName: string;
  description: string;
  requirement: string;
  applicability: string;
  industry: string;
  jurisdiction: string;
  regulator?: string | null;
  citation: string;
  evidenceExcerpt: string;
  sourcePages: number[];
  keywords: string[];
  freshnessStatus: FreshnessStatus;
  effectiveDate?: string | null;
  expiresAt?: string | null;
  lastReviewedAt?: string | null;
  sourceDocument: ComplianceRuleSourceDocument | null;
}

export interface ComplianceRuleDetail {
  _id: string;
  ruleName: string;
  description: string;
  requirement: string;
  applicability: string;
  industry: string;
  jurisdiction: string;
  regulator?: string | null;
  citation: string;
  evidenceExcerpt: string;
  sourcePages: number[];
  keywords: string[];
  freshnessStatus: FreshnessStatus;
  effectiveDate?: string | null;
  expiresAt?: string | null;
  lastReviewedAt?: string | null;
  sourceDocument: ComplianceRuleSourceDocument | null;
}

export interface SanityCitation {
  _key: string;
  sourceKind: SourceKind;
  title: string;
  url?: string | null;
  ruleId?: string | null;
  documentId?: string | null;
  citation?: string | null;
}

export interface SanityConversation {
  _id: string;
  createdAt: string;
  updatedAt: string;
}

export interface SanityMessage {
  _id: string;
  role: MessageRole;
  content: string;
  clientMessageId?: string | null;
  createdAt: string;
  citations?: SanityCitation[] | null;
}

/**
 * A rule is externally stale when either condition is true:
 * - freshnessStatus !== "current"
 * - expiresAt !== undefined && expiresAt < today
 * No elapsed-time heuristic may mark a rule stale.
 */
export function isRuleStale(rule: { freshnessStatus: string; expiresAt?: string | null }): boolean {
  if (rule.freshnessStatus !== "current") return true;
  if (rule.expiresAt) {
    const today = new Date().toISOString().slice(0, 10);
    return rule.expiresAt < today;
  }
  return false;
}
