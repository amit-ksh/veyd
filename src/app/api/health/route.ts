import { NextRequest } from "next/server";
import { checkServerConfigShape } from "@/lib/config";
import { successResponse, errorResponse } from "@/lib/http";
import { ErrorCodes } from "@/lib/errors";
import { getOrCreateCorrelationId } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health check endpoint.
 * Verifies configuration shape without making calls to paid upstream APIs.
 */
export async function GET(req: NextRequest) {
  const correlationId = getOrCreateCorrelationId(req);
  const shape = checkServerConfigShape();

  if (!shape.valid) {
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      `Server configuration missing required variables: ${shape.missing.join(", ")}`,
      503,
      { missing: shape.missing },
      correlationId
    );
  }

  return successResponse(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "veyd",
      milestone: "1-foundation",
      config: {
        projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ? "configured" : "missing",
        dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
        apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2026-03-01",
        geminiModel: process.env.GEMINI_MODEL || "gemini-3.8-flash",
      },
    },
    200,
    correlationId
  );
}
