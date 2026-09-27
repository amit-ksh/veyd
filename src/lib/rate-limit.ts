import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

if (typeof window !== "undefined") {
  throw new Error("Cannot import rate-limit in client-side code");
}

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in ms
  retryAfter?: number; // seconds
};

/**
 * Extracts trusted client IP from Vercel headers, falling back to 127.0.0.1.
 */
export function getClientIp(req: Request | Headers): string {
  const headers = req instanceof Request ? req.headers : req;
  const xForwardedFor = headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(",")[0].trim();
    if (firstIp) return firstIp;
  }
  const xRealIp = headers.get("x-real-ip");
  if (xRealIp?.trim()) return xRealIp.trim();

  return "127.0.0.1";
}

// In-memory fallback sliding window limiter for local development and testing
class MemorySlidingWindow {
  private windows = new Map<string, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  limitCheck(identifier: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = (this.windows.get(identifier) || []).filter((t) => t > windowStart);

    if (timestamps.length >= this.limit) {
      const oldestInWindow = timestamps[0];
      const reset = oldestInWindow + this.windowMs;
      const retryAfter = Math.max(1, Math.ceil((reset - now) / 1000));
      return {
        success: false,
        limit: this.limit,
        remaining: 0,
        reset,
        retryAfter,
      };
    }

    timestamps.push(now);
    this.windows.set(identifier, timestamps);

    const reset = now + this.windowMs;
    return {
      success: true,
      limit: this.limit,
      remaining: this.limit - timestamps.length,
      reset,
    };
  }

  reset(identifier?: string) {
    if (identifier) {
      this.windows.delete(identifier);
    } else {
      this.windows.clear();
    }
  }
}

const memoryIngestionLimiter = new MemorySlidingWindow(5, 60 * 60 * 1000);
const memoryChatLimiter = new MemorySlidingWindow(30, 60 * 60 * 1000);

let upstashRedis: Redis | null = null;
let upstashIngestion: Ratelimit | null = null;
let upstashChat: Ratelimit | null = null;

function isLiveUpstashConfigured(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(
    url &&
      token &&
      !url.includes("replace-with") &&
      !token.includes("replace-with") &&
      url.startsWith("https://")
  );
}

function getUpstashLimiters() {
  if (!isLiveUpstashConfigured()) return null;

  if (!upstashRedis) {
    upstashRedis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    upstashIngestion = new Ratelimit({
      redis: upstashRedis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      prefix: "ratelimit:ingest",
    });

    upstashChat = new Ratelimit({
      redis: upstashRedis,
      limiter: Ratelimit.slidingWindow(30, "1 h"),
      prefix: "ratelimit:chat",
    });
  }

  return { ingestion: upstashIngestion!, chat: upstashChat! };
}

/**
 * Checks rolling-window rate limits for ingestion or chat.
 * - Ingestion: 5 per rolling hour per IP
 * - Chat: 30 per rolling hour per IP
 */
export async function checkRateLimit(
  type: "ingestion" | "chat",
  identifier: string
): Promise<RateLimitResult> {
  const upstash = getUpstashLimiters();

  if (upstash) {
    const limiter = type === "ingestion" ? upstash.ingestion : upstash.chat;
    const result = await limiter.limit(identifier);
    const retryAfter = result.success
      ? undefined
      : Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      retryAfter,
    };
  }

  // Use local in-memory sliding window when Upstash is not connected
  const memLimiter = type === "ingestion" ? memoryIngestionLimiter : memoryChatLimiter;
  return memLimiter.limitCheck(identifier);
}

/**
 * Creates response headers for rate-limit metadata.
 */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
  };
  if (result.retryAfter !== undefined) {
    headers["Retry-After"] = String(result.retryAfter);
  }
  return headers;
}

export function resetMemoryRateLimits(identifier?: string) {
  memoryIngestionLimiter.reset(identifier);
  memoryChatLimiter.reset(identifier);
}
