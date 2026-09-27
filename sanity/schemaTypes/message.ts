import { defineField, defineType, defineArrayMember } from "sanity";
import { DocumentTextIcon } from "@sanity/icons/DocumentText";

export default defineType({
  name: "message",
  title: "Message",
  type: "document",
  icon: DocumentTextIcon,
  fields: [
    defineField({
      name: "conversation",
      title: "Conversation",
      type: "reference",
      to: [{ type: "conversation" }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "role",
      title: "Role",
      type: "string",
      options: {
        list: [
          { title: "User", value: "user" },
          { title: "Assistant", value: "assistant" },
        ],
        layout: "radio",
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "content",
      title: "Content",
      type: "text",
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "clientMessageId",
      title: "Client Message ID",
      type: "string",
      description: "Client-generated message ID for deduplication",
    }),
    defineField({
      name: "citations",
      title: "Citations",
      type: "array",
      hidden: ({ document }) => document?.role !== "assistant",
      of: [
        defineArrayMember({
          type: "object",
          name: "citationItem",
          title: "Citation Item",
          fields: [
            defineField({
              name: "sourceKind",
              title: "Source Kind",
              type: "string",
              options: {
                list: [
                  { title: "Sanity", value: "sanity" },
                  { title: "Official Web", value: "official-web" },
                  { title: "Secondary Web", value: "secondary-web" },
                ],
              },
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "title",
              title: "Title",
              type: "string",
              validation: (rule) => rule.required().min(1),
            }),
            defineField({
              name: "url",
              title: "URL",
              type: "url",
              validation: (rule) =>
                rule.custom((url, context) => {
                  const item = context.parent as
                    | { sourceKind?: string }
                    | undefined;
                  if (item?.sourceKind !== "sanity" && !url) {
                    return "URL is required for web citations";
                  }
                  return true;
                }),
            }),
            defineField({
              name: "ruleId",
              title: "Rule ID",
              type: "string",
              description: "Required for Sanity rule citations",
              validation: (rule) =>
                rule.custom((ruleId, context) => {
                  const item = context.parent as
                    | { sourceKind?: string }
                    | undefined;
                  if (item?.sourceKind === "sanity" && !ruleId) {
                    return "Rule ID is required for Sanity citations";
                  }
                  return true;
                }),
            }),
            defineField({
              name: "documentId",
              title: "Document ID",
              type: "string",
              description: "Source document ID when available",
            }),
            defineField({
              name: "citation",
              title: "Citation",
              type: "string",
              description: "Formal regulatory citation when available",
            }),
          ],
          preview: {
            select: {
              title: "title",
              sourceKind: "sourceKind",
              citation: "citation",
            },
            prepare({ title, sourceKind, citation }) {
              return {
                title: title || "Untitled Citation",
                subtitle:
                  `[${sourceKind || "source"}] ${citation || ""}`.trim(),
              };
            },
          },
        }),
      ],
    }),
    defineField({
      name: "createdAt",
      title: "Created At",
      type: "datetime",
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {
      role: "role",
      content: "content",
      createdAt: "createdAt",
    },
    prepare({ role, content, createdAt }) {
      return {
        title: `[${(role || "unknown").toUpperCase()}] ${(content || "").slice(0, 60)}`,
        subtitle: createdAt ? new Date(createdAt).toLocaleString() : undefined,
      };
    },
  },
});
