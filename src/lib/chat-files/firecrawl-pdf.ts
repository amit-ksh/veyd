import { z } from "zod";
import { getServerConfig } from "@/lib/config";
import {
  AppError,
  FileTooLargeError,
  UnsupportedFileError,
  UpstreamFailureError,
} from "@/lib/errors";
import {
  MAX_FILE_SIZE_BYTES,
  validatePdfBuffer,
} from "@/lib/ingestion/validator";
import {
  MAX_PARSED_PDF_CHARS,
  validateParsedPdfPages,
} from "@/lib/ingestion/parsed-pdf";
import { validatePublicPdfSource } from "./public-pdf";

if (typeof window !== "undefined")
  throw new Error("Server-only Firecrawl PDF ingestion");

const API_ORIGIN = "https://api.firecrawl.dev";
const MAX_BASE64_CHARS = Math.ceil(MAX_FILE_SIZE_BYTES / 3) * 4;
const MAX_DOWNLOAD_RESPONSE_BYTES = MAX_BASE64_CHARS + 65_536;
// JSON can escape each character as six bytes. Keep the transport bounded too.
const MAX_PARSE_RESPONSE_BYTES = MAX_PARSED_PDF_CHARS * 6 + 65_536;
const metadataSchema = z.object({
  contentType: z.string().optional(),
  statusCode: z.number().optional(),
  sourceURL: z.string().optional(),
  url: z.string().optional(),
  numPages: z.number().int().optional(),
  totalPages: z.number().int().optional(),
  error: z.string().nullish(),
});
const downloadSchema = z.object({
  success: z.literal(true),
  data: z.object({
    rawBase64: z.string().max(MAX_BASE64_CHARS).optional(),
    // Hosted v2 currently returns unparsed PDF base64 in rawHtml.
    rawHtml: z.string().max(MAX_BASE64_CHARS).optional(),
    metadata: metadataSchema,
  }),
});
const parseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    pages: z.unknown(),
    metadata: metadataSchema,
  }),
});

async function readBoundedJson(res: Response, limit: number): Promise<unknown> {
  if (Number(res.headers.get("content-length")) > limit) {
    await res.body?.cancel();
    throw new FileTooLargeError(
      "The Firecrawl PDF response exceeds the supported size.",
    );
  }
  if (!res.body)
    throw new UpstreamFailureError("Firecrawl returned an empty response.");
  const reader = res.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new FileTooLargeError(
          "The Firecrawl PDF response exceeds the supported size.",
        );
      }
      chunks.push(Buffer.from(chunk.value));
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks, size).toString("utf8"));
  } catch {
    throw new UpstreamFailureError("Firecrawl returned an invalid PDF response.");
  }
}

async function firecrawlRequest(
  path: "/v2/scrape" | "/v2/parse",
  body: string | FormData,
  signal: AbortSignal,
  responseLimit: number,
): Promise<unknown> {
  signal.throwIfAborted();
  const apiKey = getServerConfig().FIRECRAWL_API_KEY;
  const res = await fetch(API_ORIGIN + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(typeof body === "string" ? { "Content-Type": "application/json" } : {}),
    },
    body,
    signal,
    redirect: "error",
    cache: "no-store",
  });
  if (!res.ok) {
    await res.body?.cancel();
    const message =
      res.status === 401 || res.status === 403
        ? "Firecrawl could not authorize PDF ingestion. Check its server API key and permissions."
        : res.status === 402
          ? "Firecrawl PDF ingestion has insufficient credits. Top up the configured account and try again."
          : res.status === 429
            ? "Firecrawl is busy or rate-limited. Try importing the PDF again later."
            : "Firecrawl could not retrieve or parse this PDF. Try again or attach the original file.";
    throw new UpstreamFailureError(message);
  }
  return readBoundedJson(res, responseLimit);
}

/**
 * Only call after project ownership and explicit confirmation have been checked.
 * Firecrawl fetches source redirects; the app never fetches the candidate directly.
 */
