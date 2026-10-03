import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getAuthorizedProject } from "@/lib/projects/service";
import { getHandbookState } from "@/lib/handbook/service";
import { generateHandbookHtml } from "@/lib/handbook/html";
import { errorResponse, handleRouteError } from "@/lib/http";
import { ErrorCodes } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } },
) {
  const correlationId = crypto.randomUUID();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id)
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        "Authentication required.",
        401,
      );
    const project = await getAuthorizedProject(
      params.projectId,
      session.user.id,
    );
    if (!project)
      return errorResponse(ErrorCodes.NOT_FOUND, "Project not found.", 404);
    const state = await getHandbookState({
      projectId: project.id,
      projectName: project.name,
      correlationId,
    });
    if (state.status !== "ready")
      return errorResponse(
        ErrorCodes.HANDBOOK_REFRESH_REQUIRED,
        "Open the handbook to refresh it before downloading.",
        409,
      );
    const html = await generateHandbookHtml(state.handbook);
    const name = project.name.replace(/[^a-zA-Z0-9_-]/g, "-") || "project";
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}-handbook.html"`,
        "Cache-Control": "private, no-store",
        "X-Correlation-Id": correlationId,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleRouteError(error, {
      route: "GET /api/projects/[projectId]/handbook.html",
      correlationId,
    });
  }
}
