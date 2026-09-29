import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateProjectHandbook,
  HandbookSourceChangedError,
} from "@/lib/handbook/service";
import { RuleSourceMismatchError } from "@/lib/handbook/fingerprint";
import { errorResponse, handleRouteError } from "@/lib/http";
import { ErrorCodes } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(
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

    // 3. Generate or regenerate handbook
    const result = await generateProjectHandbook({
      projectId,
      projectName: project.name,
      correlationId,
    });

    if (result.status === "generating") {
      return new Response(JSON.stringify(result), {
        status: 202,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "private, no-store",
          "x-correlation-id": correlationId,
        },
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
        "x-correlation-id": correlationId,
      },
    });
  } catch (error) {
    if (error instanceof HandbookSourceChangedError) {
      return errorResponse(
        ErrorCodes.HANDBOOK_SOURCE_CHANGED,
        "Source rules or documents were modified during handbook compilation. Please retry generation.",
        409,
        undefined,
        correlationId
      );
    }

    if (error instanceof RuleSourceMismatchError) {
      return errorResponse(
        ErrorCodes.INVALID_REQUEST,
        error.message,
        400,
        undefined,
        correlationId
      );
    }

    return handleRouteError(error, {
      route: "POST /api/projects/[projectId]/handbook/generate",
      correlationId,
      metadata: { projectId },
    });
  }
}
