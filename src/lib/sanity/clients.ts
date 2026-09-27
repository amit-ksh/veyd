import { createClient } from "@sanity/client";

if (typeof window !== "undefined") {
  throw new Error("Cannot import server Sanity clients in client-side code");
}

export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "";
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
export const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2026-03-01";

/**
 * Read-only client for published Sanity content.
 * Perspective: "published" (never returns drafts).
 * Used for chat retrieval, UI reads, and public MCP endpoint.
 */
export const publishedClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: process.env.NODE_ENV === "production",
  token: process.env.SANITY_API_READ_TOKEN,
  perspective: "published",
});

/**
 * Write-capable client using write token and bypassing CDN.
 * Used for asset storage, draft creation, and publication actions.
 */
export const writeClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN,
});

// Aliases for backward compatibility during migration
export const sanityClient = publishedClient;
export const sanityWriteClient = writeClient;
