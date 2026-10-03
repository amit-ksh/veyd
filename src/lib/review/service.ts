import { defineQuery } from "groq";
import type { Action } from "@sanity/client";
import { writeClient } from "@/lib/sanity/clients";
import { getAuthorizedProject } from "@/lib/projects/service";
import { isDocumentTombstoned } from "@/lib/tombstones/service";
import {
  ConflictError,
  InvalidRequestError,
  NotFoundError,
  UpstreamFailureError,
} from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  MAX_REVIEW_LIST,
  publishSelectionSchema,
  reviewFieldIssues,
  type DocumentReviewResponse,
  type PublishReviewResult,
  type ReviewFields,
} from "./types";

if (typeof window !== "undefined")
  throw new Error("Review service is server-only");

const documentQuery =
  defineQuery(`*[_type == "complianceDocument" && _id == $documentId && projectId == $projectId][0]{
  _id, _rev, projectId, title, pageCount, processingStatus, "fileUrl": fileAsset.asset->url
}`);
const pendingFilter = `_type == "complianceRule" && projectId == $projectId && sourceDocument._ref == $documentId && _id in path("drafts.**")`;
const pendingQuery = defineQuery(`{
  "total": count(*[${pendingFilter}]),
  "entries": *[${pendingFilter}] | order(_createdAt asc, _id asc)[0...${MAX_REVIEW_LIST}]{
    _id, _rev, projectId, sourceDocument, industry, ruleName, description, requirement, applicability,
    jurisdiction, regulator, citation, evidenceExcerpt, sourcePages, keywords, freshnessStatus, effectiveDate, expiresAt
  }
}`);
const selectedQuery =
  defineQuery(`*[_type == "complianceRule" && _id in $ids && projectId == $projectId && sourceDocument._ref == $documentId]{
  _id, _rev, projectId, sourceDocument, industry
}`);

interface SourceDocument {
  _id: string;
  _rev: string;
  projectId: string;
  title: string;
  pageCount: number;
  processingStatus: string;
  fileUrl: string | null;
}
interface StoredEntry {
  _id: string;
  _rev: string;
  projectId: string;
  sourceDocument: { _ref: string };
  industry: string;
  [field: string]: unknown;
}
interface ReviewContext {
  projectId: string;
  documentId: string;
  userId: string;
  correlationId?: string;
}

async function sourceForReview(
  context: ReviewContext,
): Promise<SourceDocument> {
  await getAuthorizedProject(context.projectId, context.userId);
  if (
    !/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(context.documentId) ||
    /^(drafts|versions)\./.test(context.documentId)
  ) {
    throw new NotFoundError("Document not found.");
  }
  if (await isDocumentTombstoned(context.projectId, context.documentId))
    throw new NotFoundError("Document not found.");
  const document = await writeClient.fetch<SourceDocument | null>(
    documentQuery,
    context,
  );
  if (!document || document.projectId !== context.projectId)
    throw new NotFoundError("Document not found.");
  if (document.processingStatus !== "ready")
    throw new ConflictError(
      "Wait for document extraction to finish before reviewing entries.",
    );
  if (
    !Number.isInteger(document.pageCount) ||
    document.pageCount < 1 ||
    document.pageCount > 100
  ) {
    throw new ConflictError(
      "The source PDF's page count is invalid. Review this document in Studio.",
    );
  }
  return document;
}

function editableFields(entry: StoredEntry): ReviewFields {
  const text = (name: string) =>
    typeof entry[name] === "string" ? (entry[name] as string) : "";
  return {
    ruleName: text("ruleName"),
    description: text("description"),
    requirement: text("requirement"),
    applicability: text("applicability"),
    jurisdiction: text("jurisdiction"),
    regulator: text("regulator"),
    citation: text("citation"),
    evidenceExcerpt: text("evidenceExcerpt"),
    sourcePages: Array.isArray(entry.sourcePages)
      ? entry.sourcePages.filter(
          (page): page is number => typeof page === "number",
        )
      : [],
    keywords: Array.isArray(entry.keywords)
      ? entry.keywords.filter(
          (word): word is string => typeof word === "string",
        )
      : [],
    // Invalid/missing state is shown as a blank selection, not silently inferred.
    freshnessStatus: text("freshnessStatus") as ReviewFields["freshnessStatus"],
    effectiveDate: text("effectiveDate") || null,
    expiresAt: text("expiresAt") || null,
  };
}

export async function getDocumentReview(
  context: ReviewContext,
): Promise<DocumentReviewResponse> {
  const document = await sourceForReview(context);
  const pending = await writeClient.fetch<{
    total: number;
    entries: StoredEntry[];
  }>(pendingQuery, context);
  return {
    document: {
      id: document._id,
      projectId: document.projectId,
      title: document.title,
      pageCount: document.pageCount,
      fileUrl: document.fileUrl,
    },
    entries: pending.entries.map((entry) => ({
      id: entry._id,
      revision: entry._rev,
      fields: editableFields(entry),
    })),
    totalPending: pending.total,
    hasMore: pending.total > pending.entries.length,
  };
}

