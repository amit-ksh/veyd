import { defineField, defineType, defineArrayMember } from "sanity";
import { CheckmarkCircleIcon } from "@sanity/icons/CheckmarkCircle";

export default defineType({
  name: "complianceRule",
  title: "Compliance Rule",
  type: "document",
  icon: CheckmarkCircleIcon,
  fields: [
    defineField({
      name: "ruleName",
      title: "Rule Name",
      type: "string",
      validation: (rule) => rule.required().min(1).max(200),
    }),
    defineField({
      name: "description",
      title: "Plain-language Description",
      type: "text",
      rows: 3,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "requirement",
      title: "Normative Requirement",
      type: "text",
      rows: 3,
      description: "Normative action or prohibition",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "applicability",
      title: "Applicability",
      type: "text",
      rows: 2,
      description: "Who/what/when the rule applies to",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "industry",
      title: "Industry",
      type: "string",
      description: "Copied from source document for filtering",
      validation: (rule) => rule.required().min(1).max(100),
    }),
    defineField({
      name: "jurisdiction",
      title: "Jurisdiction",
      type: "string",
      description:
        "Human-readable jurisdiction (e.g. US-Federal, EU, California)",
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "regulator",
      title: "Regulator",
      type: "string",
      description: "Issuing authority when present (e.g. FDA, SEC, OSHA)",
    }),
    defineField({
      name: "citation",
      title: "Citation",
      type: "string",
      description: "Source citation exactly as found (e.g. 21 CFR 117.126)",
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "evidenceExcerpt",
      title: "Evidence Excerpt",
      type: "text",
      rows: 3,
      description: "Short supporting excerpt from the source PDF",
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "sourcePages",
      title: "Source Pages",
      type: "array",
      of: [
        defineArrayMember({
          type: "number",
          validation: (rule) => rule.integer().min(1).max(100),
        }),
      ],
      description:
        "Unique page numbers in the source PDF (1–100, at least one)",
      validation: (rule) =>
        rule
          .required()
          .min(1)
          .unique()
          .custom((pages) => {
            if (!Array.isArray(pages) || pages.length === 0) {
              return "At least one source page is required";
            }
            for (const p of pages) {
              if (
                typeof p !== "number" ||
                !Number.isInteger(p) ||
                p < 1 ||
                p > 100
              ) {
                return "Each source page must be an integer between 1 and 100";
              }
            }
            return true;
          }),
    }),
    defineField({
      name: "keywords",
      title: "Keywords",
      type: "array",
      of: [
        defineArrayMember({
          type: "string",
          validation: (rule) => rule.min(1).max(100),
        }),
      ],
      description: "1–20 unique normalized search terms",
      validation: (rule) => rule.required().min(1).max(20).unique(),
    }),
    defineField({
      name: "sourceDocument",
      title: "Source Document",
      type: "reference",
      to: [{ type: "complianceDocument" }],
      description: "Strong reference to the source complianceDocument",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "freshnessStatus",
      title: "Freshness Status",
      type: "string",
      options: {
        list: [
          { title: "Current", value: "current" },
          { title: "Stale", value: "stale" },
          { title: "Superseded", value: "superseded" },
        ],
        layout: "radio",
      },
      initialValue: "current",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "effectiveDate",
      title: "Effective Date",
      type: "date",
      description: "Date stated by the source",
    }),
    defineField({
      name: "expiresAt",
      title: "Expires At",
      type: "date",
      description:
        "Explicit expiry or review deadline. Must be on or after effectiveDate.",
      validation: (rule) =>
        rule.custom((expiresAt, context) => {
          const doc = context.document as
            | { effectiveDate?: string }
            | undefined;
          if (
            expiresAt &&
            doc?.effectiveDate &&
            expiresAt < doc.effectiveDate
          ) {
            return "Expiration date cannot be earlier than effective date";
          }
          return true;
        }),
    }),
    defineField({
      name: "lastReviewedAt",
      title: "Last Reviewed At",
      type: "datetime",
      description: "Human review timestamp",
    }),
  ],
  preview: {
    select: {
      title: "ruleName",
      citation: "citation",
      jurisdiction: "jurisdiction",
      freshnessStatus: "freshnessStatus",
    },
    prepare({ title, citation, jurisdiction, freshnessStatus }) {
      return {
        title: title || "Untitled Rule",
        subtitle: `${citation || "No citation"} • ${jurisdiction || "No jurisdiction"} • ${freshnessStatus || "current"}`,
      };
    },
  },
  orderings: [
    {
      title: "Rule Name (A-Z)",
      name: "ruleNameAsc",
      by: [{ field: "ruleName", direction: "asc" }],
    },
    {
      title: "Effective Date (Newest)",
      name: "effectiveDateDesc",
      by: [{ field: "effectiveDate", direction: "desc" }],
    },
  ],
});
