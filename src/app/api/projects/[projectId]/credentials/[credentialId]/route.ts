import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { errorResponse, handleRouteError, successResponse } from "@/lib/http";
import { getOrCreateCorrelationId } from "@/lib/logger";
import { ErrorCodes } from "@/lib/errors";
import { revokeProjectMcpCredential } from "@/lib/projects/credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    projectId: string;
    credentialId: string;
  };
}

export async function DELETE(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const correlationId = getOrCreateCorrelationId(req);
  const { projectId, credentialId } = params;

  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        "Authentication required to revoke an MCP credential.",
        401,
        undefined,
        correlationId
      );
    }

    const revoked = await revokeProjectMcpCredential(projectId, credentialId, session.user.id);
    return successResponse({ revoked }, 200, correlationId);
  } catch (error) {
    return handleRouteError(error, {
      route: "DELETE /api/projects/[projectId]/credentials/[credentialId]",
      correlationId,
      metadata: { projectId, credentialId },
    });
  }
}
