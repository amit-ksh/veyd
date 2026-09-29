import { Redis } from "@upstash/redis";

if (typeof window !== "undefined") {
  throw new Error("Cannot import server deletion lease in client-side code");
}

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

let redisClient: Redis | null = null;
function getRedis(): Redis | null {
  if (!isLiveUpstashConfigured()) return null;
  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redisClient;
}

// In-memory lease fallback for local development without Upstash Redis
const memoryLeases = new Map<string, { leaseId: string; expiresAt: number }>();

/**
 * Attempts to acquire an exclusive, time-bounded deletion lease for a project document.
 * Returns { acquired: true, leaseId } if acquired, or { acquired: false, leaseId: "" } if already held.
 */
export async function acquireDeletionLease(
  projectId: string,
  documentId: string,
  ttlSeconds: number = 60
): Promise<{ acquired: boolean; leaseId: string }> {
  const key = `lease:deletion:${projectId}:${documentId}`;
  const leaseId = crypto.randomUUID();
  const redis = getRedis();

  if (redis) {
    try {
      const res = await redis.set(key, leaseId, { nx: true, ex: ttlSeconds });
      if (res === "OK") {
        return { acquired: true, leaseId };
      }
      return { acquired: false, leaseId: "" };
    } catch (err) {
      console.warn("[LEASE] Upstash Redis lease check error, falling back to memory:", err);
    }
  }

  // Fallback to in-memory lease
  const now = Date.now();
  const existing = memoryLeases.get(key);
  if (existing && existing.expiresAt > now) {
    return { acquired: false, leaseId: "" };
  }

  memoryLeases.set(key, {
    leaseId,
    expiresAt: now + ttlSeconds * 1000,
  });

  return { acquired: true, leaseId };
}

/**
 * Releases the deletion lease if the held leaseId matches.
 */
export async function releaseDeletionLease(
  projectId: string,
  documentId: string,
  leaseId: string
): Promise<void> {
  const key = `lease:deletion:${projectId}:${documentId}`;
  const redis = getRedis();

  if (redis) {
    try {
      const current = await redis.get<string>(key);
      if (current === leaseId) {
        await redis.del(key);
      }
      return;
    } catch (err) {
      console.warn("[LEASE] Upstash Redis release error:", err);
    }
  }

  const existing = memoryLeases.get(key);
  if (existing && existing.leaseId === leaseId) {
    memoryLeases.delete(key);
  }
}
