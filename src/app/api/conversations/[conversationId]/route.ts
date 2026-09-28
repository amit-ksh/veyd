import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { errorResponse, handleRouteError } from "@/lib/http";
import { getOrCreateCorrelationId, logger } from "@/lib/logger";
import { ErrorCodes } from "@/lib/errors";
import { getConversation } from "@/lib/conversations/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  const correlationId = getOrCreateCorrelationId(req);
  try {
    // 1. Authenticate user session
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        "Authentication required to access conversation records.",
        401,
        undefined,
        correlationId
      );
    }

    const { conversationId } = params;
    if (!conversationId || typeof conversationId !== "string") {
      return errorResponse(
        ErrorCodes.INVALID_REQUEST,
        "Invalid or missing conversationId parameter.",
        400,
        undefined,
        correlationId
      );
    }

    // 2. Exact read scoped strictly to user
    const result = await getConversation(conversationId, session.user.id);

    if (!result) {
      // Non-enumerating 404: never reveals whether ID exists under another user
      return errorResponse(
        ErrorCodes.NOT_FOUND,
        "Conversation not found.",
        404,
        undefined,
        correlationId
      );
    }

    logger.info("conversation_read_success", {
      correlationId,
      conversationId,
      messageCount: result.messages?.length ?? 0,
    });

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "X-Correlation-Id": correlationId,
      },
    });
  } catch (error) {
    return handleRouteError(error, {
      route: "GET /api/conversations/[conversationId]",
      correlationId,
      metadata: { conversationId: params?.conversationId },
    });
  }
}
