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
    url.startsWith("https://"),
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
  ttlSeconds: number = 120,
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
    } catch {
      throw new Error("Handbook generation lock is unavailable. Please retry.");
    }
  }

  if (process.env.NODE_ENV === "production")
    throw new Error("Upstash is required for handbook generation locking.");

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
  leaseId: string,
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
    } catch {
      return false;
    }
  }

  const existing = memoryLeases.get(key);
  if (existing && existing.leaseId === leaseId) {
    memoryLeases.delete(key);
    return true;
  }

  return false;
}

export async function renewHandbookLease(
  projectId: string,
  leaseId: string,
): Promise<boolean> {
  const key = `lease:handbook:${projectId}`;
  const redis = getRedis();
  if (redis) {
    return (
      (await redis.eval(
        `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("expire", KEYS[1], 120) else return 0 end`,
        [key],
        [leaseId],
      )) === 1
    );
  }
  const lease = memoryLeases.get(key);
  if (!lease || lease.leaseId !== leaseId || lease.expiresAt <= Date.now())
    return false;
  lease.expiresAt = Date.now() + 120_000;
  return true;
}
