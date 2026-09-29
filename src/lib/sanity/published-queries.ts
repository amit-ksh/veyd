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
// 1. Documents Queries (Published perspective only, scoped to projectId)
// ============================================================================

export function buildDocumentListQuery(offset: number, limit: number) {
  const limitEnd = offset + limit;
  return defineQuery(`
    *[
      _type == "complianceDocument" &&
      !(_id in path("drafts.**")) &&
      projectId == $projectId &&
      (!defined($industry) || industry == $industry) &&
      (!defined($status) || processingStatus == $status)
    ]
    | order(uploadedAt desc)[${offset}...${limitEnd}] {
      _id, projectId, title, industry, originalFileName, fileSizeBytes, pageCount,
      processingStatus, extractedRuleCount, uploadedAt, extractionCompletedAt,
      failureMessage,
      "fileUrl": fileAsset.asset->url,
      "publishedRuleCount": count(*[_type == "complianceRule" && !(_id in path("drafts.**")) && projectId == $projectId && sourceDocument._ref == ^._id])
    }
  `);
}

export const publishedDocumentDetailQuery = defineQuery(`
  *[_type == "complianceDocument" && !(_id in path("drafts.**")) && _id == $documentId && projectId == $projectId][0] {
    _id, projectId, title, industry, originalFileName, mimeType, fileSizeBytes, pageCount,
    processingStatus, extractionModel, extractedRuleCount, uploadedAt,
    extractionCompletedAt, failureMessage,
    "fileUrl": fileAsset.asset->url,
    "publishedRuleCount": count(*[_type == "complianceRule" && !(_id in path("drafts.**")) && projectId == $projectId && sourceDocument._ref == ^._id])
  }
`);

export async function listPublishedDocuments(params: {
  projectId: string;
  industry?: string;
  status?: "processing" | "ready" | "failed";
  limit?: number;
  offset?: number;
}): Promise<ComplianceDocumentListItem[]> {
  const { projectId } = params;
  if (!projectId) {
    throw new Error("projectId is required for listPublishedDocuments");
  }

  const limit = Math.max(1, Math.min(50, params.limit ?? 20));
  const offset = Math.max(0, Math.min(500, params.offset ?? 0));

  const query = buildDocumentListQuery(offset, limit);
  return publishedClient.fetch<ComplianceDocumentListItem[]>(query, {
    projectId,
    industry: params.industry?.trim() || null,
    status: params.status || null,
  });
}

export async function getPublishedDocumentById(
  documentId: string,
  projectId: string
): Promise<ComplianceDocumentDetail | null> {
  if (!documentId || documentId.startsWith("drafts.") || !projectId) return null;
  return publishedClient.fetch<ComplianceDocumentDetail | null, { documentId: string; projectId: string }>(
    publishedDocumentDetailQuery,
    { documentId, projectId }
  );
}

// ============================================================================
// 2. Rules Queries (Published perspective only, scoped to projectId)
// ============================================================================

export function buildRuleSearchQuery(limit: number) {
  return defineQuery(`
    *[
      _type == "complianceRule" &&
      !(_id in path("drafts.**")) &&
      projectId == $projectId &&
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
      _id, projectId, _score, ruleName, description, requirement, applicability,
      industry, jurisdiction, regulator, citation, evidenceExcerpt,
      sourcePages, keywords, freshnessStatus, effectiveDate, expiresAt,
      lastReviewedAt,
      "sourceDocument": sourceDocument->{
        _id, projectId, title, "fileUrl": fileAsset.asset->url
      }
    }
  `);
}

export const publishedRuleDetailQuery = defineQuery(`
  *[_type == "complianceRule" && !(_id in path("drafts.**")) && _id == $ruleId && projectId == $projectId][0] {
    _id, projectId, ruleName, description, requirement, applicability,
    industry, jurisdiction, regulator, citation, evidenceExcerpt,
    sourcePages, keywords, freshnessStatus, effectiveDate, expiresAt,
    lastReviewedAt,
    "sourceDocument": sourceDocument->{
      _id, projectId, title, "fileUrl": fileAsset.asset->url
    }
  }
`);

export async function searchPublishedRules(params: {
  query: string;
  projectId: string;
  industry?: string;
  jurisdiction?: string;
  includeStale?: boolean;
  limit?: number;
}): Promise<ComplianceRuleSearchResult[]> {
  const { projectId } = params;
  if (!projectId) {
    throw new Error("projectId is required for searchPublishedRules");
  }

  const trimmed = params.query?.trim();
  if (!trimmed) return [];

  const rawLimit = Number.isInteger(params.limit) ? Number(params.limit) : 10;
  const targetLimit = Math.max(1, Math.min(20, rawLimit));

  const fetchLimit = params.includeStale ? targetLimit : Math.min(20, targetLimit * 2);
  const query = buildRuleSearchQuery(fetchLimit);

  const results = await publishedClient.fetch<
    ComplianceRuleSearchResult[],
    { searchQuery: string; projectId: string; industry: string | null; jurisdiction: string | null }
  >(query, {
    searchQuery: trimmed,
    projectId,
    industry: params.industry?.trim() || null,
    jurisdiction: params.jurisdiction?.trim() || null,
  });

  if (!results || results.length === 0) return [];

  // Filter out any rule where dereferenced sourceDocument belongs to another project
  const projectVerified = results.filter((r) => {
    if (r.sourceDocument && r.sourceDocument.projectId && r.sourceDocument.projectId !== projectId) {
      console.warn(`[SECURITY] Rule ${r._id} source document project mismatch: rule=${projectId}, doc=${r.sourceDocument.projectId}`);
      return false;
    }
    return true;
  });

  // Filter out stale rules unless explicitly requested
  const filtered = params.includeStale
    ? projectVerified
    : projectVerified.filter((r) => !isRuleStale(r));

  return filtered.slice(0, targetLimit);
}

export async function getPublishedRuleById(
  ruleId: string,
  projectId: string
): Promise<ComplianceRuleDetail | null> {
  if (!ruleId || ruleId.startsWith("drafts.") || !projectId) return null;
  const rule = await publishedClient.fetch<ComplianceRuleDetail | null, { ruleId: string; projectId: string }>(
    publishedRuleDetailQuery,
    { ruleId, projectId }
  );

  if (!rule) return null;

  // Invariant verification: dereferenced source document must belong to same project
  if (rule.sourceDocument && rule.sourceDocument.projectId && rule.sourceDocument.projectId !== projectId) {
    console.warn(`[SECURITY] Rule ${rule._id} source document project mismatch: rule=${projectId}, doc=${rule.sourceDocument.projectId}`);
    return null;
  }

  return rule;
}
