import { z } from "zod";
import { UpstreamFailureError } from "@/lib/errors";
import { MAX_PAGE_COUNT } from "./validator";

export const MAX_PARSED_PDF_CHARS = 2_000_000;

const pageSchema = z.object({
  pageNumber: z.number().int().min(1).max(MAX_PAGE_COUNT),
  markdown: z.string().max(MAX_PARSED_PDF_CHARS),
});
const pagesSchema = z.array(pageSchema).min(1).max(MAX_PAGE_COUNT);

export type ParsedPdfPage = z.infer<typeof pageSchema>;

/** Reject partial/reordered/duplicate parses instead of inventing page attribution. */
export function validateParsedPdfPages(
  input: unknown,
  pageCount: number,
): ParsedPdfPage[] {
  const result = pagesSchema.safeParse(input);
  if (
    !result.success ||
    result.data.length !== pageCount ||
    result.data.some((page, index) => page.pageNumber !== index + 1) ||
    result.data.reduce((size, page) => size + page.markdown.length, 0) >
      MAX_PARSED_PDF_CHARS
  )
    throw new UpstreamFailureError(
      "Firecrawl returned incomplete or invalid PDF pages. Nothing was stored; try again or attach the original PDF.",
    );
  return result.data;
}
