import { defineQuery } from "groq";
import { publishedClient } from "./clients";
import type {
  ComplianceDocumentListItem,
  ComplianceDocumentDetail,
  ComplianceRuleSearchResult,
  ComplianceRuleDetail,
  SanityConversation,
  SanityMessage,
} from "./types";

// Re-export types for convenient consumer access
export * from "./types";

// ============================================================================
// 1. Compliance Documents
// ============================================================================

export const documentListQuery = defineQuery(`
  *[_type == "complianceDocument"]
  | order(uploadedAt desc) {
    _id, title, industry, originalFileName, fileSizeBytes, pageCount,
    processingStatus, extractedRuleCount, uploadedAt, extractionCompletedAt,
    failureMessage
  }
`);

export const documentDetailQuery = defineQuery(`
  *[_type == "complianceDocument" && _id == $documentId][0] {
    _id, title, industry, originalFileName, mimeType, fileSizeBytes, pageCount,
    processingStatus, extractionModel, extractedRuleCount, uploadedAt,
    extractionCompletedAt, failureMessage,
    "fileUrl": fileAsset.asset->url
  }
`);

export async function getComplianceDocuments(): Promise<ComplianceDocumentListItem[]> {
  return publishedClient.fetch<ComplianceDocumentListItem[]>(documentListQuery);
}

export async function getComplianceDocumentById(
  documentId: string
): Promise<ComplianceDocumentDetail | null> {
  if (!documentId) return null;
  return publishedClient.fetch<ComplianceDocumentDetail | null, { documentId: string }>(
    documentDetailQuery,
    { documentId }
  );
}

// ============================================================================
// 2. Compliance Rules
// ============================================================================

/**
 * Ranked published-rule search.
 * Validates limit as an integer 1..20 and interpolates constant slice bounds.
 * Boosts: ruleName (4x), citation (3x), keywords (2x).
 */
export function complianceRuleSearchQuery(limit: number) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new Error("limit must be an integer from 1 through 20");
  }

  return defineQuery(`
    *[
      _type == "complianceRule" &&
      [ruleName, description, requirement, applicability, citation, keywords[]]
        match text::query($searchQuery)
    ]
    | score(
      boost(ruleName match text::query($searchQuery), 4),
      boost(citation match text::query($searchQuery), 3),
      boost(keywords[] match text::query($searchQuery), 2),
      [description, requirement, applicability] match text::query($searchQuery)
    )
    | order(_score desc)[0...${limit}] {
      _id, _score, ruleName, description, requirement, applicability,
      industry, jurisdiction, regulator, citation, evidenceExcerpt,
      sourcePages, keywords, freshnessStatus, effectiveDate, expiresAt,
      lastReviewedAt,
      "sourceDocument": sourceDocument->{
        _id, title, "fileUrl": fileAsset.asset->url
      }
    }
  `);
}

export const ruleDetailQuery = defineQuery(`
  *[_type == "complianceRule" && _id == $ruleId][0] {
    _id, ruleName, description, requirement, applicability,
    industry, jurisdiction, regulator, citation, evidenceExcerpt,
    sourcePages, keywords, freshnessStatus, effectiveDate, expiresAt,
    lastReviewedAt,
    "sourceDocument": sourceDocument->{
      _id, title, "fileUrl": fileAsset.asset->url
    }
  }
`);

export async function searchComplianceRules(
  query: string,
  limit: number = 10
): Promise<ComplianceRuleSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const validLimit = Math.max(1, Math.min(20, Math.floor(limit)));
  return publishedClient.fetch<ComplianceRuleSearchResult[], { searchQuery: string }>(
    complianceRuleSearchQuery(validLimit),
    { searchQuery: trimmed }
  );
}

export async function getComplianceRuleById(
  ruleId: string
): Promise<ComplianceRuleDetail | null> {
  if (!ruleId) return null;
  return publishedClient.fetch<ComplianceRuleDetail | null, { ruleId: string }>(
    ruleDetailQuery,
    { ruleId }
  );
}

// Backward-compatibility aliases for earlier callers
export const searchRules = searchComplianceRules;
export const getRuleById = getComplianceRuleById;
export const getRuleBySlug = getComplianceRuleById;

// ============================================================================
// 3. Conversations & Messages
// ============================================================================

export const conversationByIdQuery = defineQuery(`
  *[_type == "conversation" && _id == $conversationId][0] {
    _id, createdAt, updatedAt
  }
`);

export const messagesByConversationQuery = defineQuery(`
  *[_type == "message" && conversation._ref == $conversationId]
  | order(createdAt asc) {
    _id, role, content, createdAt,
    citations[]{_key, sourceKind, title, url, ruleId, documentId, citation}
  }
`);

export async function getConversationById(
  conversationId: string
): Promise<SanityConversation | null> {
  if (!conversationId) return null;
  return publishedClient.fetch<SanityConversation | null, { conversationId: string }>(
    conversationByIdQuery,
    { conversationId }
  );
}

export async function getMessagesByConversationId(
  conversationId: string
): Promise<SanityMessage[]> {
  if (!conversationId) return [];
  return publishedClient.fetch<SanityMessage[], { conversationId: string }>(
    messagesByConversationQuery,
    { conversationId }
  );
}
