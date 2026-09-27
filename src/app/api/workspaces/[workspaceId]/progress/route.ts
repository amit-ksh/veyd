import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  chapterSlug: z.string(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]),
});

export async function POST(req: NextRequest, { params }: { params: { workspaceId: string } }) {
  const session = await auth.api.getSession({ headers: headers() });
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const progress = await prisma.handbookProgress.upsert({
    where: {
      userId_workspaceId_chapterSlug: {
        userId: session.user.id,
        workspaceId: params.workspaceId,
        chapterSlug: parsed.data.chapterSlug,
      },
    },
    update: {
      status: parsed.data.status,
      acknowledgedAt: parsed.data.status === "COMPLETED" ? new Date() : undefined,
    },
    create: {
      userId: session.user.id,
      workspaceId: params.workspaceId,
      chapterSlug: parsed.data.chapterSlug,
      status: parsed.data.status,
      acknowledgedAt: parsed.data.status === "COMPLETED" ? new Date() : undefined,
    },
  });

  return NextResponse.json({ progress });
}

export async function GET(req: NextRequest, { params }: { params: { workspaceId: string } }) {
  const session = await auth.api.getSession({ headers: headers() });
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const progress = await prisma.handbookProgress.findMany({
    where: { userId: session.user.id, workspaceId: params.workspaceId },
  });
  return NextResponse.json({ progress });
}
