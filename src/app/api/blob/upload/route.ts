import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/http";
import { ErrorCodes } from "@/lib/errors";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Enforce ingestion rate limit (5 per rolling hour per IP)
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit("ingestion", ip);
  if (!rateLimit.success) {
    return errorResponse(
      ErrorCodes.RATE_LIMITED,
      "Ingestion rate limit exceeded. You can upload up to 5 documents per hour.",
      429,
      { retryAfter: rateLimit.retryAfter },
      rateLimitHeaders(rateLimit)
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return errorResponse(
      ErrorCodes.INVALID_REQUEST,
      "Invalid JSON request body",
      400
    );
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        // Enforce server-controlled pathname & PDF-only restrictions
        const serverPathname = `uploads/${Date.now()}-${crypto.randomUUID()}.pdf`;
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: 10_485_760, // 10 MB
          pathname: serverPathname,
          tokenPayload: JSON.stringify({ authorizedAt: Date.now() }),
        };
      },
      onUploadCompleted: async () => {
        // Log receipt; extraction runs via explicit POST /api/documents/ingest
      },
    });

    return NextResponse.json(jsonResponse, {
      status: 200,
      headers: rateLimitHeaders(rateLimit),
    });
  } catch (error) {
    console.error("Blob upload token error:", (error as Error).message);
    return errorResponse(
      ErrorCodes.INVALID_REQUEST,
      (error as Error).message || "Failed to generate upload token",
      400
    );
  }
}
