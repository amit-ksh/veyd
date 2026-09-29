import { prisma } from "@/lib/prisma";
import { writeClient, publishedClient } from "@/lib/sanity/clients";
import { acquireDeletionLease, releaseDeletionLease } from "@/lib/tombstones/lease";
import { logger } from "@/lib/logger";

if (typeof window !== "undefined") {
  throw new Error("Cannot import server document remover in client-side code");
}

export class DeletionInProgressError extends Error {
  constructor(message: string = "Document deletion is currently in progress") {
    super(message);
    this.name = "DeletionInProgressError";
  }
}

export class DocumentNotFoundError extends Error {
  constructor(message: string = "Document not found") {
    super(message);
    this.name = "DocumentNotFoundError";
  }
}

export class DeletionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeletionConflictError";
  }
}

export type RemoveDocumentResult = {
  documentId: string;
  status: "removed";
  removedRuleCount: number;
  assetStatus: "deleted" | "retained-shared" | "not-found";
  removedAt: string;
};

interface InventoryDoc {
  _id: string;
  _rev: string;
  projectId?: string;
  title?: string;
  fileAsset?: {
    asset?: {
      _ref?: string;
    };
  };
}

interface InventoryRule {
  _id: string;
  _rev: string;
  projectId?: string;
  ruleName?: string;
}

/**
 * Safely removes a compliance document and all derived rules from the active project context.
 * Bounded, idempotent, and resilient to failure/resumption across stores.
 */
