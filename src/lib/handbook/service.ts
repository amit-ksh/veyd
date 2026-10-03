import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import {
  inventoryProjectSources,
  RuleSourceMismatchError,
} from "./fingerprint";
import { compileProjectHandbook } from "./compiler";
import { parseHandbookSnapshot, projectHandbookSnapshotSchema } from "./schema";
import {
  acquireHandbookLease,
  releaseHandbookLease,
  renewHandbookLease,
} from "./lease";
import { draftHandbookReader } from "./generator";
import type { HandbookResponse, ProjectHandbookSnapshot } from "./types";

export class HandbookSourceChangedError extends Error {
  constructor(
    message = "Source rules or documents changed during handbook compilation",
  ) {
    super(message);
    this.name = "HandbookSourceChangedError";
  }
}

export class HandbookRefreshRequiredError extends Error {
  constructor(
    message = "Project handbook snapshot is missing, stale, or out of sync with reviewed rules",
  ) {
    super(message);
    this.name = "HandbookRefreshRequiredError";
  }
}

/**
 * Reads the current handbook state for an authorized project.
 * Enforces removal tombstone invalidation and source fingerprint freshness.
 * Never returns stale or unvalidated snapshot content.
 */
export async function getHandbookState(params: {
  projectId: string;
  projectName?: string;
  correlationId?: string;
}): Promise<HandbookResponse> {
  const { projectId, correlationId = crypto.randomUUID() } = params;

  // 1. Verify project exists in DB
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });

  if (!project) {
    return { status: "missing", handbook: null };
  }

  const projectName = params.projectName || project.name;

  // 2. Fetch lightweight uncached source inventory and fingerprint
  const inventory = await inventoryProjectSources({
    projectId,
    projectName,
    correlationId,
  });

  // If there are no eligible rules in the project
  if (inventory.eligibleRules.length === 0) {
    const existing = await prisma.projectHandbook.findUnique({
      where: { projectId },
    });

    if (!existing || existing.status !== "empty") {
      await prisma.projectHandbook.upsert({
        where: { projectId },
        create: {
          projectId,
          status: "empty",
          sourceFingerprint: inventory.sourceFingerprint,
          documentCount: 0,
          ruleCount: 0,
          currentRuleCount: 0,
          reviewRequiredCount: 0,
          generatedAt: new Date(),
        },
        update: {
          status: "empty",
          sourceFingerprint: inventory.sourceFingerprint,
          snapshot: Prisma.DbNull,
          documentCount: 0,
          ruleCount: 0,
          currentRuleCount: 0,
          reviewRequiredCount: 0,
          generatedAt: new Date(),
          lastErrorCode: null,
        },
      });
    }

    return { status: "empty", handbook: null };
  }

  // 3. Read stored handbook snapshot from PostgreSQL
  const record = await prisma.projectHandbook.findUnique({
    where: { projectId },
  });

  if (!record || record.status === "missing") {
    return { status: "missing", handbook: null };
  }

  // If another run is actively generating
  if (record.status === "generating") {
    const started = record.generationStartedAt
      ? record.generationStartedAt.getTime()
      : 0;
    const now = Date.now();
    // Model calls are bounded at 90 seconds; allow inventory/commit overhead.
    if (now - started > 125000) {
      return { status: "stale", handbook: null };
    }
    return { status: "generating", handbook: null, retryAfterSeconds: 3 };
  }

  if (record.status === "failed") {
    return { status: "failed", handbook: null, retryAfterSeconds: 5 };
  }

  if (record.status === "empty") {
    // If rules exist now, status is stale
    return { status: "stale", handbook: null };
  }

  // 4. Validate stored snapshot with Zod
  const parsed = parseHandbookSnapshot(record.snapshot);
  if (!parsed || parsed.projectId !== projectId) {
    logger.warn("handbook_stored_snapshot_schema_invalid", {
      correlationId,
      projectId,
    });
    return { status: "stale", handbook: null };
  }

  // 5. Invalidation Check: Does the snapshot contain any tombstoned document?
  const containsTombstonedDoc = parsed.chapters.some((ch) =>
    inventory.tombstonedDocIds.has(ch.documentId),
  );
  if (containsTombstonedDoc) {
    logger.info("handbook_snapshot_invalidated_by_tombstone", {
      correlationId,
      projectId,
    });
    return { status: "stale", handbook: null };
  }

  // 6. Check fingerprint match
  if (record.sourceFingerprint !== inventory.sourceFingerprint) {
    return { status: "stale", handbook: null };
  }

  return {
    status: "ready",
    handbook: parsed,
  };
}

