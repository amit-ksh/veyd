import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { verifyComplianceTool } from "@/lib/mcp/tools";

const bodySchema = z.object({
  ruleSlug: z.string(),
  evidence: z.array(z.object({ item: z.string(), satisfied: z.boolean(), note: z.string().optional() })),
});

// Thin HTTP wrapper around the same verifyComplianceTool the MCP server uses,
// so a human clicking through the Verify UI and an AI agent calling /api/mcp
// produce identical, auditable VerificationLog rows.
export async function POST(req: NextRequest, { params }: { params: { workspaceId: string } }) {
  const session = await auth.api.getSession({ headers: headers() });
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await verifyComplianceTool.handler({
      workspaceId: params.workspaceId,
      userId: session.user.id,
      ...parsed.data,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
