import { getServerConfig } from "../config";
import type {
  SearchExternalRegulationsInput,
  SearchExternalRegulationsOutput,
  ExternalWebResultItem,
} from "./types";

if (typeof window !== "undefined") {
  throw new Error("Cannot import server firecrawl client in client-side code");
}

const FIRECRAWL_API_ENDPOINT = "https://api.firecrawl.dev/v1/search";
const MAX_MARKDOWN_CHARS_PER_RESULT = 2000;
const TIMEOUT_MS = 10000;

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/gi,
  /you\s+are\s+now\s+(in\s+)?(developer\s+mode|dan|jailbreak)/gi,
  /system\s*:\s*/gi,
  /<\/?system>/gi,
  /<\/?prompt>/gi,
  /\[inst\]/gi,
  /\[\/inst\]/gi,
  /<<<?/g,
  />>>?/g,
];

/**
 * Neutralizes potential prompt injection patterns and truncates scraped markdown.
 */
export function sanitizeScrapedContent(raw: string, maxLength: number = MAX_MARKDOWN_CHARS_PER_RESULT): string {
  if (!raw) return "";

  let cleaned = raw;
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[FILTERED_INSTRUCTION]");
  }

  // Remove control characters except standard line breaks and tabs
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength) + "\n\n... [Content truncated for compliance bounds]";
  }

  return cleaned.trim();
}

/**
 * Extracts hostname domain from a URL.
 */
function extractDomain(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return rawUrl;
  }
}

/**
 * Executes a single Firecrawl v1/v2 search call with timeout and abort support.
 */
async function callFirecrawlApi(
  query: string,
  includeDomains: string[] | null,
  apiKey: string,
  clientSignal?: AbortSignal
): Promise<ExternalWebResultItem[]> {
  const timeoutSignal = AbortSignal.timeout(TIMEOUT_MS);
  const combinedSignal = clientSignal
    ? AbortSignal.any([clientSignal, timeoutSignal])
    : timeoutSignal;

  const requestBody: Record<string, unknown> = {
    query,
    limit: 5,
    scrapeOptions: {
      formats: ["markdown"],
    },
  };

  if (includeDomains && includeDomains.length > 0) {
    requestBody.includeDomains = includeDomains;
  }

  const res = await fetch(FIRECRAWL_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal: combinedSignal,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Firecrawl API error (status ${res.status}): ${errorText.slice(0, 200)}`);
  }

  const json = await res.json();
  const rawData: Array<{
    title?: string;
    url?: string;
    description?: string;
    markdown?: string;
  }> = Array.isArray(json?.data) ? json.data : [];

  return rawData
    .filter((item) => item && (item.url || item.title))
    .slice(0, 5)
    .map((item) => {
      const title = item.title?.trim() || "Regulatory Web Resource";
      const url = item.url?.trim() || "";
      const domain = extractDomain(url);
      const snippet = item.description?.trim() || "";
      const sanitized = sanitizeScrapedContent(item.markdown || snippet || title);

      // Wrap in clear untrusted source boundary
      const boxedMarkdown = `[BEGIN UNTRUSTED EXTERNAL WEB CONTENT: ${title} (${url})]\n${sanitized}\n[END UNTRUSTED EXTERNAL WEB CONTENT]`;

      return {
        title,
        url,
        snippet,
        markdown: boxedMarkdown,
        domain,
      };
    });
}

/**
 * Official-first Firecrawl regulatory search with secondary fallback.
 */
export async function searchExternalRegulations(
  input: SearchExternalRegulationsInput,
  signal?: AbortSignal
): Promise<SearchExternalRegulationsOutput> {
  const trimmed = input.query?.trim();
  if (!trimmed) {
    return {
      sourceKind: "secondary-web",
      results: [],
    };
  }

  let config;
  try {
    config = getServerConfig();
  } catch (err) {
    return {
      sourceKind: "secondary-web",
      warning: "External regulatory search is currently unavailable due to server configuration.",
      results: [],
      error: err instanceof Error ? err.message : "Configuration error",
    };
  }

  const apiKey = config.FIRECRAWL_API_KEY;
  if (!apiKey || apiKey.includes("replace-with")) {
    return {
      sourceKind: "secondary-web",
      warning: "External regulatory search is unconfigured or unavailable.",
      results: [],
      error: "FIRECRAWL_API_KEY is not configured with a valid key.",
    };
  }

  const officialDomains = config.REGULATORY_OFFICIAL_DOMAINS.split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  // Construct search query, optionally incorporating jurisdiction or regulator
  const queryParts = [trimmed];
  if (input.jurisdiction) queryParts.push(`jurisdiction:${input.jurisdiction}`);
  if (input.regulator) queryParts.push(input.regulator);
  const fullQuery = queryParts.join(" ");

  try {
    // 1. Primary search: Restricted to official domains
    if (officialDomains.length > 0) {
      try {
        const officialResults = await callFirecrawlApi(
          fullQuery,
          officialDomains,
          apiKey,
          signal
        );

        if (officialResults.length > 0) {
          return {
            sourceKind: "official-web",
            results: officialResults,
          };
        }
      } catch (officialErr) {
        // If official search failed or timed out, we record or proceed to secondary attempt
        console.warn("Official domain search failed or returned no results:", officialErr);
      }
    }

    // 2. Secondary fallback: Unrestricted web search with mandatory lower-authority warning
    const secondaryResults = await callFirecrawlApi(
      fullQuery,
      null, // unrestricted
      apiKey,
      signal
    );

    return {
      sourceKind: "secondary-web",
      warning:
        "Lower-authority source: This information is derived from secondary web sources, not internal reviewed rules or official regulatory domain records. Verify independently before relying on it for compliance.",
      results: secondaryResults,
    };
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : "External search failed";
    return {
      sourceKind: "secondary-web",
      warning: "External regulatory search is currently unavailable.",
      results: [],
      error: errMessage,
    };
  }
}