export async function loadFirecrawlPdf(raw: string, clientSignal?: AbortSignal) {
  const timeout = AbortSignal.timeout(120_000);
  const signal = clientSignal ? AbortSignal.any([timeout, clientSignal]) : timeout;
  try {
    const source = await validatePublicPdfSource(raw, signal);
    const download = downloadSchema.safeParse(
      await firecrawlRequest(
        "/v2/scrape",
        JSON.stringify({
          url: source.href,
          formats: ["rawHtml"],
          parsers: [],
          skipTlsVerification: false,
          timeout: 45_000,
          maxAge: 0,
          storeInCache: false,
        }),
        signal,
        MAX_DOWNLOAD_RESPONSE_BYTES,
      ),
    );
    if (!download.success)
      throw new UpstreamFailureError(
        "Firecrawl did not return the original PDF. Try again or attach the file.",
      );
    const { metadata } = download.data.data;
    if (
      metadata.error ||
      (metadata.statusCode !== undefined && metadata.statusCode !== 200)
    )
      throw new UpstreamFailureError(
        "The PDF source could not be retrieved through Firecrawl.",
      );
    if (
      !metadata.contentType ||
      !["application/pdf", "application/octet-stream"].includes(
        metadata.contentType.split(";")[0].trim().toLowerCase(),
      )
    )
      throw new UnsupportedFileError(
        "Firecrawl returned a web page or unsupported file, not a PDF.",
      );
    const reportedUrls = new Set(
      [metadata.sourceURL, metadata.url].filter(
        (value): value is string => !!value,
      ),
    );
    for (const url of reportedUrls)
      await validatePublicPdfSource(url, signal);
    const base64 = download.data.data.rawBase64 || download.data.data.rawHtml;
    if (!base64 || base64.length % 4 || /[^A-Za-z0-9+/=]/.test(base64))
      throw new UnsupportedFileError(
        "Firecrawl did not return valid PDF bytes. Attach the original file instead.",
      );
    const buffer = Buffer.from(base64, "base64");
    if (buffer.toString("base64") !== base64)
      throw new UnsupportedFileError(
        "Firecrawl did not return valid PDF bytes. Attach the original file instead.",
      );
    const { pageCount } = await validatePdfBuffer(buffer);
    signal.throwIfAborted();

    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(buffer)], { type: "application/pdf" }),
      "source.pdf",
    );
    form.append(
      "options",
      JSON.stringify({
        formats: ["markdown"],
        parsers: [{ type: "pdf", mode: "auto", maxPages: pageCount, pages: true }],
        timeout: 60_000,
      }),
    );
    const parsed = parseSchema.safeParse(
      await firecrawlRequest("/v2/parse", form, signal, MAX_PARSE_RESPONSE_BYTES),
    );
    if (!parsed.success)
      throw new UpstreamFailureError(
        "Firecrawl did not return page-attributed PDF content. Nothing was stored.",
      );
    const parsedMetadata = parsed.data.data.metadata;
    if (
      parsedMetadata.error ||
      (parsedMetadata.statusCode !== undefined &&
        parsedMetadata.statusCode !== 200) ||
      parsedMetadata.numPages !== pageCount ||
      (parsedMetadata.totalPages !== undefined &&
        parsedMetadata.totalPages !== pageCount)
    )
      throw new UpstreamFailureError(
        "Firecrawl returned an incomplete PDF parse. Nothing was stored.",
      );
    const pages = validateParsedPdfPages(parsed.data.data.pages, pageCount);
    signal.throwIfAborted();
    return { buffer, pages };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new UpstreamFailureError(
      signal.aborted
        ? "Firecrawl PDF ingestion timed out or was canceled. Nothing was stored. Try again or attach the file."
        : "Firecrawl PDF ingestion failed. Nothing was stored. Try again or attach the file.",
    );
  }
}
