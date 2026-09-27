import { defineField, defineType } from "sanity";

// This is the atomic unit the MCP tool verifies against: one rule, one citation,
// one checklist. Chapters compose these into a readable handbook; the /api/mcp
// endpoint queries them directly so an agent's "answer" is always traceable to
// a specific, sourced rule rather than a paraphrase.
export default defineType({
  name: "complianceRule",
  title: "Compliance Rule",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title" },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "severity",
      title: "Severity",
      type: "string",
      options: { list: ["critical", "high", "medium", "low"] },
      validation: (r) => r.required(),
    }),
    defineField({ name: "jurisdiction", title: "Jurisdiction", type: "string", description: "e.g. US-Federal, EU, California" }),
    defineField({ name: "citation", title: "Citation / source reference", type: "string", description: "e.g. 21 CFR 117.126" }),
    defineField({ name: "description", title: "Plain-language description", type: "text", rows: 4 }),
    defineField({
      name: "checklist",
      title: "Verification checklist",
      type: "array",
      of: [{ type: "string" }],
      description: "Concrete, checkable items the MCP tool and reviewers use to mark this rule PASS/FAIL.",
    }),
    defineField({ name: "lastReviewed", title: "Last reviewed", type: "date" }),
    defineField({
      name: "industries",
      title: "Applies to industries",
      type: "array",
      of: [{ type: "reference", to: [{ type: "industry" }] }],
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "citation" },
  },
});
