import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchPublishedRules } from "@/lib/sanity/published-queries";
import { getOrCreateCorrelationId, logger } from "@/lib/logger";
import { handleRouteError, errorResponse } from "@/lib/http";
import { ErrorCodes } from "@/lib/errors";
import { getAuthorizedProject, getMostRecentProject } from "@/lib/projects/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = getOrCreateCorrelationId(req);
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        "Authentication required to search rules.",
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
        return NextResponse.json({ rules: [] }, {
          headers: { "X-Correlation-Id": correlationId },
        });
      }
      targetProjectId = recent.id;
    } else {
      await getAuthorizedProject(targetProjectId, session.user.id);
    }

    const q = req.nextUrl.searchParams.get("q")?.trim();
    if (!q) {
      return NextResponse.json({ rules: [] }, {
        headers: { "X-Correlation-Id": correlationId },
      });
    }

    const rules = await logger.timed(
      "sanity_search_rules",
      () => searchPublishedRules({ query: q, projectId: targetProjectId }),
      { correlationId, projectId: targetProjectId }
    );

    logger.info("rules_search_completed", {
      correlationId,
      projectId: targetProjectId,
      queryLength: q.length,
      resultCount: rules.length,
    });

    return NextResponse.json({ rules }, {
      headers: { "X-Correlation-Id": correlationId },
    });
  } catch (error) {
    return handleRouteError(error, {
      route: "GET /api/rules/search",
      correlationId,
    });
  }
}

