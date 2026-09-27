import { z } from "zod";
import { searchRules, getRuleBySlug, getIndustries, getChaptersByIndustry } from "@/lib/sanity/queries";

// Exposes published Sanity compliance knowledge over MCP at /api/mcp.
// Purely read-only Sanity retrieval.

export const listIndustriesTool = {
  name: "list_industries",
  description:
    "List every industry the compliance handbook covers, with a slug you can pass to other tools.",
  inputSchema: z.object({}),
  handler: async () => {
    const industries = await getIndustries();
    return { industries };
  },
};

export const getHandbookTool = {
  name: "get_handbook_for_industry",
  description:
    "Get the ordered onboarding handbook chapters for a given industry slug, including the compliance rules each chapter covers.",
  inputSchema: z.object({
    industrySlug: z.string().describe("Slug of the industry, from list_industries"),
  }),
  handler: async ({ industrySlug }: { industrySlug: string }) => {
    const chapters = await getChaptersByIndustry(industrySlug);
    return { chapters };
  },
};

export const searchRulesTool = {
  name: "search_compliance_rules",
  description:
    "Search compliance rules by keyword (e.g. 'allergen labeling', 'data retention'). Returns rules with their checklist and citation.",
  inputSchema: z.object({
    query: z.string().describe("Free-text search term"),
  }),
  handler: async ({ query }: { query: string }) => {
    const rules = await searchRules(query);
    return { rules };
  },
};

export const getRuleTool = {
  name: "get_compliance_rule",
  description: "Get a specific compliance rule by its slug.",
  inputSchema: z.object({
    ruleSlug: z.string().describe("Slug of the compliance rule"),
  }),
  handler: async ({ ruleSlug }: { ruleSlug: string }) => {
    const rule = await getRuleBySlug(ruleSlug);
    return { rule };
  },
};

export const mcpTools = [
  listIndustriesTool,
  getHandbookTool,
  searchRulesTool,
  getRuleTool,
];
