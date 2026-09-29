import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listPublishedDocuments } from "@/lib/sanity/published-queries";
import { errorResponse, handleApiError, successResponse } from "@/lib/http";
import { getOrCreateCorrelationId } from "@/lib/logger";
import { ErrorCodes } from "@/lib/errors";
import { getAuthorizedProject, getMostRecentProject } from "@/lib/projects/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const correlationId = getOrCreateCorrelationId(req);
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        "Authentication required to list documents.",
        401,
        undefined,
        correlationId
      );
    }

    const queryProjectId = req.nextUrl.searchParams.get("projectId")?.trim();
    let targetProjectId = queryProjectId;

    if (!targetProjectId) {
      const recent = await getMostRecentProject(session.user.id);
      if (!recent) {
        return successResponse({ documents: [] }, 200, undefined, correlationId);
      }
      targetProjectId = recent.id;
    } else {
      await getAuthorizedProject(targetProjectId, session.user.id);
    }

    const documents = await listPublishedDocuments({ projectId: targetProjectId, limit: 50 });
    return successResponse({ documents }, 200, undefined, correlationId);
  } catch (error) {
    return handleApiError(error, correlationId, "/api/documents");
  }
}
