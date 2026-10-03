import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getHandbookState } from "@/lib/handbook/service";
import { generateHandbookPdf } from "@/lib/handbook/pdf";
import { errorResponse, handleRouteError } from "@/lib/http";
import { ErrorCodes } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } },
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
        correlationId,
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
        correlationId,
      );
    }

    // 3. Read current handbook state with freshness & tombstone checks
    const state = await getHandbookState({
      projectId,
      projectName: project.name,
      correlationId,
    });

    if (state.status !== "ready" || !state.handbook) {
      return errorResponse(
        ErrorCodes.HANDBOOK_REFRESH_REQUIRED,
        "Handbook snapshot is missing, stale, or out of date. Please generate the handbook before downloading.",
        409,
        { status: state.status },
        correlationId,
      );
    }

    // 4. Render PDF from validated snapshot
    const pdfBytes = await generateHandbookPdf(state.handbook);

    // Sanitize filename
    const safeName =
      project.name
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "project";
    const filename = `${safeName}-handbook.pdf`;

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBytes.byteLength),
        "Cache-Control": "private, no-store",
        "x-correlation-id": correlationId,
      },
    });
  } catch (error) {
    return handleRouteError(error, {
      route: "GET /api/projects/[projectId]/handbook.pdf",
      correlationId,
      metadata: { projectId },
    });
  }
}
