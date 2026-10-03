import { Redis } from "@upstash/redis";
import { ConflictError, UpstreamFailureError } from "@/lib/errors";

if (typeof window !== "undefined") throw new Error("Server-only import lease");
const memory = new Map<string, { id: string; until: number }>();
const TTL_SECONDS = 360;
function redis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (
    url?.startsWith("https://") &&
    token &&
    !url.includes("replace-with") &&
    !token.includes("replace-with")
  )
    return new Redis({ url, token });
  if (process.env.NODE_ENV === "production")
    throw new UpstreamFailureError("Document-import locking is unavailable.");
  return null;
}
export async function acquireImportLease(
  projectId: string,
): Promise<() => Promise<void>> {
  const key = "lease:chat-import:" + projectId;
  const id = crypto.randomUUID();
  const client = redis();
  if (client) {
    let acquired;
    try {
      acquired = await client.set(key, id, { nx: true, ex: TTL_SECONDS });
    } catch {
      throw new UpstreamFailureError(
        "Document-import locking is unavailable. Please retry.",
      );
    }
    if (acquired !== "OK")
      throw new ConflictError(
        "Another document is being added to this project. Please wait.",
      );
    return async () => {
      await client
        .eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          [key],
          [id],
        )
        .catch(() => {});
    };
  }
  if ((memory.get(key)?.until || 0) > Date.now())
    throw new ConflictError(
      "Another document is being added to this project. Please wait.",
    );
  memory.set(key, { id, until: Date.now() + TTL_SECONDS * 1000 });
  return async () => {
    if (memory.get(key)?.id === id) memory.delete(key);
  };
}
