import { NextRequest, NextResponse } from "next/server";
import { getComplianceDocumentById } from "@/lib/sanity/queries";
import { handleApiError, successResponse, errorResponse } from "@/lib/http";
import { ErrorCodes } from "@/lib/errors";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    documentId: string;
  };
}

export async function GET(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { documentId } = params;

  if (!documentId) {
    return errorResponse(ErrorCodes.INVALID_REQUEST, "documentId is required", 400);
  }

  try {
    const document = await getComplianceDocumentById(documentId);
    if (!document) {
      return errorResponse(
        ErrorCodes.NOT_FOUND,
        `Compliance document not found for ID: ${documentId}`,
        404
      );
    }

    return successResponse({ document });
  } catch (error) {
    return handleApiError(error);
  }
}
