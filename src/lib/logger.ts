import crypto from "crypto";

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface StructuredLogPayload {
  timestamp: string;
  level: LogLevel;
  event: string;
  correlationId?: string;
  route?: string;
  toolName?: string;
  durationMs?: number;
  statusCode?: number;
  errorCode?: string;
  documentId?: string;
  conversationId?: string;
  resultCount?: number;
  blobUrl?: string;
  clientIp?: string;
  message?: string;
  [key: string]: unknown;
}

/**
 * Sensitive field names that MUST NEVER appear in structured logs.
 */
const FORBIDDEN_LOG_KEYS = new Set([
  "authorization",
  "auth",
  "secret",
  "token",
  "cookie",
  "password",
  "apikey",
  "geminikey",
  "firecrawlkey",
  "sanitytoken",
  "mcpsecret",
  "prompt",
  "fulltext",
  "rawcontent",
  "scrapedmarkdown",
  "mutationbody",
]);

/**
 * Sanitizes context object to strictly prevent secret leakage or raw body dumping.
 */
function sanitizeContext(ctx: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(ctx)) {
    const lowerKey = key.toLowerCase();
    if (FORBIDDEN_LOG_KEYS.has(lowerKey)) {
      continue;
    }

    if (typeof value === "string") {
      // Redact potential authorization header values or URLs with tokens
      if (value.startsWith("Bearer ") || value.length > 500) {
        safe[key] = value.startsWith("Bearer ") ? "[REDACTED_BEARER]" : `${value.slice(0, 80)}… [TRUNCATED]`;
      } else {
        safe[key] = value;
      }
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      safe[key] = sanitizeContext(value as Record<string, unknown>);
    } else {
      safe[key] = value;
    }
  }

  return safe;
}

export function getOrCreateCorrelationId(req?: { headers: Headers } | Request): string {
  if (!req) return crypto.randomUUID();
  const headers = req.headers;
  const existing =
    headers.get("x-correlation-id") ||
    headers.get("x-request-id") ||
    headers.get("x-vercel-id");
  if (existing) return existing.trim();
  return crypto.randomUUID();
}

function writeLog(level: LogLevel, event: string, context: Record<string, unknown> = {}) {
  const safeContext = sanitizeContext(context);
  const payload: StructuredLogPayload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...safeContext,
  };

  const jsonStr = JSON.stringify(payload);
  if (level === "error") {
    console.error(jsonStr);
  } else if (level === "warn") {
    console.warn(jsonStr);
  } else {
    console.log(jsonStr);
  }
}

export const logger = {
  info(event: string, context?: Record<string, unknown>) {
    writeLog("info", event, context);
  },
  warn(event: string, context?: Record<string, unknown>) {
    writeLog("warn", event, context);
  },
  error(event: string, context?: Record<string, unknown>) {
    writeLog("error", event, context);
  },
  debug(event: string, context?: Record<string, unknown>) {
    writeLog("debug", event, context);
  },

  /**
   * Times an async operation and writes a structured timing log.
   */
  async timed<T>(
    operationName: string,
    fn: () => Promise<T>,
    context: Record<string, unknown> = {}
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const durationMs = Date.now() - start;
      logger.info(`${operationName}_completed`, {
        ...context,
        durationMs,
      });
      return result;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      logger.error(`${operationName}_failed`, {
        ...context,
        durationMs,
        errorCode: err.code || "OPERATION_FAILED",
        error: err.message,
      });
      throw err;
    }
  },
};
