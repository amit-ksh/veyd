import { NextResponse } from "next/server";
import { AppError, ErrorCodes, type ApiErrorBody, type ErrorCode } from "./errors";

/**
 * Returns a standardized non-streaming JSON error response.
 */
export function errorResponse(
  code: ErrorCode,
  message: string,
  status = 400,
  details?: unknown,
  headers?: HeadersInit
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
  return NextResponse.json(body, { status, headers });
}

/**
 * Returns a standardized JSON success response.
 */
export function successResponse<T>(data: T, status = 200, headers?: HeadersInit): NextResponse<T> {
  return NextResponse.json(data, { status, headers });
}

/**
 * Route handler error catcher that formats AppErrors or masks unexpected exceptions.
 */
export function handleRouteError(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof AppError) {
    const headers: Record<string, string> = {};
    if ("retryAfter" in error && typeof error.retryAfter === "number") {
      headers["Retry-After"] = String(error.retryAfter);
    }
    return errorResponse(error.code, error.message, error.status, error.details, headers);
  }

  // Never return raw upstream response bodies or secret-bearing stack traces
  console.error("Unhandled API error:", error);
  return errorResponse(ErrorCodes.INTERNAL_ERROR, "An internal error occurred", 500);
}
