import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { chatFileInputSchema, importChatFile } from "@/lib/chat-files/service";
import { errorResponse, handleApiError, successResponse } from "@/lib/http";
import { ErrorCodes, InvalidRequestError } from "@/lib/errors";
import { getClientIp } from "@/lib/rate-limit";
import { getOrCreateCorrelationId } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  const correlationId = getOrCreateCorrelationId(req);
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user.id)
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        "Sign in to add a document.",
        401,
        undefined,
        correlationId,
      );
    if (
      !req.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    )
      throw new InvalidRequestError("Send document confirmation as JSON.");
    const parsed = chatFileInputSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success)
      throw new InvalidRequestError(
        "Confirm the project, document name and valid PDF source.",
      );
    const result = await importChatFile(parsed.data, {
      userId: session.user.id,
      projectId: params.projectId,
      correlationId,
      clientIp: getClientIp(req),
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(250_000)]),
    });
    // A failed/processing receipt is a completed metadata response, not a claim of successful ingestion.
    return successResponse(
      result,
      result.file.status === "ready" ? 201 : 200,
      { "Cache-Control": "no-store" },
      correlationId,
    );
  } catch (error) {
    return handleApiError(error, correlationId, "chat-files/ingest");
  }
}
