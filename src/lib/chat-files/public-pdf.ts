import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { InvalidRequestError, UpstreamFailureError } from "@/lib/errors";

if (typeof window !== "undefined")
  throw new Error("Server-only public PDF source validation");

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

/** Screen URLs before sending them to a remote fetch provider. This is not DNS pinning. */
export async function validatePublicPdfSource(
  raw: string,
  signal: AbortSignal,
): Promise<URL> {
  const url = publicPdfUrl(raw);
  await resolvePublic(url.hostname.replace(/^\[|\]$/g, ""), signal);
  return url;
}
