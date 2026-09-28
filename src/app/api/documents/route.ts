import { NextRequest, NextResponse } from "next/server";
import { getComplianceDocuments } from "@/lib/sanity/queries";
import { handleApiError, successResponse } from "@/lib/http";
import { getOrCreateCorrelationId } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const correlationId = getOrCreateCorrelationId(req);
  try {
    const documents = await getComplianceDocuments();
    return successResponse({ documents }, 200, undefined, correlationId);
  } catch (error) {
    return handleApiError(error, correlationId, "/api/documents");
  }
}
