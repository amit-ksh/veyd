import { defineField, defineType } from "sanity";

export default defineType({
  name: "industry",
  title: "Industry",
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
    defineField({ name: "icon", title: "Icon (emoji or lucide name)", type: "string" }),
    defineField({ name: "summary", title: "Summary", type: "text", rows: 3 }),
  ],
  preview: {
    select: { title: "title", subtitle: "summary" },
  },
});
