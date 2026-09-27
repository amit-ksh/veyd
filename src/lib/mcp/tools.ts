import { z } from "zod";
import { searchRules, getRuleBySlug, getIndustries, getChaptersByIndustry } from "@/lib/sanity/queries";
import { prisma } from "@/lib/prisma";
import type { VerificationOutcome } from "@prisma/client";

// These are the tools exposed over MCP at /api/mcp. An agent (Claude, or any
// MCP client) uses them to (1) find the rule that applies, (2) check evidence
// against that rule's checklist, and (3) write an auditable result back to the
// workspace — instead of guessing from memory whether something is compliant.

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

const verifyInputSchema = z.object({
  workspaceId: z.string().describe("The workspace this verification applies to"),
  ruleSlug: z.string().describe("Slug of the compliance rule being checked, from search_compliance_rules"),
  evidence: z
    .array(z.object({ item: z.string(), satisfied: z.boolean(), note: z.string().optional() }))
    .describe("One entry per checklist item, saying whether the evidence you were given satisfies it"),
  userId: z.string().optional().describe("User id to attribute this check to, if known"),
});

export const verifyComplianceTool = {
  name: "verify_compliance",
  description:
    "Record a compliance verification for a workspace against a specific rule's checklist. " +
    "Always call search_compliance_rules first to get the real checklist items — do not invent them. " +
    "Outcome is derived automatically: any unsatisfied 'critical' item fails the whole check.",
  inputSchema: verifyInputSchema,
  handler: async (input: z.infer<typeof verifyInputSchema>) => {
    const rule = await getRuleBySlug(input.ruleSlug);
    if (!rule) {
      throw new Error(`Unknown rule slug: ${input.ruleSlug}. Call search_compliance_rules first.`);
    }

    const unsatisfied = input.evidence.filter((e) => !e.satisfied);
    let outcome: VerificationOutcome = "PASS";
    if (unsatisfied.length > 0) {
      outcome = rule.severity === "critical" || rule.severity === "high" ? "FAIL" : "NEEDS_REVIEW";
    }

    const reasoning =
      unsatisfied.length === 0
        ? `All ${input.evidence.length} checklist items satisfied for "${rule.title}" (${rule.citation}).`
        : `${unsatisfied.length} of ${input.evidence.length} checklist item(s) unsatisfied for "${rule.title}": ${unsatisfied
            .map((e) => e.item)
            .join("; ")}.`;

    const log = await prisma.verificationLog.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        ruleSlug: rule.slug,
        ruleTitle: rule.title,
        input: input.evidence,
        outcome,
        reasoning,
        source: "mcp",
      },
    });

    return {
      outcome,
      reasoning,
      rule: { title: rule.title, citation: rule.citation, jurisdiction: rule.jurisdiction },
      logId: log.id,
    };
  },
};

export const getVerificationHistoryTool = {
  name: "get_verification_history",
  description: "Get the recent compliance verification log for a workspace, most recent first.",
  inputSchema: z.object({
    workspaceId: z.string(),
    limit: z.number().min(1).max(50).default(20),
  }),
  handler: async ({ workspaceId, limit }: { workspaceId: string; limit: number }) => {
    const logs = await prisma.verificationLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return { logs };
  },
};

export const mcpTools = [
  listIndustriesTool,
  getHandbookTool,
  searchRulesTool,
  verifyComplianceTool,
  getVerificationHistoryTool,
];
