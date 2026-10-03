import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getAuthorizedProject } from "@/lib/projects/service";
import { chatUploadPath } from "@/lib/chat-files/service";
import { errorResponse, handleApiError } from "@/lib/http";
import {
  ErrorCodes,
  InvalidRequestError,
  RateLimitedError,
} from "@/lib/errors";
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { getOrCreateCorrelationId } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  const correlationId = getOrCreateCorrelationId(req);
  try {
    const body = (await req.json().catch(() => {
      throw new InvalidRequestError("Invalid PDF upload request.");
    })) as HandleUploadBody;
    let headers: HeadersInit = {};
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, payload) => {
        const session = await auth.api.getSession({ headers: req.headers });
        if (!session?.user.id) throw new AppUnauthorized();
        const project = await getAuthorizedProject(
          params.projectId,
          session.user.id,
        );
        let uploadPayload: unknown;
        try {
          uploadPayload = JSON.parse(payload || "null");
        } catch {
          throw new InvalidRequestError("Invalid PDF upload request.");
        }
        const parsed = z
          .object({ requestId: z.string().uuid() })
          .strict()
          .safeParse(uploadPayload);
        if (
          !parsed.success ||
          pathname !== chatUploadPath(project.id, parsed.data.requestId)
        )
          throw new InvalidRequestError(
            "The PDF upload must belong to the selected project.",
          );
        const limit = await checkRateLimit("ingestion", getClientIp(req));
        if (!limit.success)
          throw new RateLimitedError(
            "You can add up to 5 documents per hour.",
            limit.retryAfter,
          );
        headers = rateLimitHeaders(limit);
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: 10_485_760,
          addRandomSuffix: false,
          allowOverwrite: false,
          validUntil: Date.now() + 15 * 60_000,
          tokenPayload: JSON.stringify({ projectId: project.id }),
        };
      },
      // The SDK verifies the signed Vercel callback. No ingestion runs from a callback.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result, { headers });
  } catch (error) {
    if (error instanceof AppUnauthorized)
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        "Sign in to upload a PDF.",
        401,
      );
    return handleApiError(error, correlationId, "chat-files/upload");
  }
}
class AppUnauthorized extends Error {}
