import { prisma } from "@/lib/prisma";

if (typeof window !== "undefined") {
  throw new Error("Cannot import server tombstone service in client-side code");
}

/**
 * Returns all document IDs in a project that have an active removal tombstone.
 * Active removal includes "pending", "deleting", "complete", or "failed".
 * All search, detail, chat, and MCP queries exclude these document IDs immediately.
 */
export async function getTombstonedDocumentIds(projectId: string): Promise<string[]> {
  if (!projectId) return [];

  const tombstones = await prisma.removedComplianceSource.findMany({
    where: {
      projectId,
      deletionStatus: { in: ["pending", "deleting", "complete", "failed"] },
    },
    select: { documentId: true },
  });

  return tombstones.map((t) => t.documentId);
}

/**
 * Checks if a specific document in a project is tombstoned.
 */
export async function isDocumentTombstoned(projectId: string, documentId: string): Promise<boolean> {
  if (!projectId || !documentId) return false;

  const tombstone = await prisma.removedComplianceSource.findUnique({
    where: {
      projectId_documentId: {
        projectId,
        documentId,
      },
    },
    select: { id: true, deletionStatus: true },
  });

  return !!tombstone;
}

/**
 * Retrieves the full tombstone record if it exists for this project and document.
 */
export async function getTombstone(projectId: string, documentId: string) {
  if (!projectId || !documentId) return null;

  return prisma.removedComplianceSource.findUnique({
    where: {
      projectId_documentId: {
        projectId,
        documentId,
      },
    },
  });
}
