import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ingestDocument } from "@/lib/ingestion/service";
import { handleApiError, errorResponse, successResponse } from "@/lib/http";
import { ErrorCodes } from "@/lib/errors";
import { logger, getOrCreateCorrelationId } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300; // 300s maximum duration for Vercel synchronous ingestion
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { getAuthorizedProject } from "@/lib/projects/service";

const ingestRequestSchema = z.object({
  blobUrl: z.string().url("A valid blobUrl is required"),
  projectId: z.string().min(1, "projectId is required"),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title must be between 1 and 200 characters"),
  industry: z
    .string()
    .trim()
    .min(1, "Industry is required")
    .max(100, "Industry must be between 1 and 100 characters"),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = getOrCreateCorrelationId(req);
  const startTime = Date.now();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(
      ErrorCodes.INVALID_REQUEST,
      "Invalid JSON request body",
      400,
      undefined,
      correlationId
    );
  }

  const parsed = ingestRequestSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join(", ");
    logger.warn("ingest_validation_failed", {
      correlationId,
      route: "/api/documents/ingest",
      issues: parsed.error.issues.map((i) => i.message),
    });
    return errorResponse(
      ErrorCodes.INVALID_REQUEST,
      message,
      400,
      { issues: parsed.error.issues },
      correlationId
    );
  }

  // Authorize user owns the project
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session?.user?.id) {
    return errorResponse(
      ErrorCodes.UNAUTHORIZED,
      "Authentication required to ingest documents",
      401,
      undefined,
      correlationId
    );
  }

  const authorized = await getAuthorizedProject(parsed.data.projectId, session.user.id);
  if (!authorized) {
    return errorResponse(
      ErrorCodes.NOT_FOUND,
      "Project not found.",
      404,
      undefined,
      correlationId
    );
  }

  logger.info("ingest_request_start", {
    correlationId,
    route: "/api/documents/ingest",
    projectId: parsed.data.projectId,
  });

  try {
    const result = await ingestDocument(parsed.data, correlationId);
    const durationMs = Date.now() - startTime;

    logger.info("ingest_request_success", {
      correlationId,
      route: "/api/documents/ingest",
      documentId: result.document.id,
      extractedRuleCount: result.document.extractedRuleCount,
      pageCount: result.document.pageCount,
      durationMs,
    });

    return successResponse(result, 201, undefined, correlationId);
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error("ingest_request_failed", {
      correlationId,
      route: "/api/documents/ingest",
      durationMs,
    });
    return handleApiError(error, correlationId, "/api/documents/ingest");
  }
}