/**
 * Generates or regenerates a project handbook snapshot protected by a project-scoped lease.
 * Serializes generation, handles concurrent attempts, and guards against mid-compilation source mutations.
 */
export async function generateProjectHandbook(params: {
  projectId: string;
  projectName?: string;
  correlationId?: string;
}): Promise<HandbookResponse> {
  const { projectId, correlationId = crypto.randomUUID() } = params;
  const startTime = Date.now();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });

  if (!project) {
    return { status: "missing", handbook: null };
  }

  const projectName = params.projectName || project.name;

  logger.info("handbook_generation_start", {
    correlationId,
    projectId,
  });

  // 1. Check current inventory before acquiring lease
  const initialInventory = await inventoryProjectSources({
    projectId,
    projectName,
    correlationId,
  });

  if (initialInventory.eligibleRules.length === 0) {
    await prisma.projectHandbook.upsert({
      where: { projectId },
      create: {
        projectId,
        status: "empty",
        sourceFingerprint: initialInventory.sourceFingerprint,
        documentCount: 0,
        ruleCount: 0,
        currentRuleCount: 0,
        reviewRequiredCount: 0,
        generatedAt: new Date(),
      },
      update: {
        status: "empty",
        sourceFingerprint: initialInventory.sourceFingerprint,
        snapshot: Prisma.DbNull,
        documentCount: 0,
        ruleCount: 0,
        currentRuleCount: 0,
        reviewRequiredCount: 0,
        generatedAt: new Date(),
        lastErrorCode: null,
      },
    });

    return { status: "empty", handbook: null };
  }

  // Check if current ready snapshot already matches fingerprint
  const currentRecord = await prisma.projectHandbook.findUnique({
    where: { projectId },
  });

  if (
    currentRecord &&
    currentRecord.status === "ready" &&
    currentRecord.sourceFingerprint === initialInventory.sourceFingerprint
  ) {
    const parsed = parseHandbookSnapshot(currentRecord.snapshot);
    if (parsed && parsed.projectId === projectId) {
      return { status: "ready", handbook: parsed };
    }
  }

  // 2. Acquire generation lease
  const lease = await acquireHandbookLease(projectId, 120);
  if (!lease.acquired) {
    logger.info("handbook_generation_lease_contention", {
      correlationId,
      projectId,
    });
    return { status: "generating", handbook: null, retryAfterSeconds: 3 };
  }

  let leaseReleased = false;
  const generationStartedAt = new Date();

  try {
    // 3. Mark generating state in PostgreSQL
    await prisma.projectHandbook.upsert({
      where: { projectId },
      create: {
        projectId,
        status: "generating",
        sourceFingerprint: initialInventory.sourceFingerprint,
        generationStartedAt,
      },
      update: {
        status: "generating",
        generationStartedAt,
        lastErrorCode: null,
      },
    });

    // 4. Re-check inventory under lease
    const inventoryUnderLease = await inventoryProjectSources({
      projectId,
      projectName,
      correlationId,
    });

    if (inventoryUnderLease.eligibleRules.length === 0) {
      await prisma.projectHandbook.updateMany({
        where: { projectId, status: "generating", generationStartedAt },
        data: {
          status: "empty",
          sourceFingerprint: inventoryUnderLease.sourceFingerprint,
          snapshot: Prisma.DbNull,
          documentCount: 0,
          ruleCount: 0,
          currentRuleCount: 0,
          reviewRequiredCount: 0,
          generatedAt: new Date(),
        },
      });
      return { status: "empty", handbook: null };
    }

    // 5. Compile structured snapshot in memory
    const candidateSnapshot = compileProjectHandbook({
      projectId,
      projectName,
      sourceFingerprint: inventoryUnderLease.sourceFingerprint,
      eligibleRules: inventoryUnderLease.eligibleRules,
      eligibleDocuments: inventoryUnderLease.eligibleDocuments,
    });
    candidateSnapshot.reader = await draftHandbookReader(candidateSnapshot);

    // Validate with Zod
    const validationResult =
      projectHandbookSnapshotSchema.safeParse(candidateSnapshot);
    if (!validationResult.success) {
      logger.error("handbook_candidate_validation_failed", {
        correlationId,
        projectId,
        errors: validationResult.error.flatten(),
      });
      throw new Error("Handbook candidate snapshot failed schema validation");
    }

    // 6. Pre-commit invariant check: Re-verify that source fingerprint has not changed
    const postCompileInventory = await inventoryProjectSources({
      projectId,
      projectName,
      correlationId,
    });

    if (
      postCompileInventory.sourceFingerprint !==
      inventoryUnderLease.sourceFingerprint
    ) {
      logger.warn("handbook_source_changed_during_compilation", {
        correlationId,
        projectId,
        initialFingerprint: inventoryUnderLease.sourceFingerprint,
        postCompileFingerprint: postCompileInventory.sourceFingerprint,
      });

      await prisma.projectHandbook.updateMany({
        where: { projectId, status: "generating", generationStartedAt },
        data: {
          status: "stale",
          lastErrorCode: "HANDBOOK_SOURCE_CHANGED",
        },
      });

      throw new HandbookSourceChangedError();
    }

    // A timed-out worker cannot overwrite a newer generation or removal invalidation.
    if (!(await renewHandbookLease(projectId, lease.leaseId)))
      throw new HandbookSourceChangedError(
        "Generation lease expired. Please retry.",
      );
    const committed = await prisma.projectHandbook.updateMany({
      where: { projectId, status: "generating", generationStartedAt },
      data: {
        status: "ready",
        sourceFingerprint: candidateSnapshot.sourceFingerprint,
        snapshot: candidateSnapshot as any,
        documentCount: candidateSnapshot.documentCount,
        ruleCount: candidateSnapshot.ruleCount,
        currentRuleCount: candidateSnapshot.currentRuleCount,
        reviewRequiredCount: candidateSnapshot.reviewRequiredRuleCount,
        generatedAt: new Date(),
        lastErrorCode: null,
      },
    });
    if (committed.count !== 1) throw new HandbookSourceChangedError();

    logger.info("handbook_generation_complete", {
      correlationId,
      projectId,
      documentCount: candidateSnapshot.documentCount,
      ruleCount: candidateSnapshot.ruleCount,
      durationMs: Date.now() - startTime,
    });

    return {
      status: "ready",
      handbook: candidateSnapshot,
    };
  } catch (err: any) {
    if (
      err instanceof HandbookSourceChangedError ||
      err instanceof RuleSourceMismatchError
    ) {
      await prisma.projectHandbook
        .updateMany({
          where: { projectId, status: "generating", generationStartedAt },
          data: {
            status: "failed",
            lastErrorCode: err.name,
          },
        })
        .catch(() => {});
      throw err;
    }

    logger.error("handbook_generation_failed", {
      correlationId,
      projectId,
      errorCode: "GENERATION_ERROR",
    });

    await prisma.projectHandbook
      .updateMany({
        where: { projectId, status: "generating", generationStartedAt },
        data: {
          status: "failed",
          lastErrorCode: "GENERATION_ERROR",
        },
      })
      .catch(() => {});

    throw err;
  } finally {
    if (!leaseReleased) {
      await releaseHandbookLease(projectId, lease.leaseId).catch(() => {});
      leaseReleased = true;
    }
  }
}
