import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { errorResponse, handleRouteError, successResponse } from "@/lib/http";
import { getOrCreateCorrelationId } from "@/lib/logger";
import { ErrorCodes } from "@/lib/errors";
import { listUserProjects, createProject } from "@/lib/projects/service";

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
        "Authentication required to list projects.",
        401,
        undefined,
        correlationId
      );
    }

    const projects = await listUserProjects(session.user.id);
    return successResponse({ projects }, 200, correlationId);
  } catch (error) {
    return handleRouteError(error, {
      route: "GET /api/projects",
      correlationId,
    });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = getOrCreateCorrelationId(req);

  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        "Authentication required to create a project.",
        401,
        undefined,
        correlationId
      );
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name : "";

    const project = await createProject(session.user.id, name);
    return successResponse({ project }, 201, correlationId);
  } catch (error) {
    return handleRouteError(error, {
      route: "POST /api/projects",
      correlationId,
    });
  }
}
