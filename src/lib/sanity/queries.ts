import { defineQuery } from "groq";
import { publishedClient, writeClient } from "./clients";
import type {
  ComplianceDocumentListItem,
  ComplianceDocumentDetail,
  ComplianceRuleSearchResult,
  ComplianceRuleDetail,
  SanityConversation,
  SanityMessage,
  OperatorDraftRuleCounts,
} from "./types";

// Re-export types for convenient consumer access
export * from "./types";

// ============================================================================
// 1. Compliance Documents & Publication Counts
// ============================================================================

export const documentListQuery = defineQuery(`
  *[_type == "complianceDocument" && !(_id in path("drafts.**"))]
  | order(uploadedAt desc) {
    _id, title, industry, originalFileName, fileSizeBytes, pageCount,
    processingStatus, extractedRuleCount, uploadedAt, extractionCompletedAt,
    failureMessage,
    "fileUrl": fileAsset.asset->url,
    "publishedRuleCount": count(*[_type == "complianceRule" && !(_id in path("drafts.**")) && sourceDocument._ref == ^._id])
  }
`);

export const documentDetailQuery = defineQuery(`
  *[_type == "complianceDocument" && !(_id in path("drafts.**")) && _id == $documentId][0] {
    _id, title, industry, originalFileName, mimeType, fileSizeBytes, pageCount,
    processingStatus, extractionModel, extractedRuleCount, uploadedAt,
    extractionCompletedAt, failureMessage,
    "fileUrl": fileAsset.asset->url,
    "publishedRuleCount": count(*[_type == "complianceRule" && !(_id in path("drafts.**")) && sourceDocument._ref == ^._id])
  }
`);

export const publishedRuleCountByDocumentQuery = defineQuery(`
  count(*[_type == "complianceRule" && !(_id in path("drafts.**")) && sourceDocument._ref == $documentId])
`);

export const publishedRuleCountsByDocumentQuery = defineQuery(`
  *[_type == "complianceDocument" && !(_id in path("drafts.**"))] {
    _id,
    "publishedRuleCount": count(*[_type == "complianceRule" && !(_id in path("drafts.**")) && sourceDocument._ref == ^._id])
  }
`);

import {
  listPublishedDocuments,
  getPublishedDocumentById,
  searchPublishedRules,
  getPublishedRuleById,
} from "./published-queries";

export {
  listPublishedDocuments,
  getPublishedDocumentById,
  searchPublishedRules,
  getPublishedRuleById,
};

export async function getComplianceDocuments(): Promise<ComplianceDocumentListItem[]> {
  return listPublishedDocuments({ limit: 50 });
}

export async function getComplianceDocumentById(
  documentId: string
): Promise<ComplianceDocumentDetail | null> {
  return getPublishedDocumentById(documentId);
}

export async function getPublishedRuleCountByDocumentId(
  documentId: string
): Promise<number> {
  if (!documentId) return 0;
  return publishedClient.fetch<number, { documentId: string }>(
    publishedRuleCountByDocumentQuery,
    { documentId }
  );
}

export async function getPublishedRuleCountsByDocument(): Promise<Record<string, number>> {
  const list = await publishedClient.fetch<Array<{ _id: string; publishedRuleCount: number }>>(
    publishedRuleCountsByDocumentQuery
  );
  const map: Record<string, number> = {};
  for (const item of list) {
    map[item._id] = item.publishedRuleCount;
  }
  return map;
}

/**
 * Operator-only server-side draft counts.
 * Uses writeClient to query draft perspective without leaking the write token to clients.
 */
export async function getOperatorDraftRuleCounts(): Promise<OperatorDraftRuleCounts> {
  const drafts = await writeClient.fetch<Array<{ _id: string; sourceDocId?: string }>>(
    `*[_type == "complianceRule" && (_id in path("drafts.**") || !defined(lastReviewedAt))] {
      _id,
      "sourceDocId": sourceDocument._ref
    }`
  );

  const draftsByDocument: Record<string, number> = {};
  for (const d of drafts) {
    if (d.sourceDocId) {
      draftsByDocument[d.sourceDocId] = (draftsByDocument[d.sourceDocId] || 0) + 1;
    }
  }

  return {
    awaitingReviewTotal: drafts.length,
    draftsByDocument,
  };
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
      !(_id in path("drafts.**")) &&
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
  *[_type == "complianceRule" && !(_id in path("drafts.**")) && _id == $ruleId][0] {
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
  return searchPublishedRules({ query, limit, includeStale: true });
}

export async function getComplianceRuleById(
  ruleId: string
): Promise<ComplianceRuleDetail | null> {
  return getPublishedRuleById(ruleId);
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
