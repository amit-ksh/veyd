import { tool } from "ai";
import { z } from "zod";
import { searchComplianceRulesForChat } from "./sanity-search";
import {
  searchExternalRegulations,
  isOfficialRegulatoryDomain,
} from "./firecrawl";
import type { Citation } from "./types";
import type { ChatFile } from "@/lib/chat-files/types";

if (typeof window !== "undefined") {
  throw new Error("Cannot import server chat tools in client-side code");
}

export type ChatToolTracker = {
  citations: Citation[];
  files: ChatFile[];
  calledTools: string[];
  sanityClassification: "current" | "stale" | "empty" | null;
  sanityRuleCount: number;
  externalResultCount: number;
};

export function createChatToolTracker(): ChatToolTracker {
  return {
    citations: [],
    files: [],
    calledTools: [],
    sanityClassification: null,
    sanityRuleCount: 0,
    externalResultCount: 0,
  };
}

export function createChatTools(
  tracker: ChatToolTracker,
  abortSignal?: AbortSignal,
  projectId?: string,
) {
  return {
    searchComplianceRules: tool({
      description:
        "Search published compliance rules from the internal repository. MUST be called first for ANY compliance, policy, or regulatory question.",
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "The search term or compliance topic to look up in the published rules",
          ),
        industry: z
          .string()
          .optional()
          .describe(
            "Optional industry filter, e.g. Healthcare, Food & Beverage, Finance",
          ),
        jurisdiction: z
          .string()
          .optional()
          .describe("Optional jurisdiction, e.g. US, EU, OSHA"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .default(5)
          .describe("Maximum number of rules to return (1-10)"),
      }),
      execute: async ({ query, industry, jurisdiction, limit }) => {
        tracker.calledTools.push("searchComplianceRules");
        const out = await searchComplianceRulesForChat({
          query,
          industry,
          jurisdiction,
          limit,
          projectId: projectId || "",
        });
        tracker.sanityClassification = out.classification;
        tracker.sanityRuleCount = out.rules.length;

        // Record unique Sanity citations
        for (const rule of out.rules) {
          if (!tracker.citations.some((c) => c.ruleId === rule.ruleId)) {
            tracker.citations.push({
              sourceKind: "sanity",
              title: rule.ruleName,
              ruleId: rule.ruleId,
              documentId: rule.documentId,
              documentTitle: rule.documentTitle,
              citation: rule.citation,
              sourcePages: rule.sourcePages,
              projectId: projectId,
              url: rule.fileUrl,
            });
          }
        }

        return {
          classification: out.classification,
          summary: out.summary,
          rules: out.rules.map((r) => ({
            ruleId: r.ruleId,
            ruleName: r.ruleName,
            citation: r.citation,
            requirement: r.requirement,
            evidenceExcerpt: r.evidenceExcerpt,
            sourcePages: r.sourcePages,
            freshnessStatus: r.freshnessStatus,
            effectiveDate: r.effectiveDate,
            expiresAt: r.expiresAt,
            lastReviewedAt: r.lastReviewedAt,
            industry: r.industry,
            jurisdiction: r.jurisdiction,
            regulator: r.regulator,
            documentTitle: r.documentTitle,
          })),
          error: out.error,
        };
      },
    }),

    searchExternalRegulations: tool({
      description:
        "Search external regulatory standards, guidance, laws, and compliance resources anywhere across the open web via Firecrawl. Only call this if searchComplianceRules returned an 'empty' or 'stale' classification, or did not adequately cover the specific regulatory question.",
      inputSchema: z.object({
        query: z.string().describe("Specific regulatory search query"),
        jurisdiction: z
          .string()
          .optional()
          .describe("Target jurisdiction, e.g. US, California, EU"),
        regulator: z
          .string()
          .optional()
          .describe("Regulator or agency name, e.g. FDA, OSHA, SEC, EPA"),
      }),
      execute: async ({ query, jurisdiction, regulator }) => {
        tracker.calledTools.push("searchExternalRegulations");

        // Enforce deterministic retrieval policy invariant:
        // Current internal knowledge suppresses Firecrawl.
        if (tracker.sanityClassification === "current") {
          return {
            sourceKind: "official-web" as const,
            warning:
              "External web search suppressed: relevant current internal compliance rules were already found in the published repository.",
            results: [],
          };
        }

        const out = await searchExternalRegulations(
          { query, jurisdiction, regulator },
          abortSignal,
        );
        tracker.externalResultCount = out.results.length;

        // Record web citations with appropriate sourceKind
        for (const item of out.results) {
          for (const file of item.files || []) {
            if (
              tracker.files.length < 10 &&
              !tracker.files.some((existing) => existing.url === file.url)
            )
              tracker.files.push(file);
          }
          const itemSourceKind = isOfficialRegulatoryDomain(item.domain)
            ? ("official-web" as const)
            : ("secondary-web" as const);

          if (!tracker.citations.some((c) => c.url === item.url)) {
            tracker.citations.push({
              sourceKind: itemSourceKind,
              title: item.title,
              url: item.url,
              citation: `${item.title} (${item.domain})`,
            });
          }
        }

        return {
          sourceKind: out.sourceKind,
          warning: out.warning,
          results: out.results.map((r) => ({
            title: r.title,
            url: r.url,
            domain: r.domain,
            snippet: r.snippet,
            markdown: r.markdown,
            // Inform the model which source links will become real UI cards.
            // The model cannot create import actions by drawing cards in prose.
            pdfFiles: (r.files || []).map((file) => ({
              title: file.title,
              url: file.url,
            })),
          })),
          error: out.error,
        };
      },
    }),
  };
}
