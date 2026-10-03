import { z } from "zod";

export const MAX_REVIEW_SELECTION = 50;
export const MAX_REVIEW_LIST = 200;

const requiredText = z.string().trim().min(1, "Required").max(20_000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((value) => {
    const parsed = new Date(value + "T00:00:00Z");
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Use a valid calendar date")
  .nullable();

export const reviewFieldsSchema = z
  .object({
    ruleName: requiredText.max(200),
    description: requiredText,
    requirement: requiredText,
    applicability: requiredText,
    jurisdiction: requiredText,
    regulator: z.string().trim().max(200),
    citation: requiredText,
    evidenceExcerpt: requiredText,
    sourcePages: z
      .array(z.number().int().min(1).max(100))
      .min(1, "Add a source page")
      .max(100)
      .refine(
        (pages) => new Set(pages).size === pages.length,
        "Source pages must be unique",
      ),
    keywords: z
      .array(z.string().trim().min(1).max(100))
      .min(1, "Add a keyword")
      .max(20)
      .refine(
        (words) =>
          new Set(words.map((word) => word.toLowerCase())).size ===
          words.length,
        "Keywords must be unique",
      ),
    freshnessStatus: z.enum(["current", "stale", "superseded"]),
    effectiveDate: date,
    expiresAt: date,
  })
  .strict();

export type ReviewFields = z.infer<typeof reviewFieldsSchema>;

export const selectedReviewEntrySchema = z
  .object({
    id: z
      .string()
      .regex(/^drafts\.[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/)
      .max(200)
      .refine(
        (id) => !/^drafts\.(drafts|versions)\./.test(id),
        "Use a draft entry ID",
      ),
    revision: z.string().min(1).max(200),
    fields: reviewFieldsSchema,
  })
  .strict();

export const publishSelectionSchema = z
  .object({
    confirmReviewed: z.literal(true),
    entries: z
      .array(selectedReviewEntrySchema)
      .min(1)
      .max(MAX_REVIEW_SELECTION)
      .refine(
        (entries) =>
          new Set(entries.map((entry) => entry.id)).size === entries.length,
        "Choose each entry only once",
      ),
  })
  .strict();

export type PublishSelection = z.infer<typeof publishSelectionSchema>;

export interface ReviewEntry {
  id: string;
  revision: string;
  fields: ReviewFields;
}

export interface DocumentReviewResponse {
  document: {
    id: string;
    projectId: string;
    title: string;
    pageCount: number;
    fileUrl: string | null;
  };
  entries: ReviewEntry[];
  totalPending: number;
  hasMore: boolean;
}

export interface PublishReviewResult {
  documentId: string;
  projectId: string;
  publishedIds: string[];
  reviewedAt: string;
  transactionId: string;
}

export function reviewFieldIssues(
  fields: unknown,
  pageCount: number,
): string[] {
  const result = reviewFieldsSchema.safeParse(fields);
  if (!result.success) {
    return result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
  }
  const issues: string[] = [];
  if (result.data.sourcePages.some((page) => page > pageCount)) {
    issues.push(`Source pages must be within this PDF's ${pageCount} pages.`);
  }
  if (
    result.data.effectiveDate &&
    result.data.expiresAt &&
    result.data.expiresAt < result.data.effectiveDate
  ) {
    issues.push("Expiry cannot be earlier than the effective date.");
  }
  return issues;
}
