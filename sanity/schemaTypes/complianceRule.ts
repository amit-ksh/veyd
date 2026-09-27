import { defineField, defineType, defineArrayMember } from "sanity";
import { CheckmarkCircleIcon } from "@sanity/icons/CheckmarkCircle";

export default defineType({
  name: "complianceRule",
  title: "Compliance Rule",
  type: "document",
  icon: CheckmarkCircleIcon,
  groups: [
    { name: "identity", title: "1. Rule Identity", default: true },
    { name: "authority", title: "2. Authority & Citations" },
    { name: "evidence", title: "3. Evidence & Source" },
    { name: "discovery", title: "4. Discovery" },
    { name: "lifecycle", title: "5. Lifecycle & Review" },
  ],
  fields: [
    // ------------------------------------------------------------------------
    // Group 1: Rule Identity
    // ------------------------------------------------------------------------
    defineField({
      name: "ruleName",
      title: "Rule Name",
      type: "string",
      group: "identity",
      validation: (rule) => rule.required().min(1).max(200),
    }),
    defineField({
      name: "description",
      title: "Plain-language Description",
      type: "text",
      rows: 3,
      group: "identity",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "requirement",
      title: "Normative Requirement",
      type: "text",
      rows: 3,
      group: "identity",
      description: "Normative action or prohibition",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "applicability",
      title: "Applicability",
      type: "text",
      rows: 2,
      group: "identity",
      description: "Who/what/when the rule applies to",
      validation: (rule) => rule.required(),
    }),

    // ------------------------------------------------------------------------
    // Group 2: Authority
    // ------------------------------------------------------------------------
    defineField({
      name: "jurisdiction",
      title: "Jurisdiction",
      type: "string",
      group: "authority",
      description:
        "Human-readable jurisdiction (e.g. US-Federal, EU, California)",
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "regulator",
      title: "Regulator",
      type: "string",
      group: "authority",
      description: "Issuing authority when present (e.g. FDA, SEC, OSHA)",
    }),
    defineField({
      name: "citation",
      title: "Citation",
      type: "string",
      group: "authority",
      description: "Source citation exactly as found (e.g. 21 CFR 117.126)",
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "effectiveDate",
      title: "Effective Date",
      type: "date",
      group: "authority",
      description: "Date stated by the source",
    }),
    defineField({
      name: "expiresAt",
      title: "Expires At",
      type: "date",
      group: "authority",
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

    // ------------------------------------------------------------------------
    // Group 3: Evidence
    // ------------------------------------------------------------------------
    defineField({
      name: "sourceDocument",
      title: "Source Document",
      type: "reference",
      to: [{ type: "complianceDocument" }],
      group: "evidence",
      description: "Strong reference to the source complianceDocument",
      validation: (rule) => rule.required(),
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
      group: "evidence",
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
      name: "evidenceExcerpt",
      title: "Evidence Excerpt",
      type: "text",
      rows: 3,
      group: "evidence",
      description: "Short supporting excerpt from the source PDF",
      validation: (rule) => rule.required().min(1),
    }),

    // ------------------------------------------------------------------------
    // Group 4: Discovery
    // ------------------------------------------------------------------------
    defineField({
      name: "industry",
      title: "Industry",
      type: "string",
      group: "discovery",
      description: "Copied from source document for filtering",
      validation: (rule) => rule.required().min(1).max(100),
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
      group: "discovery",
      description: "1–20 unique normalized search terms",
      validation: (rule) => rule.required().min(1).max(20).unique(),
    }),

    // ------------------------------------------------------------------------
    // Group 5: Lifecycle
    // ------------------------------------------------------------------------
    defineField({
      name: "freshnessStatus",
      title: "Freshness Status",
      type: "string",
      group: "lifecycle",
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
      name: "lastReviewedAt",
      title: "Last Reviewed At",
      type: "datetime",
      group: "lifecycle",
      description:
        "Human review timestamp. Required before publication can proceed.",
      validation: (rule) =>
        rule
          .required()
          .error(
            "A compliance rule cannot be published without human review confirmation (lastReviewedAt is required)."
          ),
    }),
  ],
  preview: {
    select: {
      title: "ruleName",
      citation: "citation",
      jurisdiction: "jurisdiction",
      freshnessStatus: "freshnessStatus",
      lastReviewedAt: "lastReviewedAt",
      sourceDocTitle: "sourceDocument.title",
    },
    prepare({
      title,
      citation,
      jurisdiction,
      freshnessStatus,
      lastReviewedAt,
      sourceDocTitle,
    }) {
      const isReviewed = Boolean(lastReviewedAt);
      const reviewBadge = isReviewed ? "✓ Reviewed" : "⚠ Awaiting Review";
      const statusBadge = freshnessStatus || "current";
      const docLabel = sourceDocTitle ? ` • ${sourceDocTitle}` : "";

      return {
        title: title || "Untitled Rule",
        subtitle: `${citation || "No citation"} • ${jurisdiction || "No jurisdiction"} • [${statusBadge}] • ${reviewBadge}${docLabel}`,
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
    {
      title: "Last Reviewed (Newest)",
      name: "lastReviewedAtDesc",
      by: [{ field: "lastReviewedAt", direction: "desc" }],
    },
  ],
});
