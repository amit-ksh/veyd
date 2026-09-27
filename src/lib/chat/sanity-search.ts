import { defineQuery } from "groq";
import { publishedClient } from "../sanity/clients";
import type {
  SearchComplianceRulesInput,
  SearchComplianceRulesOutput,
  ComplianceRuleItem,
} from "./types";

if (typeof window !== "undefined") {
  throw new Error("Cannot import server sanity-search in client-side code");
}

function buildSearchQuery(limit: number) {
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

export async function searchComplianceRulesForChat(
  input: SearchComplianceRulesInput
): Promise<SearchComplianceRulesOutput> {
  const trimmedQuery = input.query?.trim();
  if (!trimmedQuery) {
    return {
      classification: "empty",
      summary: "Empty search query provided.",
      rules: [],
    };
  }

  const rawLimit = Number.isInteger(input.limit) ? Number(input.limit) : 5;
  const validLimit = Math.max(1, Math.min(10, rawLimit));

  try {
    const rawResults = await publishedClient.fetch<
      Array<{
        _id: string;
        _score?: number;
        ruleName: string;
        description?: string;
        requirement: string;
        applicability?: string;
        industry?: string;
        jurisdiction?: string;
        regulator?: string;
        citation: string;
        evidenceExcerpt?: string;
        sourcePages?: number[];
        keywords?: string[];
        freshnessStatus?: string;
        effectiveDate?: string;
        expiresAt?: string;
        lastReviewedAt?: string;
        sourceDocument?: {
          _id: string;
          title: string;
          fileUrl?: string;
        };
      }>
    >(buildSearchQuery(validLimit), {
      searchQuery: trimmedQuery,
      industry: input.industry?.trim() || null,
      jurisdiction: input.jurisdiction?.trim() || null,
    });

    if (!rawResults || rawResults.length === 0) {
      return {
        classification: "empty",
        summary: `No published compliance rules found matching '${trimmedQuery}'.`,
        rules: [],
      };
    }

    const now = Date.now();
    let hasStaleOrExpired = false;

    const rules: ComplianceRuleItem[] = rawResults.map((r) => {
      const isNotCurrent = (r.freshnessStatus || "current") !== "current";
      const isExpired = r.expiresAt ? new Date(r.expiresAt).getTime() <= now : false;

      if (isNotCurrent || isExpired) {
        hasStaleOrExpired = true;
      }

      return {
        ruleId: r._id,
        ruleName: r.ruleName,
        citation: r.citation,
        requirement: r.requirement,
        evidenceExcerpt: r.evidenceExcerpt || r.description || "",
        sourcePages: r.sourcePages || [],
        freshnessStatus: isExpired ? "expired" : (r.freshnessStatus || "current"),
        effectiveDate: r.effectiveDate,
        expiresAt: r.expiresAt,
        lastReviewedAt: r.lastReviewedAt,
        industry: r.industry,
        jurisdiction: r.jurisdiction,
        regulator: r.regulator,
        documentId: r.sourceDocument?._id,
        documentTitle: r.sourceDocument?.title,
        fileUrl: r.sourceDocument?.fileUrl,
      };
    });

    const classification = hasStaleOrExpired ? "stale" : "current";
    const summary =
      classification === "current"
        ? `Found ${rules.length} verified current compliance rule(s) in published repository.`
        : `Found ${rules.length} compliance rule(s), but one or more are marked as stale, superseded, or expired.`;

    return {
      classification,
      summary,
      rules,
    };
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : "Unknown Sanity query error";
    // Crucial: Return failure without silent fallback to the web
    return {
      classification: "empty",
      summary: `Internal Sanity database failure querying rules: ${errMessage}`,
      rules: [],
      error: errMessage,
    };
  }
}
