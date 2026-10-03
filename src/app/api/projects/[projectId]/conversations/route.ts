import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthorizedProject } from "@/lib/projects/service";
import { errorResponse, handleRouteError, successResponse } from "@/lib/http";
import { ErrorCodes } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id)
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        "Sign in to see previous chats.",
        401,
      );
    await getAuthorizedProject(params.projectId, session.user.id);
    const conversations = await prisma.conversation.findMany({
      where: { projectId: params.projectId, userId: session.user.id },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        messages: {
          where: { role: "user" },
          select: { content: true },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 1,
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 50,
    });
    return successResponse(
      {
        conversations: conversations.map(({ messages, ...conversation }) => ({
          ...conversation,
          title: messages[0]?.content.slice(0, 100) || conversation.title,
        })),
      },
      200,
      { "Cache-Control": "private, no-store" },
    );
  } catch (error) {
    return handleRouteError(error, {
      route: "GET /api/projects/[projectId]/conversations",
    });
  }
}