export async function publishReviewedSelection(
  context: ReviewContext,
  input: unknown,
): Promise<PublishReviewResult> {
  const document = await sourceForReview(context);
  const parsed = publishSelectionSchema.safeParse(input);
  if (!parsed.success) {
    throw new InvalidRequestError(
      "Choose 1–50 distinct entries, complete their required fields, and confirm you reviewed them.",
    );
  }
  const { entries } = parsed.data;
  const stored = await writeClient.fetch<StoredEntry[]>(selectedQuery, {
    ...context,
    ids: entries.map((entry) => entry.id),
  });
  if (stored.length !== entries.length)
    throw new ConflictError(
      "Some selected entries are no longer awaiting review. Reload entries before publishing.",
    );
  const byId = new Map(stored.map((entry) => [entry._id, entry]));
  const published = await writeClient.fetch<StoredEntry[]>(
    defineQuery(
      `*[_type == "complianceRule" && _id in $ids]{_id, _rev, projectId, sourceDocument}`,
    ),
    { ids: entries.map((entry) => entry.id.slice("drafts.".length)) },
  );
  const publishedById = new Map(published.map((entry) => [entry._id, entry]));
  const reviewedAt = new Date().toISOString();
  const actions: Action[] = [];
  for (const [index, entry] of entries.entries()) {
    const original = byId.get(entry.id);
    if (
      !original ||
      original.projectId !== context.projectId ||
      original.sourceDocument?._ref !== context.documentId
    ) {
      throw new NotFoundError("Entry not found.");
    }
    if (original._rev !== entry.revision)
      throw new ConflictError(
        "A selected entry changed since you opened it. Reload entries and review the changes.",
      );
    if (
      typeof original.industry !== "string" ||
      !original.industry.trim() ||
      original.industry.length > 100
    ) {
      throw new InvalidRequestError(
        `Entry ${index + 1} has invalid internal domain metadata. Correct it in Studio before publishing.`,
      );
    }
    const issues = reviewFieldIssues(entry.fields, document.pageCount);
    if (issues.length)
      throw new InvalidRequestError(`Entry ${index + 1}: ${issues[0]}`);
    const publishedId = entry.id.slice("drafts.".length);
    const existingPublished = publishedById.get(publishedId);
    if (
      existingPublished &&
      (existingPublished.projectId !== context.projectId ||
        existingPublished.sourceDocument?._ref !== context.documentId)
    ) {
      throw new NotFoundError("Entry not found.");
    }
    const { effectiveDate, expiresAt, ...fields } = entry.fields;
    const unset = [
      !effectiveDate && "effectiveDate",
      !expiresAt && "expiresAt",
    ].filter((field): field is string => Boolean(field));
    // The publish action guards the reviewed draft revision for the whole atomic batch.
    // Actions edit patches do not support the Mutations API's `ifRevisionID` field.
    actions.push(
      {
        actionType: "sanity.action.document.edit",
        draftId: entry.id,
        publishedId,
        patch: {
          set: {
            ...fields,
            lastReviewedAt: reviewedAt,
            ...(effectiveDate ? { effectiveDate } : {}),
            ...(expiresAt ? { expiresAt } : {}),
          },
          ...(unset.length ? { unset } : {}),
        },
      },
      {
        actionType: "sanity.action.document.publish",
        draftId: entry.id,
        ifDraftRevisionId: entry.revision,
        publishedId,
        ...(existingPublished
          ? { ifPublishedRevisionId: existingPublished._rev }
          : {}),
      },
    );
  }
  if (await isDocumentTombstoned(context.projectId, context.documentId))
    throw new NotFoundError("Document not found.");
  let transactionId: string;
  try {
    const result = await writeClient
      .withConfig({ maxRetries: 0 })
      .action(actions);
    transactionId = result.transactionId;
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 409 || status === 404)
      throw new ConflictError(
        "A selected entry changed or was removed. Reload entries before publishing.",
      );
    throw new UpstreamFailureError(
      "Publication could not be confirmed. Reload entries to check their status before retrying.",
    );
  }
  logger.info("reviewed_entries_published", {
    correlationId: context.correlationId,
    projectId: context.projectId,
    documentId: context.documentId,
    userId: context.userId,
    count: entries.length,
    transactionId,
  });
  return {
    documentId: context.documentId,
    projectId: context.projectId,
    publishedIds: entries.map((entry) => entry.id.slice("drafts.".length)),
    reviewedAt,
    transactionId,
  };
}
