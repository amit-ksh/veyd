import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { errorResponse, handleRouteError, successResponse } from "@/lib/http";
import { getOrCreateCorrelationId } from "@/lib/logger";
import { ErrorCodes } from "@/lib/errors";
import {
  listProjectMcpCredentials,
  createProjectMcpCredential,
} from "@/lib/projects/credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    projectId: string;
  };
}

export async function GET(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const correlationId = getOrCreateCorrelationId(req);
  const { projectId } = params;

  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        "Authentication required to list project MCP credentials.",
        401,
        undefined,
        correlationId
      );
    }

    const credentials = await listProjectMcpCredentials(projectId, session.user.id);
    return successResponse({ credentials }, 200, correlationId);
  } catch (error) {
    return handleRouteError(error, {
      route: "GET /api/projects/[projectId]/credentials",
      correlationId,
      metadata: { projectId },
    });
  }
}

export async function POST(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const correlationId = getOrCreateCorrelationId(req);
  const { projectId } = params;

  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        "Authentication required to create an MCP credential.",
        401,
        undefined,
        correlationId
      );
    }

    const body = await req.json().catch(() => ({}));
    const label = typeof body?.label === "string" ? body.label : "Default MCP Token";

    const result = await createProjectMcpCredential(projectId, session.user.id, label);
    return successResponse(result, 201, correlationId);
  } catch (error) {
    return handleRouteError(error, {
      route: "POST /api/projects/[projectId]/credentials",
      correlationId,
      metadata: { projectId },
    });
  }
}
