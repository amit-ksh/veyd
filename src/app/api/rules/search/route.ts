import { NextRequest, NextResponse } from "next/server";
import { searchRules } from "@/lib/sanity/queries";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ rules: [] });
  const rules = await searchRules(q);
  return NextResponse.json({ rules });
}
