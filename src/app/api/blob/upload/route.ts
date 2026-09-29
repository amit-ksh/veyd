import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/http";
import { ErrorCodes } from "@/lib/errors";
import { logger, getOrCreateCorrelationId } from "@/lib/logger";

import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = getOrCreateCorrelationId(req);

  // Authenticate session
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session?.user?.id) {
    return errorResponse(
      ErrorCodes.UNAUTHORIZED,
      "Authentication required to upload documents",
      401,
      undefined,
      undefined,
      correlationId
    );
  }

  // 1. Enforce ingestion rate limit (5 per rolling hour per IP)
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit("ingestion", ip);
  if (!rateLimit.success) {
    logger.warn("ingestion_rate_limited", {
      correlationId,
      route: "/api/blob/upload",
      clientIp: ip === "127.0.0.1" ? "localhost" : "remote",
    });
    return errorResponse(
      ErrorCodes.RATE_LIMITED,
      "Ingestion rate limit exceeded. You can upload up to 5 documents per hour.",
      429,
      { retryAfter: rateLimit.retryAfter },
      rateLimitHeaders(rateLimit),
      correlationId
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

    const headers = new Headers(rateLimitHeaders(rateLimit));
    headers.set("X-Correlation-Id", correlationId);

    logger.info("blob_upload_token_issued", {
      correlationId,
      route: "/api/blob/upload",
    });

    return NextResponse.json(jsonResponse, {
      status: 200,
      headers,
    });
  } catch (error) {
    logger.error("blob_upload_token_failed", {
      correlationId,
      route: "/api/blob/upload",
      error: (error as Error).message,
    });
    return errorResponse(
      ErrorCodes.INVALID_REQUEST,
      (error as Error).message || "Failed to generate upload token",
      400,
      undefined,
      undefined,
      correlationId
    );
  }
}
