import { z } from "zod";
import type { ProjectHandbookSnapshot } from "./types";

export const handbookCitationSchema = z.object({
  sourceKey: z.string().min(1),
  projectId: z.string().min(1),
  ruleId: z.string().min(1),
  documentId: z.string().min(1),
  documentTitle: z.string().min(1),
  citation: z.string().min(1),
  sourcePages: z.array(z.number().int().positive()),
  sourceUrl: z.string().url().optional(),
  evidenceExcerpt: z.string().optional(),
  documentRevision: z.string().optional(),
  ruleRevision: z.string().optional(),
  lastReviewedAt: z.string().optional(),
  freshness: z.enum(["current", "review-required"]).optional(),
});

export const handbookRuleSectionSchema = z.object({
  anchor: z.string().min(1),
  number: z.string().min(1),
  ruleName: z.string().min(1),
  description: z.string(),
  requirement: z.string(),
  applicability: z.string(),
  jurisdiction: z.string(),
  regulator: z.string().optional(),
  effectiveDate: z.string().optional(),
  expiresAt: z.string().optional(),
  freshness: z.enum(["current", "review-required"]),
  keywords: z.array(z.string()),
  sourceKey: z.string().min(1),
});

export const handbookChapterSchema = z.object({
  anchor: z.string().min(1),
  number: z.string().min(1),
  documentId: z.string().min(1),
  title: z.string().min(1),
  industry: z.string(),
  currentRules: z.array(handbookRuleSectionSchema),
  reviewRequiredRules: z.array(handbookRuleSectionSchema),
});

export const subjectIndexEntrySchema = z.object({
  term: z.string().min(1),
  targets: z.array(
    z.object({
      anchor: z.string().min(1),
      sectionNumber: z.string().min(1),
    }),
  ),
});

export const handbookBlockSchema = z.object({
  kind: z.enum(["paragraph", "list", "formula", "warning"]),
  label: z.string().max(80),
  text: z.string().max(650),
  items: z.array(z.string().max(180)).max(5),
  evidence: z.enum([
    "source-backed",
    "example",
    "recommendation",
    "limitation",
  ]),
  sourceKeys: z.array(z.string().min(1)).max(8),
});

export const handbookFigureSchema = z.object({
  title: z.string().min(1).max(100),
  caption: z.string().min(1).max(240),
  steps: z.array(z.string().min(1).max(70)).min(2).max(6),
  sourceKeys: z.array(z.string().min(1)).min(1).max(8),
});

const contentsEntrySchema = z.object({
  title: z.string().min(1),
  page: z.number().int().positive(),
});
export const handbookReaderSchema = z.object({
  title: z.string().min(1).max(160),
  purpose: z.string().min(1).max(240),
  audience: z.string().min(1).max(180),
  scope: z.string().min(1).max(300),
  model: z.string().min(1),
  generatorVersion: z.string().min(1),
  limitations: z.array(z.string().min(1).max(400)).max(20),
  contents: z.array(contentsEntrySchema),
  pages: z
    .array(
      z.object({
        id: z.string().min(1),
        kind: z.enum(["cover", "contents", "chapter", "content"]),
        title: z.string().min(1).max(160),
        chapter: z.string(),
        blocks: z.array(handbookBlockSchema).max(4),
        figure: handbookFigureSchema.optional(),
        entries: z.array(contentsEntrySchema).max(12).optional(),
      }),
    )
    .min(3)
    .max(200),
});

export const projectHandbookSnapshotSchema = z
  .object({
    schemaVersion: z.literal(2),
    projectId: z.string().min(1),
    projectName: z.string().min(1),
    sourceFingerprint: z.string().min(1),
    generatedAt: z.string().min(1),
    documentCount: z.number().int().nonnegative(),
    ruleCount: z.number().int().nonnegative(),
    currentRuleCount: z.number().int().nonnegative(),
    reviewRequiredRuleCount: z.number().int().nonnegative(),
    chapters: z.array(handbookChapterSchema),
    citations: z.array(handbookCitationSchema),
    subjectIndex: z.array(subjectIndexEntrySchema),
    reader: handbookReaderSchema,
  })
  .superRefine((snapshot, context) => {
    const keys = new Set(snapshot.citations.map((c) => c.sourceKey));
    const ids = new Set(snapshot.reader.pages.map((p) => p.id));
    if (
      keys.size !== snapshot.citations.length ||
      ids.size !== snapshot.reader.pages.length ||
      snapshot.citations.some((c) => c.projectId !== snapshot.projectId)
    ) {
      context.addIssue({
        code: "custom",
        message: "Invalid handbook source identity.",
      });
    }
    for (const page of snapshot.reader.pages) {
      if (
        [
          ...page.blocks.flatMap((b) => b.sourceKeys),
          ...(page.figure?.sourceKeys || []),
        ].some((key) => !keys.has(key))
      )
        context.addIssue({
          code: "custom",
          message: "Unknown handbook citation.",
        });
      if (
        page.entries?.some((entry) => entry.page > snapshot.reader.pages.length)
      )
        context.addIssue({
          code: "custom",
          message: "Invalid contents destination.",
        });
    }
  });

export function parseHandbookSnapshot(
  data: unknown,
): ProjectHandbookSnapshot | null {
  const result = projectHandbookSnapshotSchema.safeParse(data);
  if (!result.success) {
    return null;
  }
  return result.data as ProjectHandbookSnapshot;
}
