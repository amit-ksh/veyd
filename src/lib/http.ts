import { NextResponse } from "next/server";
import { AppError, ErrorCodes, type ApiErrorBody, type ErrorCode } from "./errors";
import { logger } from "./logger";

/**
 * Returns a standardized non-streaming JSON error response.
 */
export function errorResponse(
  code: ErrorCode,
  message: string,
  status = 400,
  details?: unknown,
  headersOrCorrelationId?: HeadersInit | string,
  correlationId?: string
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };

  let resolvedHeaders: HeadersInit | undefined;
  let resolvedCorrelationId: string | undefined = correlationId;

  if (typeof headersOrCorrelationId === "string") {
    resolvedCorrelationId = headersOrCorrelationId;
  } else if (headersOrCorrelationId) {
    resolvedHeaders = headersOrCorrelationId;
  }

  const finalHeaders = new Headers(resolvedHeaders);
  if (resolvedCorrelationId) {
    finalHeaders.set("X-Correlation-Id", resolvedCorrelationId);
  }

  return NextResponse.json(body, { status, headers: finalHeaders });
}

/**
 * Returns a standardized JSON success response.
 */
export function successResponse<T>(
  data: T,
  status = 200,
  headersOrCorrelationId?: HeadersInit | string,
  correlationId?: string
): NextResponse<T> {
  let resolvedHeaders: HeadersInit | undefined;
  let resolvedCorrelationId: string | undefined = correlationId;

  if (typeof headersOrCorrelationId === "string") {
    resolvedCorrelationId = headersOrCorrelationId;
  } else if (headersOrCorrelationId) {
    resolvedHeaders = headersOrCorrelationId;
  }

  const finalHeaders = new Headers(resolvedHeaders);
  if (resolvedCorrelationId) {
    finalHeaders.set("X-Correlation-Id", resolvedCorrelationId);
  }
  return NextResponse.json(data, { status, headers: finalHeaders });
}

export interface RouteErrorOptions {
  route?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Route handler error catcher that formats AppErrors or masks unexpected exceptions.
 */
export function handleRouteError(
  error: unknown,
  optionsOrCorrelationId?: string | RouteErrorOptions,
  legacyRoute?: string
): NextResponse<ApiErrorBody> {
  let correlationId: string | undefined;
  let route: string | undefined;
  let metadata: Record<string, unknown> | undefined;

  if (typeof optionsOrCorrelationId === "string") {
    correlationId = optionsOrCorrelationId;
    route = legacyRoute;
  } else if (optionsOrCorrelationId) {
    correlationId = optionsOrCorrelationId.correlationId;
    route = optionsOrCorrelationId.route;
    metadata = optionsOrCorrelationId.metadata;
  }

  if (error instanceof AppError) {
    const headers: Record<string, string> = {};
    if ("retryAfter" in error && typeof error.retryAfter === "number") {
      headers["Retry-After"] = String(error.retryAfter);
    }

    logger.warn("app_error_handled", {
      correlationId,
      route,
      errorCode: error.code,
      message: error.message,
      statusCode: error.status,
      ...(metadata || {}),
    });

    return errorResponse(error.code, error.message, error.status, error.details, headers, correlationId);
  }

  // Log unhandled error with safe redaction
  logger.error("unhandled_server_error", {
    correlationId,
    route,
    errorCode: ErrorCodes.INTERNAL_ERROR,
    error: error instanceof Error ? error.message : "Unknown error",
    ...(metadata || {}),
  });

  return errorResponse(ErrorCodes.INTERNAL_ERROR, "An internal error occurred", 500, undefined, undefined, correlationId);
}

export const handleApiError = handleRouteError;
