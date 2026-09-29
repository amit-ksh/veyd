import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPublishedDocumentById } from "@/lib/sanity/published-queries";
import { handleRouteError, successResponse, errorResponse } from "@/lib/http";
import { getOrCreateCorrelationId } from "@/lib/logger";
import { ErrorCodes } from "@/lib/errors";
import { getAuthorizedProject, listUserProjects } from "@/lib/projects/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    documentId: string;
  };
}

export async function GET(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const correlationId = getOrCreateCorrelationId(req);
  const { documentId } = params;

  if (!documentId) {
    return errorResponse(ErrorCodes.INVALID_REQUEST, "documentId is required", 400, undefined, correlationId);
  }

  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        "Authentication required to view document.",
        401,
        undefined,
        correlationId
      );
    }

    const queryProjectId = req.nextUrl.searchParams.get("projectId")?.trim();
    let targetProjectIds: string[] = [];

    if (queryProjectId) {
      await getAuthorizedProject(queryProjectId, session.user.id);
      targetProjectIds = [queryProjectId];
    } else {
      const userProjects = await listUserProjects(session.user.id);
      targetProjectIds = userProjects.map((p) => p.id);
    }

    let document = null;
    for (const projId of targetProjectIds) {
      document = await getPublishedDocumentById(documentId, projId);
      if (document) break;
    }

    if (!document) {
      // Non-enumerating 404: never reveals whether ID exists in another project
      return errorResponse(
        ErrorCodes.NOT_FOUND,
        `Compliance document not found for ID: ${documentId}`,
        404,
        undefined,
        correlationId
      );
    }

    return successResponse({ document }, 200, correlationId);
  } catch (error) {
    return handleRouteError(error, {
      route: "GET /api/documents/[documentId]",
      correlationId,
      metadata: { documentId },
    });
  }
}

