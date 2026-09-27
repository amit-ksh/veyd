import { NextResponse } from "next/server";
import { getComplianceDocuments } from "@/lib/sanity/queries";
import { handleApiError, successResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const documents = await getComplianceDocuments();
    return successResponse({ documents });
  } catch (error) {
    return handleApiError(error);
  }
}
