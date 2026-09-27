import { defineField, defineType } from "sanity";

export default defineType({
  name: "chapter",
  title: "Handbook Chapter",
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
      name: "industry",
      title: "Industry",
      type: "reference",
      to: [{ type: "industry" }],
      validation: (r) => r.required(),
    }),
    defineField({ name: "order", title: "Order in handbook", type: "number", validation: (r) => r.required() }),
    defineField({ name: "summary", title: "One-line summary", type: "string" }),
    defineField({ name: "estimatedMinutes", title: "Estimated read time (min)", type: "number", initialValue: 5 }),
    defineField({
      name: "body",
      title: "Body",
      type: "array",
      of: [{ type: "block" }, { type: "image" }],
      description: "The actual onboarding content — explain the 'why' behind the rules below.",
    }),
    defineField({
      name: "rules",
      title: "Compliance rules covered in this chapter",
      type: "array",
      of: [{ type: "reference", to: [{ type: "complianceRule" }] }],
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "summary", order: "order" },
    prepare: ({ title, subtitle, order }) => ({
      title: `${order ?? "?"}. ${title}`,
      subtitle,
    }),
  },
  orderings: [
    { title: "Chapter order", name: "orderAsc", by: [{ field: "order", direction: "asc" }] },
  ],
});
