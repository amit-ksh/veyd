import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  getDocumentReview,
  publishReviewedSelection,
} from "@/lib/review/service";
import { errorResponse, handleApiError, successResponse } from "@/lib/http";
import { ErrorCodes } from "@/lib/errors";
import { getOrCreateCorrelationId } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
interface RouteContext {
  params: { projectId: string; documentId: string };
}
const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const correlationId = getOrCreateCorrelationId(req);
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id)
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        "Sign in to review entries.",
        401,
        undefined,
        correlationId,
      );
    const result = await getDocumentReview({
      ...params,
      userId: session.user.id,
      correlationId,
    });
    return successResponse(result, 200, privateHeaders, correlationId);
  } catch (error) {
    return handleApiError(
      error,
      correlationId,
      "GET /api/projects/[projectId]/documents/[documentId]/review",
    );
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const correlationId = getOrCreateCorrelationId(req);
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id)
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        "Sign in to publish reviewed entries.",
        401,
        undefined,
        correlationId,
      );
    const origin = req.headers.get("origin");
    if (origin && origin !== req.nextUrl.origin)
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        "This request must come from the application.",
        403,
        undefined,
        correlationId,
      );
    if (!req.headers.get("content-type")?.includes("application/json"))
      return errorResponse(
        ErrorCodes.INVALID_REQUEST,
        "Send a JSON review confirmation.",
        400,
        undefined,
        correlationId,
      );
    const text = await req.text();
    if (text.length > 1_000_000)
      return errorResponse(
        ErrorCodes.INVALID_REQUEST,
        "Select fewer entries and try again.",
        413,
        undefined,
        correlationId,
      );
    let input: unknown;
    try {
      input = JSON.parse(text);
    } catch {
      return errorResponse(
        ErrorCodes.INVALID_REQUEST,
        "Invalid review confirmation.",
        400,
        undefined,
        correlationId,
      );
    }
    const result = await publishReviewedSelection(
      { ...params, userId: session.user.id, correlationId },
      input,
    );
    return successResponse(result, 200, privateHeaders, correlationId);
  } catch (error) {
    return handleApiError(
      error,
      correlationId,
      "POST /api/projects/[projectId]/documents/[documentId]/review",
    );
  }
}
