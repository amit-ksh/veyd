import { Redis } from "@upstash/redis";

if (typeof window !== "undefined") {
  throw new Error("Cannot import server handbook lease in client-side code");
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

const memoryLeases = new Map<string, { leaseId: string; expiresAt: number }>();

/**
 * Attempts to acquire an exclusive, time-bounded generation lease for a project handbook.
 * Returns { acquired: true, leaseId } if acquired, or { acquired: false, leaseId: "" } if already held.
 */
export async function acquireHandbookLease(
  projectId: string,
  ttlSeconds: number = 30
): Promise<{ acquired: boolean; leaseId: string }> {
  const key = `lease:handbook:${projectId}`;
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
      console.warn("[HANDBOOK_LEASE] Upstash Redis lease check error, falling back to memory:", err);
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
 * Releases an acquired handbook generation lease if the leaseId matches.
 */
export async function releaseHandbookLease(
  projectId: string,
  leaseId: string
): Promise<boolean> {
  const key = `lease:handbook:${projectId}`;
  const redis = getRedis();

  if (redis) {
    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      const res = await redis.eval(script, [key], [leaseId]);
      return res === 1;
    } catch (err) {
      console.warn("[HANDBOOK_LEASE] Upstash Redis release error, clearing memory fallback:", err);
    }
  }

  const existing = memoryLeases.get(key);
  if (existing && existing.leaseId === leaseId) {
    memoryLeases.delete(key);
    return true;
  }

  return false;
}
