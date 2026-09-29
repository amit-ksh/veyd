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
    })
  ),
});

export const projectHandbookSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
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
});

export function parseHandbookSnapshot(data: unknown): ProjectHandbookSnapshot | null {
  const result = projectHandbookSnapshotSchema.safeParse(data);
  if (!result.success) {
    return null;
  }
  return result.data as ProjectHandbookSnapshot;
}
