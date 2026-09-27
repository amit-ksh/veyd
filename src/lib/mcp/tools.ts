import { z } from "zod";
import {
  searchComplianceRules,
  getComplianceRuleById,
  getComplianceDocuments,
  getComplianceDocumentById,
} from "@/lib/sanity/queries";

// Exposes published Sanity compliance knowledge over MCP at /api/mcp.
// Purely read-only Sanity retrieval using the published perspective client.

export const searchRulesTool = {
  name: "search_compliance_rules",
  description:
    "Search published compliance rules by keyword. Returns rules with their requirement, applicability, evidence, and citation.",
  inputSchema: z.object({
    query: z.string().describe("Free-text search term"),
    limit: z.number().int().min(1).max(20).optional().default(10).describe("Maximum rules to return (1-20)"),
  }),
  handler: async ({ query, limit }: { query: string; limit?: number }) => {
    const rules = await searchComplianceRules(query, limit ?? 10);
    return { rules };
  },
};

export const getRuleTool = {
  name: "get_compliance_rule",
  description: "Get a specific published compliance rule by its Sanity document ID.",
  inputSchema: z.object({
    ruleId: z.string().describe("Sanity document ID of the compliance rule"),
  }),
  handler: async ({ ruleId }: { ruleId: string }) => {
    const rule = await getComplianceRuleById(ruleId);
    if (!rule) {
      return { error: `Rule not found for ID: ${ruleId}` };
    }
    return { rule };
  },
};

export const listDocumentsTool = {
  name: "list_compliance_documents",
  description: "List ingested compliance documents and regulatory guidelines.",
  inputSchema: z.object({}),
  handler: async () => {
    const documents = await getComplianceDocuments();
    return { documents };
  },
};

export const getDocumentTool = {
  name: "get_compliance_document",
  description: "Get detail and file asset URL for a specific compliance document by ID.",
  inputSchema: z.object({
    documentId: z.string().describe("Sanity document ID of the compliance document"),
  }),
  handler: async ({ documentId }: { documentId: string }) => {
    const document = await getComplianceDocumentById(documentId);
    if (!document) {
      return { error: `Document not found for ID: ${documentId}` };
    }
    return { document };
  },
};

export const mcpTools = [
  searchRulesTool,
  getRuleTool,
  listDocumentsTool,
  getDocumentTool,
];
