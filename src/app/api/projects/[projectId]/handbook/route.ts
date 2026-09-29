import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getHandbookState } from "@/lib/handbook/service";
import { errorResponse, handleRouteError } from "@/lib/http";
import { ErrorCodes } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const correlationId = crypto.randomUUID();
  const { projectId } = params;

  try {
    // 1. Session authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        "Authentication required.",
        401,
        undefined,
        correlationId
      );
    }

    // 2. Verify project ownership (non-enumerating 404)
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId: session.user.id,
      },
      select: { id: true, name: true },
    });

    if (!project) {
      return errorResponse(
        ErrorCodes.NOT_FOUND,
        "Project not found.",
        404,
        undefined,
        correlationId
      );
    }

    // 3. Read current handbook state
    const result = await getHandbookState({
      projectId,
      projectName: project.name,
      correlationId,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
        "x-correlation-id": correlationId,
      },
    });
  } catch (error) {
    return handleRouteError(error, {
      route: "GET /api/projects/[projectId]/handbook",
      correlationId,
      metadata: { projectId },
    });
  }
}
