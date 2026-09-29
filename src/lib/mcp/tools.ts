import { z } from "zod";
import {
  searchPublishedRules,
  getPublishedRuleById,
  listPublishedDocuments,
  getPublishedDocumentById,
} from "@/lib/sanity/published-queries";

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

export function createProjectScopedMcpTools(projectId: string): ScopedMcpTool[] {
  if (!projectId) {
    throw new Error("projectId is required to construct project-scoped MCP tools");
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
        .describe("Optional industry filter, e.g. Healthcare, Construction, Food"),
      jurisdiction: z
        .string()
        .optional()
        .describe("Optional target jurisdiction, e.g. US, Federal, California"),
      includeStale: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to include superseded, stale, or expired rules (default: false)"),
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
    description: "Get a specific published compliance rule by its Sanity document ID in the authenticated project.",
    inputSchema: z.object({
      ruleId: z
        .string()
        .min(1, "ruleId must not be empty")
        .describe("Sanity document ID of the published compliance rule"),
    }),
    handler: async ({ ruleId }: { ruleId: string }): Promise<McpToolHandlerResult> => {
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
    handler: async ({ documentId }: { documentId: string }): Promise<McpToolHandlerResult> => {
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

  return [searchRulesTool, getRuleTool, listDocumentsTool, getDocumentTool];
}
