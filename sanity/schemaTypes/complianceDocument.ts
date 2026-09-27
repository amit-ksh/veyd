import { defineField, defineType } from "sanity";
import { DocumentPdfIcon } from "@sanity/icons/DocumentPdf";

export default defineType({
  name: "complianceDocument",
  title: "Compliance Document",
  type: "document",
  icon: DocumentPdfIcon,
  fields: [
    defineField({
      name: "title",
      title: "Document Title",
      type: "string",
      validation: (rule) => rule.required().min(1).max(200),
    }),
    defineField({
      name: "fileAsset",
      title: "PDF File Asset",
      type: "file",
      options: {
        accept: "application/pdf",
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "industry",
      title: "Industry",
      type: "string",
      description:
        "Free-text industry classification (e.g. Healthcare, Food Processing)",
      validation: (rule) => rule.required().min(1).max(100),
    }),
    defineField({
      name: "originalFileName",
      title: "Original File Name",
      type: "string",
      readOnly: true,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "mimeType",
      title: "MIME Type",
      type: "string",
      initialValue: "application/pdf",
      validation: (rule) =>
        rule
          .required()
          .custom((val) =>
            val === "application/pdf" ? true : "Must equal application/pdf",
          ),
    }),
    defineField({
      name: "fileSizeBytes",
      title: "File Size (Bytes)",
      type: "number",
      validation: (rule) => rule.required().integer().min(1).max(10485760),
    }),
    defineField({
      name: "pageCount",
      title: "Page Count",
      type: "number",
      validation: (rule) => rule.required().integer().min(1).max(100),
    }),
    defineField({
      name: "processingStatus",
      title: "Processing Status",
      type: "string",
      options: {
        list: [
          { title: "Processing", value: "processing" },
          { title: "Ready", value: "ready" },
          { title: "Failed", value: "failed" },
        ],
        layout: "radio",
      },
      initialValue: "processing",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "extractionModel",
      title: "Extraction Model",
      type: "string",
      description: "Value of GEMINI_MODEL used for the attempt",
    }),
    defineField({
      name: "extractedRuleCount",
      title: "Extracted Rule Count",
      type: "number",
      initialValue: 0,
      validation: (rule) => rule.required().integer().min(0),
    }),
    defineField({
      name: "uploadedAt",
      title: "Uploaded At",
      type: "datetime",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "extractionCompletedAt",
      title: "Extraction Completed At",
      type: "datetime",
    }),
    defineField({
      name: "failureMessage",
      title: "Failure Message",
      type: "text",
      description: "Safe operator message; never raw upstream body",
    }),
  ],
  preview: {
    select: {
      title: "title",
      industry: "industry",
      status: "processingStatus",
    },
    prepare({ title, industry, status }) {
      return {
        title: title || "Untitled Document",
        subtitle: `${industry || "Unknown industry"} • ${status || "unknown"}`,
      };
    },
  },
  orderings: [
    {
      title: "Uploaded Date (Newest)",
      name: "uploadedAtDesc",
      by: [{ field: "uploadedAt", direction: "desc" }],
    },
  ],
});
