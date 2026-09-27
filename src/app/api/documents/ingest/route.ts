import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ingestDocument } from "@/lib/ingestion/service";
import { handleApiError, errorResponse } from "@/lib/http";
import { ErrorCodes } from "@/lib/errors";

const ingestRequestSchema = z.object({
  blobUrl: z.string().url("A valid blobUrl is required"),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title must be between 1 and 200 characters"),
  industry: z
    .string()
    .trim()
    .min(1, "Industry is required")
    .max(100, "Industry must be between 1 and 100 characters"),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(
      ErrorCodes.INVALID_REQUEST,
      "Invalid JSON request body",
      400
    );
  }

  const parsed = ingestRequestSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(ErrorCodes.INVALID_REQUEST, message, 400, {
      issues: parsed.error.issues,
    });
  }

  try {
    const result = await ingestDocument(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
