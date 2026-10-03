import type { ChatFile } from "./types";
import { isOfficialRegulatoryDomain } from "@/lib/chat/source-authority";

function hasPdfSourceHint(url: URL, label: string): boolean {
  // Official FDA downloads do not include a filename extension. This is still
  // only a candidate: MIME, bytes and page limits are checked after confirmation.
  const isFdaDownload =
    (url.hostname === "fda.gov" || url.hostname === "www.fda.gov") &&
    /^\/media\/\d+\/download\/?$/i.test(url.pathname);
  return (
    url.pathname.toLowerCase().endsWith(".pdf") ||
    isFdaDownload ||
    /\bpdf\b/i.test(label)
  );
}

/** These are source links, not validated files. Fetching happens only after confirmation. */
export function discoverPdfFiles(
  title: string,
  sourceUrl: string,
  markdown: string,
): ChatFile[] {
  const files: ChatFile[] = [];
  const add = (name: string, link: string) => {
    try {
      const url = new URL(link, sourceUrl);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        (url.port && url.port !== "443") ||
        !hasPdfSourceHint(url, name)
      )
        return;
      url.hash = "";
      if (url.href.length > 2048 || files.some((file) => file.url === url.href))
        return;
      files.push({
        id: crypto.randomUUID(),
        title: (name.trim() || title).slice(0, 200),
        origin: isOfficialRegulatoryDomain(url.hostname)
          ? "official-web"
          : "secondary-web",
        url: url.href,
        sourcePageUrl:
          sourceUrl.length <= 2048 && new URL(sourceUrl).protocol === "https:"
            ? sourceUrl
            : undefined,
        status: "available",
      });
    } catch {
      /* A malformed source link is not an import candidate. */
    }
  };
  add(title, sourceUrl);
  for (const match of markdown
    .slice(0, 50_000)
    .matchAll(/\[([^\]\n]{0,200})\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    if (files.length >= 10) break;
    add(match[1], match[2]);
  }
  return files;
}