export async function removeDocumentFromProject(params: {
  projectId: string;
  documentId: string;
  userId: string;
  correlationId?: string;
}): Promise<RemoveDocumentResult> {
  const { projectId, documentId, userId, correlationId = crypto.randomUUID() } = params;
  const startTime = Date.now();

  logger.info("document_removal_start", {
    correlationId,
    projectId,
    documentId,
    userId,
  });

  // 1. Check existing tombstone before acquiring lease
  const existingTombstone = await prisma.removedComplianceSource.findUnique({
    where: {
      projectId_documentId: {
        projectId,
        documentId,
      },
    },
  });

  if (existingTombstone && existingTombstone.deletionStatus === "complete") {
    logger.info("document_removal_idempotent_complete", {
      correlationId,
      projectId,
      documentId,
      removedAt: existingTombstone.removedAt.toISOString(),
    });

    return {
      documentId,
      status: "removed",
      removedRuleCount: existingTombstone.removedRuleCount ?? 0,
      assetStatus: (existingTombstone.assetStatus as any) || "not-found",
      removedAt: existingTombstone.removedAt.toISOString(),
    };
  }

  // 2. Acquire exclusive deletion lease
  const { acquired, leaseId } = await acquireDeletionLease(projectId, documentId, 90);
  if (!acquired) {
    logger.warn("document_removal_lease_conflict", {
      correlationId,
      projectId,
      documentId,
    });
    throw new DeletionInProgressError(
      "A deletion operation for this document is already in progress. Please wait a moment."
    );
  }

  try {
    // Re-check tombstone under lease
    const tombstoneUnderLease = await prisma.removedComplianceSource.findUnique({
      where: {
        projectId_documentId: {
          projectId,
          documentId,
        },
      },
    });

    if (tombstoneUnderLease && tombstoneUnderLease.deletionStatus === "complete") {
      return {
        documentId,
        status: "removed",
        removedRuleCount: tombstoneUnderLease.removedRuleCount ?? 0,
        assetStatus: (tombstoneUnderLease.assetStatus as any) || "not-found",
        removedAt: tombstoneUnderLease.removedAt.toISOString(),
      };
    }

    // 3. Uncached inventory through raw perspective
    // Query both base and draft versions of the document
    const baseId = documentId.replace(/^drafts\./, "");
    const draftId = `drafts.${baseId}`;

    const candidateDocs = await writeClient.fetch<InventoryDoc[]>(
      `*[_type == "complianceDocument" && (_id == $baseId || _id == $draftId)]{
        _id, _rev, projectId, title, fileAsset { asset { _ref } }
      }`,
      { baseId, draftId }
    );

    // If no document exists in Sanity
    if (candidateDocs.length === 0) {
      if (tombstoneUnderLease) {
        // Document was already removed from Sanity in a previous run; finalize tombstone
        const assetStatus = (tombstoneUnderLease.assetStatus as any) || "not-found";
        await prisma.removedComplianceSource.update({
          where: { id: tombstoneUnderLease.id },
          data: {
            deletionStatus: "complete",
            assetStatus,
            removedAt: new Date(),
          },
        });

        return {
          documentId,
          status: "removed",
          removedRuleCount: tombstoneUnderLease.removedRuleCount ?? 0,
          assetStatus,
          removedAt: new Date().toISOString(),
        };
      }

      // Non-enumerating 404: neither document nor tombstone exists
      throw new DocumentNotFoundError(`Compliance document not found: ${documentId}`);
    }

    // Verify project authorization for all physical document variants
    const mainDoc = candidateDocs.find((d) => d._id === baseId) || candidateDocs[0];
    for (const d of candidateDocs) {
      if (d.projectId && d.projectId !== projectId) {
        logger.warn("document_removal_project_mismatch", {
          correlationId,
          expectedProjectId: projectId,
          docProjectId: d.projectId,
          docId: d._id,
        });
        throw new DocumentNotFoundError(`Compliance document not found: ${documentId}`);
      }
    }

    const docTitle = mainDoc.title || "Untitled Document";
    const sourceAssetId = mainDoc.fileAsset?.asset?._ref || null;
    const docIdsToDelete = candidateDocs.map((d) => d._id);

    // 4. Inventory all rules strongly referencing this document (published, drafts, releases)
    const candidateRules = await writeClient.fetch<InventoryRule[]>(
      `*[_type == "complianceRule" && (sourceDocument._ref == $baseId || sourceDocument._ref == $draftId)]{
        _id, _rev, projectId, ruleName
      }`,
      { baseId, draftId }
    );

    // Safety check: ensure no candidate rule belongs to a different project
    for (const r of candidateRules) {
      if (r.projectId && r.projectId !== projectId) {
        logger.error("document_removal_cross_project_reference", {
          correlationId,
          projectId,
          ruleId: r._id,
          ruleProjectId: r.projectId,
        });
        throw new DeletionConflictError(
          `Security invariant violated: Derived rule ${r._id} belongs to project ${r.projectId} instead of ${projectId}. Deletion aborted.`
        );
      }
    }

    const ruleIdsToDelete = candidateRules.map((r) => r._id);

    // 5. Persist the PostgreSQL tombstone in "deleting" status before destructive work
    const tombstone = await prisma.removedComplianceSource.upsert({
      where: {
        projectId_documentId: {
          projectId,
          documentId: baseId,
        },
      },
      create: {
        projectId,
        documentId: baseId,
        documentTitle: docTitle,
        removedByUserId: userId,
        removedAt: new Date(),
        deletionStatus: "deleting",
        sourceAssetId,
        deletionPlan: {
          docIds: docIdsToDelete,
          ruleIds: ruleIdsToDelete,
          cursor: 0,
        },
        removedRuleCount: ruleIdsToDelete.length,
      },
      update: {
        deletionStatus: "deleting",
        documentTitle: docTitle,
        sourceAssetId,
        deletionPlan: {
          docIds: docIdsToDelete,
          ruleIds: ruleIdsToDelete,
          cursor: 0,
        },
        removedRuleCount: ruleIdsToDelete.length,
      },
    });

    let sanityTransactionId: string | null = null;
    const BATCH_SIZE = 50;

    // 6. Delete Sanity content (atomic if fits, bounded cursor-backed batches otherwise)
    if (ruleIdsToDelete.length <= BATCH_SIZE) {
      // ATOMIC PATH: Delete all rules first, then all doc variants in one transaction
      const tx = writeClient.transaction();
      for (const rId of ruleIdsToDelete) {
        tx.delete(rId);
      }
      for (const dId of docIdsToDelete) {
        tx.delete(dId);
      }

      const commitRes = await tx.commit({ visibility: "sync" });
      sanityTransactionId = commitRes.transactionId;
    } else {
      // OVERSIZED FAMILY PATH: Deterministic bounded batches for rules
      for (let i = 0; i < ruleIdsToDelete.length; i += BATCH_SIZE) {
        const batch = ruleIdsToDelete.slice(i, i + BATCH_SIZE);
        const tx = writeClient.transaction();
        for (const rId of batch) {
          tx.delete(rId);
        }
        await tx.commit({ visibility: "sync" });

        // Update cursor in tombstone for observability and recovery
        await prisma.removedComplianceSource.update({
          where: { id: tombstone.id },
          data: {
            deletionPlan: {
              docIds: docIdsToDelete,
              ruleIds: ruleIdsToDelete,
              cursor: i + batch.length,
            },
          },
        });
      }

      // Verify no strong references remain before deleting document variants
      const remainingRefs = await writeClient.fetch<number>(
        `count(*[_type == "complianceRule" && (sourceDocument._ref == $baseId || sourceDocument._ref == $draftId)])`,
        { baseId, draftId }
      );

      if (remainingRefs > 0) {
        throw new DeletionConflictError(
          `Cannot delete source document: ${remainingRefs} dependent rule variants still remain.`
        );
      }

      const docTx = writeClient.transaction();
      for (const dId of docIdsToDelete) {
        docTx.delete(dId);
      }
      const docCommitRes = await docTx.commit({ visibility: "sync" });
      sanityTransactionId = docCommitRes.transactionId;
    }

    // 7. Unshared File Asset Deletion
    let assetStatus: "deleted" | "retained-shared" | "not-found" = "not-found";
    if (sourceAssetId) {
      try {
        const allDeletedIds = [...docIdsToDelete, ...ruleIdsToDelete];
        const sharedRefsCount = await writeClient.fetch<number>(
          `count(*[references($sourceAssetId) && !(_id in $allDeletedIds)])`,
          { sourceAssetId, allDeletedIds }
        );

        if (sharedRefsCount === 0) {
          await writeClient.delete(sourceAssetId);
          assetStatus = "deleted";
          logger.info("document_removal_asset_deleted", {
            correlationId,
            projectId,
            sourceAssetId,
          });
        } else {
          assetStatus = "retained-shared";
          logger.info("document_removal_asset_retained_shared", {
            correlationId,
            projectId,
            sourceAssetId,
            survivingReferences: sharedRefsCount,
          });
        }
      } catch (assetErr) {
        logger.warn("document_removal_asset_deletion_failed", {
          correlationId,
          projectId,
          sourceAssetId,
          error: (assetErr as Error).message,
        });
        assetStatus = "retained-shared";
      }
    }

    // 8. Verification: Confirm absence from live search/published store
    const survivingInSearch = await publishedClient.fetch<number>(
      `count(*[(_type in ["complianceDocument", "complianceRule"]) && (_id == $baseId || sourceDocument._ref == $baseId)])`,
      { baseId }
    );

    if (survivingInSearch > 0) {
      logger.warn("document_removal_eventual_consistency_lag", {
        correlationId,
        projectId,
        documentId: baseId,
        survivingCount: survivingInSearch,
      });
    }

    // 9. Mark tombstone complete
    const completionTime = new Date();
    await prisma.removedComplianceSource.update({
      where: { id: tombstone.id },
      data: {
        deletionStatus: "complete",
        sanityTransaction: sanityTransactionId,
        assetStatus,
        removedRuleCount: ruleIdsToDelete.length,
        removedAt: completionTime,
        lastErrorCode: null,
      },
    });

    const durationMs = Date.now() - startTime;
    logger.info("document_removal_completed", {
      correlationId,
      projectId,
      documentId: baseId,
      removedRuleCount: ruleIdsToDelete.length,
      assetStatus,
      durationMs,
    });

    return {
      documentId: baseId,
      status: "removed",
      removedRuleCount: ruleIdsToDelete.length,
      assetStatus,
      removedAt: completionTime.toISOString(),
    };
  } catch (err: any) {
    const isExpected =
      err instanceof DeletionInProgressError || err instanceof DocumentNotFoundError;

    if (!isExpected) {
      logger.error("document_removal_failed", {
        correlationId,
        projectId,
        documentId,
        error: err.message,
      });

      // Update tombstone to failed for retry visibility
      await prisma.removedComplianceSource
        .updateMany({
          where: { projectId, documentId },
          data: {
            deletionStatus: "failed",
            lastErrorCode: err.message?.slice(0, 200) || "UNKNOWN_FAILURE",
          },
        })
        .catch(() => {});
    }

    throw err;
  } finally {
    await releaseDeletionLease(projectId, documentId, leaseId);
  }
}
