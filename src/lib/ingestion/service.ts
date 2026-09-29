import { del } from "@vercel/blob";
import { writeClient } from "../sanity/clients";
import { createPublishedId, createDraftId } from "@sanity/id-utils";
import { validatePdfBuffer } from "./validator";
import { extractRulesFromPdf, type ExtractedRule } from "./extractor";
import {
  InvalidRequestError,
  UpstreamFailureError,
  AppError,
} from "../errors";
import { logger } from "../logger";

export interface IngestDocumentParams {
  blobUrl: string;
  projectId: string;
  title: string;
  industry: string;
}

export interface IngestDocumentResult {
  document: {
    id: string;
    title: string;
    processingStatus: "ready";
    pageCount: number;
    extractedRuleCount: number;
  };
  drafts: Array<{
    ruleId: string;
    draftId: string;
    ruleName: string;
  }>;
}

/**
 * Validates that a blobUrl belongs to an authorized Vercel Blob store.
 * Prevents SSRF to arbitrary internal/external URLs.
 */
export function isBlobUrlAuthorized(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    // Must be https and end with vercel-storage.com
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname.endsWith(".blob.vercel-storage.com") ||
        parsed.hostname === "blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}

/**
 * Fetches private Blob bytes server-side.
 */
async function fetchBlobBuffer(blobUrl: string): Promise<Buffer> {
  if (!isBlobUrlAuthorized(blobUrl)) {
    throw new InvalidRequestError(
      "blobUrl does not belong to authorized Vercel Blob store"
    );
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(blobUrl, { headers });
  if (!res.ok) {
    throw new InvalidRequestError(
      `Failed to fetch blob from temporary store (status: ${res.status})`
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Orchestrates the full ingestion flow:
 * 1. Fetch private blob
 * 2. Validate binary & page counts
 * 3. Upload asset to Sanity & create processing document
 * 4. Extract structured rules via Gemini
 * 5. Batch-create rule drafts via Sanity Actions API transaction
 * 6. Mark document ready
 * 7. In finally block, delete temporary Blob
 */
export async function ingestDocument(
  params: IngestDocumentParams,
  correlationId?: string
): Promise<IngestDocumentResult> {
  const { blobUrl, projectId, title, industry } = params;
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  let createdDocumentId: string | null = null;

  try {
    // 1. Fetch blob buffer
    const buffer = await fetchBlobBuffer(blobUrl);

    // 2. Validate PDF signature, bounds, and readability
    const { pageCount, fileSizeBytes } = await validatePdfBuffer(buffer);

    // 3. Upload file asset to Sanity
    let assetId: string;
    try {
      const asset = await writeClient.assets.upload("file", buffer, {
        filename: `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
        contentType: "application/pdf",
      });
      assetId = asset._id;
    } catch (uploadErr) {
      console.error("Sanity asset upload error:", (uploadErr as Error).message);
      throw new UpstreamFailureError("Failed to store PDF asset in Sanity Content Lake");
    }

    // 4. Create document in processing state
    const docId = `doc.${Date.now()}.${crypto.randomUUID().slice(0, 8)}`;
    createdDocumentId = docId;

    try {
      await writeClient.create({
        _id: docId,
        _type: "complianceDocument",
        projectId,
        title,
        fileAsset: {
          _type: "file",
          asset: {
            _type: "reference",
            _ref: assetId,
          },
        },
        industry,
        originalFileName: `${title}.pdf`,
        mimeType: "application/pdf",
        fileSizeBytes,
        pageCount,
        processingStatus: "processing",
        extractedRuleCount: 0,
        uploadedAt: new Date().toISOString(),
      });
    } catch (docErr) {
      console.error("Failed to create complianceDocument:", (docErr as Error).message);
      throw new UpstreamFailureError("Failed to create document record in Sanity");
    }

    // 5. Extract rules with Gemini
    const { rules, modelUsed } = await extractRulesFromPdf(buffer, pageCount);

    // 6. Batch create unpublished rule drafts
    const createdDrafts: Array<{ ruleId: string; draftId: string; ruleName: string }> = [];

    if (rules.length > 0) {
      const tx = writeClient.transaction();

      for (const rule of rules) {
        const publishedId = createPublishedId();
        const draftId = createDraftId(publishedId);

        tx.create({
          _id: draftId,
          _type: "complianceRule",
          projectId,
          ruleName: rule.ruleName,
          description: rule.description,
          requirement: rule.requirement,
          applicability: rule.applicability,
          industry,
          jurisdiction: rule.jurisdiction,
          regulator: rule.regulator,
          citation: rule.citation,
          evidenceExcerpt: rule.evidenceExcerpt,
          sourcePages: rule.sourcePages,
          keywords: rule.keywords,
          sourceDocument: {
            _type: "reference",
            _ref: docId,
          },
          freshnessStatus: "current",
          effectiveDate: rule.effectiveDate,
          expiresAt: rule.expiresAt,
        });

        createdDrafts.push({
          ruleId: publishedId,
          draftId,
          ruleName: rule.ruleName,
        });
      }

      try {
        await tx.commit();
      } catch (txErr) {
        console.error("Failed to commit rule drafts transaction:", (txErr as Error).message);
        throw new UpstreamFailureError("Failed to persist extracted rule drafts in Sanity");
      }
    }

    // 7. Update document to ready
    try {
      await writeClient
        .patch(docId)
        .set({
          processingStatus: "ready",
          extractedRuleCount: createdDrafts.length,
          extractionCompletedAt: new Date().toISOString(),
          extractionModel: modelUsed,
        })
        .commit();
    } catch (patchErr) {
      console.error("Failed to update document status to ready:", (patchErr as Error).message);
      // Log for operator repair, don't fail client if drafts were committed
    }

    return {
      document: {
        id: docId,
        title,
        processingStatus: "ready",
        pageCount,
        extractedRuleCount: createdDrafts.length,
      },
      drafts: createdDrafts,
    };
  } catch (error) {
    // If failure occurred after document was created, mark it failed
    if (createdDocumentId) {
      const safeMessage =
        error instanceof AppError ? error.message : "Processing failed during rule extraction";
      try {
        await writeClient
          .patch(createdDocumentId)
          .set({
            processingStatus: "failed",
            failureMessage: safeMessage,
            extractionCompletedAt: new Date().toISOString(),
          })
          .commit();
      } catch (patchErr) {
        console.error("Failed to mark document failed:", (patchErr as Error).message);
      }
    }

    throw error;
  } finally {
    // 8. Delete temporary Blob in finally boundary
    if (blobUrl && isBlobUrlAuthorized(blobUrl)) {
      try {
        await del(blobUrl, { token });
      } catch (delErr) {
        // Blob deletion failure should not crash the request; log locator for operator manual cleanup
        logger.warn("temporary_blob_delete_failed", {
          correlationId,
          blobUrl,
          error: (delErr as Error).message,
        });
      }
    }
  }
}
