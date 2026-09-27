import { defineField, defineType } from "sanity";
import { CommentIcon } from "@sanity/icons/Comment";

export default defineType({
  name: "conversation",
  title: "Conversation",
  type: "document",
  icon: CommentIcon,
  fields: [
    defineField({
      name: "createdAt",
      title: "Created At",
      type: "datetime",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "updatedAt",
      title: "Updated At",
      type: "datetime",
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {
      id: "_id",
      createdAt: "createdAt",
    },
    prepare({ id, createdAt }) {
      return {
        title: id ? `Conversation ${id.slice(0, 8)}...` : "Conversation",
        subtitle: createdAt ? new Date(createdAt).toLocaleString() : undefined,
      };
    },
  },
});
