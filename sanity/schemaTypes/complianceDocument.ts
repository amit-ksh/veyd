import { defineField, defineType } from "sanity";
import { DocumentPdfIcon } from "@sanity/icons/DocumentPdf";

export default defineType({
  name: "complianceDocument",
  title: "Compliance Document",
  type: "document",
  icon: DocumentPdfIcon,
  groups: [
    { name: "document", title: "1. Document & File", default: true },
    { name: "processing", title: "2. Processing & Extraction" },
  ],
  fields: [
    defineField({
      name: "title",
      title: "Document Title",
      type: "string",
      group: "document",
      validation: (rule) => rule.required().min(1).max(200),
    }),
    defineField({
      name: "fileAsset",
      title: "PDF File Asset",
      type: "file",
      group: "document",
      options: {
        accept: "application/pdf",
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "industry",
      title: "Industry",
      type: "string",
      group: "document",
      description:
        "Free-text industry classification (e.g. Healthcare, Food Processing)",
      validation: (rule) => rule.required().min(1).max(100),
    }),
    defineField({
      name: "originalFileName",
      title: "Original File Name",
      type: "string",
      group: "document",
      readOnly: true,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "mimeType",
      title: "MIME Type",
      type: "string",
      group: "document",
      initialValue: "application/pdf",
      validation: (rule) =>
        rule
          .required()
          .custom((val) =>
            val === "application/pdf" ? true : "Must equal application/pdf"
          ),
    }),
    defineField({
      name: "fileSizeBytes",
      title: "File Size (Bytes)",
      type: "number",
      group: "document",
      validation: (rule) => rule.required().integer().min(1).max(10485760),
    }),
    defineField({
      name: "pageCount",
      title: "Page Count",
      type: "number",
      group: "document",
      validation: (rule) => rule.required().integer().min(1).max(100),
    }),

    // Processing group
    defineField({
      name: "processingStatus",
      title: "Processing Status",
      type: "string",
      group: "processing",
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
      group: "processing",
      description: "Value of GEMINI_MODEL used for the attempt",
    }),
    defineField({
      name: "extractedRuleCount",
      title: "Extracted Rule Count",
      type: "number",
      group: "processing",
      initialValue: 0,
      validation: (rule) => rule.required().integer().min(0),
    }),
    defineField({
      name: "uploadedAt",
      title: "Uploaded At",
      type: "datetime",
      group: "processing",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "extractionCompletedAt",
      title: "Extraction Completed At",
      type: "datetime",
      group: "processing",
    }),
    defineField({
      name: "failureMessage",
      title: "Failure Message",
      type: "text",
      group: "processing",
      description: "Safe operator message; never raw upstream body",
    }),
  ],
  preview: {
    select: {
      title: "title",
      industry: "industry",
      status: "processingStatus",
      ruleCount: "extractedRuleCount",
      pageCount: "pageCount",
    },
    prepare({ title, industry, status, ruleCount, pageCount }) {
      const statusIcon =
        status === "ready" ? "✓" : status === "failed" ? "✗" : "⏳";
      const pagesText = pageCount ? `${pageCount}p` : "";
      const rulesText = `${ruleCount ?? 0} rules extracted`;
      return {
        title: title || "Untitled Document",
        subtitle: `${industry || "Unknown"} • ${pagesText} • [${statusIcon} ${status || "unknown"}] • ${rulesText}`,
      };
    },
  },
  orderings: [
    {
      title: "Uploaded Date (Newest)",
      name: "uploadedAtDesc",
      by: [{ field: "uploadedAt", direction: "desc" }],
    },
    {
      title: "Title (A-Z)",
      name: "titleAsc",
      by: [{ field: "title", direction: "asc" }],
    },
  ],
});
