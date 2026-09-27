import { z } from "zod";

if (typeof window !== "undefined") {
  throw new Error("Cannot import server configuration in client-side code");
}

const serverEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SANITY_PROJECT_ID: z.string().min(1, "NEXT_PUBLIC_SANITY_PROJECT_ID is required"),
  NEXT_PUBLIC_SANITY_DATASET: z.string().min(1).default("production"),
  NEXT_PUBLIC_SANITY_API_VERSION: z.string().min(1).default("2026-03-01"),
  SANITY_API_READ_TOKEN: z.string().min(1, "SANITY_API_READ_TOKEN is required"),
  SANITY_API_WRITE_TOKEN: z.string().min(1, "SANITY_API_WRITE_TOKEN is required"),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1, "GOOGLE_GENERATIVE_AI_API_KEY is required"),
  GEMINI_MODEL: z.string().min(1).default("gemini-3.8-flash"),
  FIRECRAWL_API_KEY: z.string().min(1, "FIRECRAWL_API_KEY is required"),
  BLOB_READ_WRITE_TOKEN: z.string().min(1, "BLOB_READ_WRITE_TOKEN is required"),
  UPSTASH_REDIS_REST_URL: z.string().url("UPSTASH_REDIS_REST_URL must be a valid URL"),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, "UPSTASH_REDIS_REST_TOKEN is required"),
  MCP_TOOL_SECRET: z.string().min(1, "MCP_TOOL_SECRET is required"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

/**
 * Validates server environment variables.
 * Fails with variable names only, never values.
 */
export function validateServerConfig(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  const result = serverEnvSchema.safeParse(env);
  if (!result.success) {
    const missingKeys = Array.from(new Set(result.error.issues.map((i) => i.path.join("."))));
    throw new Error(
      `Missing or invalid environment configuration for: ${missingKeys.join(", ")}`
    );
  }
  return result.data;
}

/**
 * Returns validated server configuration singleton.
 */
export function getServerConfig(): ServerEnv {
  if (!cachedEnv) {
    cachedEnv = validateServerConfig();
  }
  return cachedEnv;
}

/**
 * Checks server configuration shape without throwing.
 * Returns valid status and missing keys.
 */
export function checkServerConfigShape(env: NodeJS.ProcessEnv = process.env): {
  valid: boolean;
  missing: string[];
} {
  const result = serverEnvSchema.safeParse(env);
  if (!result.success) {
    const missing = Array.from(new Set(result.error.issues.map((i) => i.path.join("."))));
    return { valid: false, missing };
  }
  return { valid: true, missing: [] };
}

export function resetCachedConfig(): void {
  cachedEnv = null;
}
