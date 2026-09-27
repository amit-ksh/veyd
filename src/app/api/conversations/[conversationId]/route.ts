import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { ErrorCodes } from "@/lib/errors";
import { getConversation } from "@/lib/conversations/service";

export async function GET(
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  // 1. Authenticate user session
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session?.user?.id) {
    return errorResponse(
      ErrorCodes.UNAUTHORIZED,
      "Authentication required to access conversation records.",
      401
    );
  }

  const { conversationId } = params;
  if (!conversationId || typeof conversationId !== "string") {
    return errorResponse(
      ErrorCodes.INVALID_REQUEST,
      "Invalid or missing conversationId parameter.",
      400
    );
  }

  // 2. Exact read scoped strictly to user
  const result = await getConversation(conversationId, session.user.id);

  if (!result) {
    // Non-enumerating 404: never reveals whether ID exists under another user
    return errorResponse(
      ErrorCodes.NOT_FOUND,
      "Conversation not found.",
      404
    );
  }

  return NextResponse.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
    },
  });
}
