import { NextRequest, NextResponse } from "next/server";
import { searchRules } from "@/lib/sanity/queries";
import { getOrCreateCorrelationId, logger } from "@/lib/logger";
import { handleRouteError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = getOrCreateCorrelationId(req);
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim();
    if (!q) {
      return NextResponse.json({ rules: [] }, {
        headers: { "X-Correlation-Id": correlationId },
      });
    }

    const rules = await logger.timed(
      "sanity_search_rules",
      () => searchRules(q),
      { correlationId }
    );

    logger.info("rules_search_completed", {
      correlationId,
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
