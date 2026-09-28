import { NextRequest, NextResponse } from "next/server";
import { getComplianceDocumentById } from "@/lib/sanity/queries";
import { handleRouteError, successResponse, errorResponse } from "@/lib/http";
import { getOrCreateCorrelationId } from "@/lib/logger";
import { ErrorCodes } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    documentId: string;
  };
}

export async function GET(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const correlationId = getOrCreateCorrelationId(req);
  const { documentId } = params;

  if (!documentId) {
    return errorResponse(ErrorCodes.INVALID_REQUEST, "documentId is required", 400, undefined, correlationId);
  }

  try {
    const document = await getComplianceDocumentById(documentId);
    if (!document) {
      return errorResponse(
        ErrorCodes.NOT_FOUND,
        `Compliance document not found for ID: ${documentId}`,
        404,
        undefined,
        correlationId
      );
    }

    return successResponse({ document }, 200, correlationId);
  } catch (error) {
    return handleRouteError(error, {
      route: "GET /api/documents/[documentId]",
      correlationId,
      metadata: { documentId },
    });
  }
}
