export const ErrorCodes = {
  INVALID_REQUEST: "INVALID_REQUEST",
  UNSUPPORTED_FILE: "UNSUPPORTED_FILE",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  PAGE_LIMIT_EXCEEDED: "PAGE_LIMIT_EXCEEDED",
  NOT_FOUND: "NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  UPSTREAM_FAILURE: "UPSTREAM_FAILURE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  CONFLICT: "CONFLICT",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes] | string;

export type ApiErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, code: ErrorCode = ErrorCodes.INTERNAL_ERROR, status = 500, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class InvalidRequestError extends AppError {
  constructor(message = "Invalid request", details?: unknown) {
    super(message, ErrorCodes.INVALID_REQUEST, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details?: unknown) {
    super(message, ErrorCodes.NOT_FOUND, 404, details);
  }
}

export class RateLimitedError extends AppError {
  readonly retryAfter?: number;
  constructor(message = "Rate limit exceeded", retryAfter?: number) {
    super(message, ErrorCodes.RATE_LIMITED, 429);
    this.retryAfter = retryAfter;
  }
}

export class UnsupportedFileError extends AppError {
  constructor(message = "Unsupported file type. Only PDF is supported", details?: unknown) {
    super(message, ErrorCodes.UNSUPPORTED_FILE, 400, details);
  }
}

export class FileTooLargeError extends AppError {
  constructor(message = "File exceeds the 10 MB limit", details?: unknown) {
    super(message, ErrorCodes.FILE_TOO_LARGE, 413, details);
  }
}

export class PageLimitExceededError extends AppError {
  constructor(message = "PDF exceeds the 100-page limit", details?: unknown) {
    super(message, ErrorCodes.PAGE_LIMIT_EXCEEDED, 400, details);
  }
}

export class UpstreamFailureError extends AppError {
  constructor(message = "Upstream service failure", details?: unknown) {
    super(message, ErrorCodes.UPSTREAM_FAILURE, 502, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", details?: unknown) {
    super(message, ErrorCodes.CONFLICT, 409, details);
  }
}

