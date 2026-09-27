import { defineQuery } from "groq";
import { publishedClient } from "./clients";
import { isRuleStale } from "./types";
import type {
  ComplianceDocumentListItem,
  ComplianceDocumentDetail,
  ComplianceRuleSearchResult,
  ComplianceRuleDetail,
} from "./types";

export * from "./types";

if (typeof window !== "undefined") {
  throw new Error("Cannot import published Sanity queries in client-side code");
}

// ============================================================================
// 1. Documents Queries (Published perspective only)
// ============================================================================

export function buildDocumentListQuery(offset: number, limit: number) {
  const limitEnd = offset + limit;
  return defineQuery(`
    *[
      _type == "complianceDocument" &&
      !(_id in path("drafts.**")) &&
      (!defined($industry) || industry == $industry) &&
      (!defined($status) || processingStatus == $status)
    ]
    | order(uploadedAt desc)[${offset}...${limitEnd}] {
      _id, title, industry, originalFileName, fileSizeBytes, pageCount,
      processingStatus, extractedRuleCount, uploadedAt, extractionCompletedAt,
      failureMessage,
      "publishedRuleCount": count(*[_type == "complianceRule" && !(_id in path("drafts.**")) && sourceDocument._ref == ^._id])
    }
  `);
}

export const publishedDocumentDetailQuery = defineQuery(`
  *[_type == "complianceDocument" && !(_id in path("drafts.**")) && _id == $documentId][0] {
    _id, title, industry, originalFileName, mimeType, fileSizeBytes, pageCount,
    processingStatus, extractionModel, extractedRuleCount, uploadedAt,
    extractionCompletedAt, failureMessage,
    "fileUrl": fileAsset.asset->url,
    "publishedRuleCount": count(*[_type == "complianceRule" && !(_id in path("drafts.**")) && sourceDocument._ref == ^._id])
  }
`);

export async function listPublishedDocuments(params?: {
  industry?: string;
  status?: "processing" | "ready" | "failed";
  limit?: number;
  offset?: number;
}): Promise<ComplianceDocumentListItem[]> {
  const limit = Math.max(1, Math.min(50, params?.limit ?? 20));
  const offset = Math.max(0, Math.min(500, params?.offset ?? 0));

  const query = buildDocumentListQuery(offset, limit);
  return publishedClient.fetch<ComplianceDocumentListItem[]>(query, {
    industry: params?.industry?.trim() || null,
    status: params?.status || null,
  });
}

export async function getPublishedDocumentById(
  documentId: string
): Promise<ComplianceDocumentDetail | null> {
  if (!documentId || documentId.startsWith("drafts.")) return null;
  return publishedClient.fetch<ComplianceDocumentDetail | null, { documentId: string }>(
    publishedDocumentDetailQuery,
    { documentId }
  );
}

// ============================================================================
// 2. Rules Queries (Published perspective only)
// ============================================================================

export function buildRuleSearchQuery(limit: number) {
  return defineQuery(`
    *[
      _type == "complianceRule" &&
      !(_id in path("drafts.**")) &&
      (!defined($industry) || industry == $industry) &&
      (!defined($jurisdiction) || jurisdiction == $jurisdiction) &&
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

export const publishedRuleDetailQuery = defineQuery(`
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

export async function searchPublishedRules(params: {
  query: string;
  industry?: string;
  jurisdiction?: string;
  includeStale?: boolean;
  limit?: number;
}): Promise<ComplianceRuleSearchResult[]> {
  const trimmed = params.query?.trim();
  if (!trimmed) return [];

  const rawLimit = Number.isInteger(params.limit) ? Number(params.limit) : 10;
  const targetLimit = Math.max(1, Math.min(20, rawLimit));

  // If excluding stale rules, fetch extra candidate rules to allow post-filtering
  const fetchLimit = params.includeStale ? targetLimit : Math.min(20, targetLimit * 2);
  const query = buildRuleSearchQuery(fetchLimit);

  const results = await publishedClient.fetch<
    ComplianceRuleSearchResult[],
    { searchQuery: string; industry: string | null; jurisdiction: string | null }
  >(query, {
    searchQuery: trimmed,
    industry: params.industry?.trim() || null,
    jurisdiction: params.jurisdiction?.trim() || null,
  });

  if (!results || results.length === 0) return [];

  // Filter out stale rules unless explicitly requested
  const filtered = params.includeStale
    ? results
    : results.filter((r) => !isRuleStale(r));

  return filtered.slice(0, targetLimit);
}

export async function getPublishedRuleById(
  ruleId: string
): Promise<ComplianceRuleDetail | null> {
  if (!ruleId || ruleId.startsWith("drafts.")) return null;
  return publishedClient.fetch<ComplianceRuleDetail | null, { ruleId: string }>(
    publishedRuleDetailQuery,
    { ruleId }
  );
}
