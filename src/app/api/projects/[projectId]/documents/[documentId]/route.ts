import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getPublishedDocumentById } from "@/lib/sanity/published-queries";
import { getAuthorizedProject } from "@/lib/projects/service";
import {
  removeDocumentFromProject,
  DeletionInProgressError,
  DocumentNotFoundError,
  DeletionConflictError,
} from "@/lib/tombstones/remover";
import { handleRouteError, errorResponse, successResponse } from "@/lib/http";
import { ErrorCodes } from "@/lib/errors";
import { getOrCreateCorrelationId } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    projectId: string;
    documentId: string;
  };
}

const removeDocumentSchema = z.object({
  confirmDocumentId: z.string().min(1, "confirmDocumentId is required"),
});

/**
 * GET /api/projects/[projectId]/documents/[documentId]
 * Retrieves details for a specific published document in this project.
 */
export async function GET(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const correlationId = getOrCreateCorrelationId(req);
  const { projectId, documentId } = params;

  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        "Authentication required to view document.",
        401,
        undefined,
        correlationId
      );
    }

    const authorized = await getAuthorizedProject(projectId, session.user.id);
    if (!authorized) {
      return errorResponse(
        ErrorCodes.NOT_FOUND,
        `Document not found.`,
        404,
        undefined,
        correlationId
      );
    }

    const document = await getPublishedDocumentById(documentId, projectId);
    if (!document) {
      return errorResponse(
        ErrorCodes.NOT_FOUND,
        `Document not found.`,
        404,
        undefined,
        correlationId
      );
    }

    return successResponse({ document }, 200, correlationId);
  } catch (error) {
    return handleRouteError(error, {
      route: "GET /api/projects/[projectId]/documents/[documentId]",
      correlationId,
      metadata: { projectId, documentId },
    });
  }
}

/**
 * DELETE /api/projects/[projectId]/documents/[documentId]
 * Safely removes a compliance document and its derived rules from active project context.
 */
export async function DELETE(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const correlationId = getOrCreateCorrelationId(req);
  const { projectId, documentId } = params;

  try {
    // 1. Authenticate user
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        "Authentication required to remove document.",
        401,
        undefined,
        correlationId
      );
    }

    // 2. Authorize project ownership
    const authorized = await getAuthorizedProject(projectId, session.user.id);
    if (!authorized) {
      // Non-enumerating 404
      return errorResponse(
        ErrorCodes.NOT_FOUND,
        "Document not found.",
        404,
        undefined,
        correlationId
      );
    }

    // 3. Validate request payload and exact confirmDocumentId match
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse(
        ErrorCodes.INVALID_REQUEST,
        "Invalid JSON request body. 'confirmDocumentId' is required.",
        400,
        undefined,
        correlationId
      );
    }

    const parsed = removeDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        ErrorCodes.INVALID_REQUEST,
        "confirmDocumentId is required and must match document ID",
        400,
        { issues: parsed.error.issues },
        correlationId
      );
    }

    if (parsed.data.confirmDocumentId !== documentId) {
      return errorResponse(
        ErrorCodes.INVALID_REQUEST,
        `Confirmation mismatch. confirmDocumentId '${parsed.data.confirmDocumentId}' does not match target document '${documentId}'.`,
        400,
        undefined,
        correlationId
      );
    }

    // 4. Perform bounded, idempotent removal
    const result = await removeDocumentFromProject({
      projectId,
      documentId,
      userId: session.user.id,
      correlationId,
    });

    return successResponse(result, 200, correlationId);
  } catch (error) {
    if (error instanceof DeletionInProgressError) {
      return errorResponse(
        ErrorCodes.CONFLICT,
        error.message,
        409,
        { errorCode: "DELETION_IN_PROGRESS" },
        correlationId
      );
    }

    if (error instanceof DocumentNotFoundError) {
      return errorResponse(
        ErrorCodes.NOT_FOUND,
        "Document not found.",
        404,
        undefined,
        correlationId
      );
    }

    if (error instanceof DeletionConflictError) {
      return errorResponse(
        ErrorCodes.CONFLICT,
        error.message,
        409,
        { errorCode: "DELETION_CONFLICT" },
        correlationId
      );
    }

    return handleRouteError(error, {
      route: "DELETE /api/projects/[projectId]/documents/[documentId]",
      correlationId,
      metadata: { projectId, documentId },
    });
  }
}
