import { z } from "zod";
import type { Citation } from "@/lib/chat/types";

const httpsUrl = z
  .string()
  .url()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "An HTTPS source link is required.");

export const chatFileSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  origin: z.enum(["upload", "official-web", "secondary-web"]),
  url: httpsUrl.optional(),
  sourcePageUrl: httpsUrl.optional(),
  fileName: z.string().max(255).optional(),
  byteSize: z.number().int().min(0).max(10_485_760).optional(),
  status: z.enum(["available", "processing", "ready", "failed", "removed"]),
  documentId: z.string().max(200).optional(),
  pageCount: z.number().int().min(1).max(100).optional(),
  extractedRuleCount: z.number().int().min(0).optional(),
  error: z.string().max(500).optional(),
  retryable: z.boolean().optional(),
});
export type ChatFile = z.infer<typeof chatFileSchema>;
export type ChatFileResult = {
  conversationId: string;
  messageId: string;
  file: ChatFile;
};
export type ChatFileInput = {
  projectId: string;
  confirmProjectId: string;
  title: string;
  requestId: string;
  conversationId?: string;
  source:
    | { kind: "upload"; blobUrl: string; fileName: string; byteSize: number }
    | { kind: "web"; messageId: string; fileId: string };
};

/** Version 2 shares the existing JSON column; older messages contain citation arrays. */
export function readMessageMetadata(value: unknown): {
  citations: Citation[];
  files: ChatFile[];
} {
  if (Array.isArray(value))
    return { citations: value as Citation[], files: [] };
  if (!value || typeof value !== "object") return { citations: [], files: [] };
  const stored = value as {
    version?: unknown;
    citations?: unknown;
    files?: unknown;
  };
  if (stored.version !== 2) return { citations: [], files: [] };
  const parsed = z.array(chatFileSchema).max(10).safeParse(stored.files);
  return {
    citations: Array.isArray(stored.citations)
      ? (stored.citations as Citation[])
      : [],
    files: parsed.success ? parsed.data : [],
  };
}
export function messageMetadata(citations: Citation[], files: ChatFile[]) {
  return {
    version: 2,
    citations,
    files: z.array(chatFileSchema).max(10).parse(files),
  };
}
