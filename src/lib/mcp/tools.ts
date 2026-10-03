import { z } from "zod";
import {
  searchPublishedRules,
  getPublishedRuleById,
  listPublishedDocuments,
  getPublishedDocumentById,
} from "@/lib/sanity/published-queries";
import { getHandbookState } from "@/lib/handbook/service";

if (typeof window !== "undefined") {
  throw new Error("Cannot import server MCP tools in client-side code");
}

export type McpToolHandlerResult =
  | { isError: true; errorCode: string; error: string }
  | { isError?: false; [key: string]: unknown };

export interface ScopedMcpTool {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
  handler: (args: any) => Promise<McpToolHandlerResult>;
}

export function createProjectScopedMcpTools(
  projectId: string,
): ScopedMcpTool[] {
  if (!projectId) {
    throw new Error(
      "projectId is required to construct project-scoped MCP tools",
    );
  }

  const searchRulesTool: ScopedMcpTool = {
    name: "search_compliance_rules",
    description:
      "Search published compliance rules by keyword in the authenticated project, with optional industry, jurisdiction, and freshness filtering. Returns ranked rules with their requirement, citation, and source document metadata.",
    inputSchema: z.object({
      query: z
        .string()
        .min(1, "query must not be empty")
        .describe("Free-text regulatory search query or keyword"),
      industry: z
        .string()
        .optional()
        .describe(
          "Optional industry filter, e.g. Healthcare, Construction, Food",
        ),
      jurisdiction: z
        .string()
        .optional()
        .describe("Optional target jurisdiction, e.g. US, Federal, California"),
      includeStale: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "Whether to include superseded, stale, or expired rules (default: false)",
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .default(10)
        .describe("Maximum rules to return (1..20, default: 10)"),
    }),
    handler: async (args: {
      query: string;
      industry?: string;
      jurisdiction?: string;
      includeStale?: boolean;
      limit?: number;
    }): Promise<McpToolHandlerResult> => {
      const rules = await searchPublishedRules({
        query: args.query,
        projectId,
        industry: args.industry,
        jurisdiction: args.jurisdiction,
        includeStale: args.includeStale ?? false,
        limit: args.limit ?? 10,
      });
      return { rules };
    },
  };

  const getRuleTool: ScopedMcpTool = {
    name: "get_compliance_rule",
    description:
      "Get a specific published compliance rule by its Sanity document ID in the authenticated project.",
    inputSchema: z.object({
      ruleId: z
        .string()
        .min(1, "ruleId must not be empty")
        .describe("Sanity document ID of the published compliance rule"),
    }),
    handler: async ({
      ruleId,
    }: {
      ruleId: string;
    }): Promise<McpToolHandlerResult> => {
      if (!ruleId || ruleId.startsWith("drafts.")) {
        return {
          isError: true,
          errorCode: "NOT_FOUND",
          error: `Compliance rule not found: ${ruleId}`,
        };
      }

      const rule = await getPublishedRuleById(ruleId, projectId);
      if (!rule) {
        return {
          isError: true,
          errorCode: "NOT_FOUND",
          error: `Compliance rule not found: ${ruleId}`,
        };
      }
      return { rule };
    },
  };

  const listDocumentsTool: ScopedMcpTool = {
    name: "list_compliance_documents",
    description:
      "List ingested compliance documents and regulatory guidelines for the authenticated project, with optional industry and status filters.",
    inputSchema: z.object({
      industry: z.string().optional().describe("Optional industry filter"),
      status: z
        .enum(["processing", "ready", "failed"])
        .optional()
        .describe("Filter by processing status"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .default(20)
        .describe("Maximum documents to return (1..50, default: 20)"),
      offset: z
        .number()
        .int()
        .min(0)
        .max(500)
        .optional()
        .default(0)
        .describe("Pagination offset (0..500, default: 0)"),
    }),
    handler: async (args: {
      industry?: string;
      status?: "processing" | "ready" | "failed";
      limit?: number;
      offset?: number;
    }): Promise<McpToolHandlerResult> => {
      const documents = await listPublishedDocuments({
        projectId,
        industry: args.industry,
        status: args.status,
        limit: args.limit ?? 20,
        offset: args.offset ?? 0,
      });
      return { documents };
    },
  };

  const getDocumentTool: ScopedMcpTool = {
    name: "get_compliance_document",
    description:
      "Get detail and durable Sanity file asset URL for a specific compliance document by ID in the authenticated project.",
    inputSchema: z.object({
      documentId: z
        .string()
        .min(1, "documentId must not be empty")
        .describe("Sanity document ID of the compliance document"),
    }),
    handler: async ({
      documentId,
    }: {
      documentId: string;
    }): Promise<McpToolHandlerResult> => {
      if (!documentId || documentId.startsWith("drafts.")) {
        return {
          isError: true,
          errorCode: "NOT_FOUND",
          error: `Compliance document not found: ${documentId}`,
        };
      }

      const document = await getPublishedDocumentById(documentId, projectId);
      if (!document) {
        return {
          isError: true,
          errorCode: "NOT_FOUND",
          error: `Compliance document not found: ${documentId}`,
        };
      }
      return { document };
    },
  };

  const getHandbookIndexTool: ScopedMcpTool = {
    name: "get_project_handbook_index",
    description:
      "Returns generation metadata, chapter and section directory, freshness states, and source citation metadata for the authenticated project's generated handbook. Returns HANDBOOK_REFRESH_REQUIRED if the handbook is missing or out of date.",
    inputSchema: z.object({}),
    handler: async (): Promise<McpToolHandlerResult> => {
      const state = await getHandbookState({ projectId });
      if (state.status !== "ready" || !state.handbook) {
        return {
          isError: true,
          errorCode: "HANDBOOK_REFRESH_REQUIRED",
          error:
            "Project handbook is missing, stale, or out of sync with reviewed rules. Please generate the handbook before querying.",
        };
      }
      const hb = state.handbook;
      return {
        projectId: hb.projectId,
        projectName: hb.projectName,
        generatedAt: hb.generatedAt,
        documentCount: hb.documentCount,
        ruleCount: hb.ruleCount,
        currentRuleCount: hb.currentRuleCount,
        reviewRequiredRuleCount: hb.reviewRequiredRuleCount,
        chapters: hb.chapters.map((ch) => ({
          number: ch.number,
          anchor: ch.anchor,
          title: ch.title,
          industry: ch.industry,
          sections: [
            ...ch.currentRules.map((r) => ({
              number: r.number,
              anchor: r.anchor,
              ruleName: r.ruleName,
              freshness: r.freshness,
              sourceKey: r.sourceKey,
            })),
            ...ch.reviewRequiredRules.map((r) => ({
              number: r.number,
              anchor: r.anchor,
              ruleName: r.ruleName,
              freshness: r.freshness,
              sourceKey: r.sourceKey,
            })),
          ],
        })),
        citations: hb.citations,
        reader: hb.reader
          ? {
              title: hb.reader.title,
              contents: hb.reader.contents,
              pages: hb.reader.pages.map((p, i) => ({
                anchor: p.id,
                page: i + 1,
                title: p.title,
                kind: p.kind,
              })),
            }
          : null,
      };
    },
  };

  const getHandbookSectionTool: ScopedMcpTool = {
    name: "get_project_handbook_section",
    description:
      "Get a stored book page or reviewed section using an exact anchor from get_project_handbook_index, along with its cited sources for the authenticated project. Returns NOT_FOUND for invalid anchors and HANDBOOK_REFRESH_REQUIRED if the handbook is not current.",
    inputSchema: z.object({
      anchor: z
        .string()
        .min(1, "anchor must not be empty")
        .describe("Section anchor identifier, e.g. sec-1-1"),
    }),
    handler: async ({
      anchor,
    }: {
      anchor: string;
    }): Promise<McpToolHandlerResult> => {
      const state = await getHandbookState({ projectId });
      if (state.status !== "ready" || !state.handbook) {
        return {
          isError: true,
          errorCode: "HANDBOOK_REFRESH_REQUIRED",
          error:
            "Project handbook is missing, stale, or out of sync with reviewed rules. Please generate the handbook before querying.",
        };
      }

      let foundSection: any = null;
      let foundChapter: any = null;
      const page = state.handbook.reader?.pages.find((p) => p.id === anchor);
      if (page) {
        const keys = new Set([
          ...page.blocks.flatMap((b) => b.sourceKeys),
          ...(page.figure?.sourceKeys || []),
        ]);
        return {
          page,
          citations: state.handbook.citations.filter((c) =>
            keys.has(c.sourceKey),
          ),
          generatedAt: state.handbook.generatedAt,
        };
      }

      for (const ch of state.handbook.chapters) {
        const sec = [...ch.currentRules, ...ch.reviewRequiredRules].find(
          (r) => r.anchor === anchor,
        );
        if (sec) {
          foundSection = sec;
          foundChapter = ch;
          break;
        }
      }

      if (!foundSection || !foundChapter) {
        return {
          isError: true,
          errorCode: "NOT_FOUND",
          error: `Handbook section not found: ${anchor}`,
        };
      }

      const citation = state.handbook.citations.find(
        (c) => c.sourceKey === foundSection.sourceKey,
      );

      return {
        chapter: {
          number: foundChapter.number,
          title: foundChapter.title,
          industry: foundChapter.industry,
        },
        section: foundSection,
        citation: citation || null,
      };
    },
  };

  return [
    searchRulesTool,
    getRuleTool,
    listDocumentsTool,
    getDocumentTool,
    getHandbookIndexTool,
    getHandbookSectionTool,
  ];
}
