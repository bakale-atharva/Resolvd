import { ConvexError } from "convex/values";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
  "metadata",
]);

function parseIpv4(ip: string): [number, number, number, number] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    octets.push(n);
  }
  return [octets[0], octets[1], octets[2], octets[3]];
}

export function isBlockedIp(rawIp: string): boolean {
  const ip = rawIp.trim().toLowerCase().replace(/^\[|\]$/g, "");

  // Handle IPv4-mapped IPv6 addresses like ::ffff:127.0.0.1
  if (ip.startsWith("::ffff:")) {
    const mapped = ip.slice("::ffff:".length);
    const v4 = parseIpv4(mapped);
    if (v4) return isBlockedIpv4(v4);
    // Hex form e.g. ::ffff:7f00:0001
    const hexParts = mapped.split(":");
    if (hexParts.length === 2) {
      const hi = Number.parseInt(hexParts[0], 16);
      const lo = Number.parseInt(hexParts[1], 16);
      if (!Number.isNaN(hi) && !Number.isNaN(lo)) {
        return isBlockedIpv4([
          (hi >> 8) & 0xff,
          hi & 0xff,
          (lo >> 8) & 0xff,
          lo & 0xff,
        ]);
      }
    }
  }

  const v4 = parseIpv4(ip);
  if (v4) {
    return isBlockedIpv4(v4);
  }

  // IPv6 checks (strip zone index if present)
  const cleanV6 = ip.split("%")[0];
  if (
    cleanV6 === "::1" ||
    cleanV6 === "0:0:0:0:0:0:0:1" ||
    cleanV6 === "::" ||
    cleanV6 === "0:0:0:0:0:0:0:0"
  ) {
    return true;
  }

  // Link-local fe80::/10
  if (/^fe[89ab][0-9a-f]:/i.test(cleanV6)) {
    return true;
  }

  // Unique local fc00::/7 (fc00:: - fdff::)
  if (/^f[cd][0-9a-f]{2}:/i.test(cleanV6)) {
    return true;
  }

  return false;
}

function isBlockedIpv4([a, b]: [number, number, number, number]): boolean {
  // 0.0.0.0/8 ("this network")
  if (a === 0) return true;
  // 10.0.0.0/8 (private)
  if (a === 10) return true;
  // 100.64.0.0/10 (carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (link-local & cloud metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (private)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (private)
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 (benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 224.0.0.0/4 (multicast) & 240.0.0.0/4 (reserved)
  if (a >= 224) return true;

  return false;
}

/**
 * Validates that a crawl URL is a public HTTP(S) URL and does not target
 * loopback, private, link-local, or internal hostnames/IPs.
 */
export function validateCrawlUrl(rawUrl: string): URL {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new ConvexError("URL is required");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ConvexError("Invalid URL format");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ConvexError("Only http:// and https:// URLs are allowed");
  }

  if (parsed.username || parsed.password) {
    throw new ConvexError("URLs with embedded credentials are not allowed");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    throw new ConvexError("URL must include a valid hostname");
  }

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new ConvexError("Crawling internal or localhost URLs is not allowed");
  }

  // Reject integer/hex/octal IPv4 encodings like http://2130706433 or http://0x7f000001
  if (/^(0x[0-9a-f]+|0[0-7]+|\d+)$/i.test(hostname)) {
    throw new ConvexError("Numeric IP hostnames are not allowed");
  }

  if (isBlockedIp(hostname)) {
    throw new ConvexError(
      "Crawling private, loopback, or link-local IP addresses is not allowed",
    );
  }

  parsed.hash = "";
  return parsed;
}
