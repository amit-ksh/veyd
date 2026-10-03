import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";
import {
  InvalidRequestError,
  FileTooLargeError,
  UnsupportedFileError,
  UpstreamFailureError,
} from "@/lib/errors";
import { MAX_FILE_SIZE_BYTES } from "@/lib/ingestion/validator";

if (typeof window !== "undefined")
  throw new Error("Server-only PDF downloader");

const blockedV4 = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blockedV4.addSubnet(network, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
const blockedV6 = new BlockList();
blockedV6.addSubnet("2001::", 23, "ipv6");
blockedV6.addSubnet("2001:db8::", 32, "ipv6");
blockedV6.addSubnet("2002::", 16, "ipv6");
blockedV6.addSubnet("3fff::", 20, "ipv6");

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedV4.check(address, "ipv4");
  return (
    family === 6 &&
    globalV6.check(address, "ipv6") &&
    !blockedV6.check(address, "ipv6")
  );
}
export function publicPdfUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new InvalidRequestError("Invalid PDF source URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    raw.length > 2048
  )
    throw new InvalidRequestError(
      "Only public HTTPS PDF sources on port 443 can be imported.",
    );
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    (isIP(host) && !isPublicAddress(host))
  )
    throw new InvalidRequestError(
      "This PDF source is not a public internet address.",
    );
  return url;
}
async function resolvePublic(hostname: string, signal: AbortSignal) {
  signal.throwIfAborted();
  let cancel: () => void = () => {};
  try {
    const records = await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        cancel = () =>
          reject(
            new UpstreamFailureError("PDF download timed out or was canceled."),
          );
        signal.addEventListener("abort", cancel, { once: true });
      }),
    ]);
    signal.throwIfAborted();
    if (
      !records.length ||
      records.some((record) => !isPublicAddress(record.address))
    )
      throw new InvalidRequestError(
        "This PDF source resolves to a non-public internet address.",
      );
    return records[0];
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}

export async function downloadPublicPdf(
  raw: string,
  clientSignal?: AbortSignal,
): Promise<Buffer> {
  const timeout = AbortSignal.timeout(20_000);
  const signal = clientSignal
    ? AbortSignal.any([timeout, clientSignal])
    : timeout;
  let url = publicPdfUrl(raw);
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const hostname = url.hostname.replace(/^\[|\]$/g, "");
      const pinned = await resolvePublic(hostname, signal);
      const response = await new Promise<{
        buffer?: Buffer;
        redirect?: string;
      }>((resolve, reject) => {
        // Connect to the checked IP. Host and TLS servername retain the source's identity.
        const req = request(
          {
            hostname: pinned.address,
            port: 443,
            servername: hostname,
            method: "GET",
            path: url.pathname + url.search,
            signal,
            agent: false,
            rejectUnauthorized: true,
            headers: {
              Host: url.host,
              Accept: "application/pdf",
              "Accept-Encoding": "identity",
            },
          },
          async (res) => {
            try {
              if ([301, 302, 303, 307, 308].includes(res.statusCode || 0)) {
                const location = res.headers.location;
                res.destroy();
                if (!location)
                  throw new InvalidRequestError(
                    "PDF source returned an invalid redirect.",
                  );
                resolve({ redirect: new URL(location, url).href });
                return;
              }
              if (res.statusCode !== 200)
                throw new UpstreamFailureError(
                  "The PDF source could not be downloaded. Check its public link.",
                );
              const type = (res.headers["content-type"] || "")
                .split(";")[0]
                .trim()
                .toLowerCase();
              if (
                !["application/pdf", "application/octet-stream"].includes(type)
              )
                throw new UnsupportedFileError(
                  "The source returned a web page or unsupported file, not a PDF.",
                );
              if (
                res.headers["content-encoding"] &&
                res.headers["content-encoding"] !== "identity"
              )
                throw new UnsupportedFileError(
                  "Compressed PDF transfers are not supported. Use a direct PDF link.",
                );
              if (Number(res.headers["content-length"]) > MAX_FILE_SIZE_BYTES)
                throw new FileTooLargeError();
              const chunks: Buffer[] = [];
              let size = 0;
              for await (const chunk of res) {
                const bytes = Buffer.from(chunk);
                size += bytes.length;
                if (size > MAX_FILE_SIZE_BYTES) throw new FileTooLargeError();
                chunks.push(bytes);
              }
              resolve({ buffer: Buffer.concat(chunks, size) });
            } catch (error) {
              res.destroy();
              reject(error);
            }
          },
        );
        req.on("error", () =>
          reject(
            new UpstreamFailureError(
              "PDF download failed or timed out. Check the public source link.",
            ),
          ),
        );
        req.end();
      });
      if (response.buffer) return response.buffer;
      url = publicPdfUrl(response.redirect!);
    }
    throw new InvalidRequestError("The PDF source redirected too many times.");
  } catch (error) {
    if (
      error instanceof InvalidRequestError ||
      error instanceof FileTooLargeError ||
      error instanceof UnsupportedFileError ||
      error instanceof UpstreamFailureError
    )
      throw error;
    throw new UpstreamFailureError(
      "Could not resolve or download the public PDF source.",
    );
  }
}
