import { NextResponse } from "next/server";
import { checkServerConfigShape } from "@/lib/config";
import { successResponse, errorResponse } from "@/lib/http";
import { ErrorCodes } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * Health check endpoint.
 * Verifies configuration shape without making calls to paid upstream APIs.
 */
export async function GET() {
  const shape = checkServerConfigShape();

  if (!shape.valid) {
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      `Server configuration missing required variables: ${shape.missing.join(", ")}`,
      503,
      { missing: shape.missing }
    );
  }

  return successResponse({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "compliance-handbook",
    milestone: "1-foundation",
    config: {
      projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ? "configured" : "missing",
      dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
      apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2026-03-01",
      geminiModel: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    },
  });
}
