"use node";

import dns from "node:dns/promises";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { isBlockedIp, validateCrawlUrl } from "./lib/ssrf";
import { rag, workspaceNamespace } from "./rag";

const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2 MB

async function assertPublicDns(hostname: string): Promise<void> {
  // If hostname is already an IP literal, validateCrawlUrl already checked it.
  const results = await dns.lookup(hostname, { all: true });
  if (!results.length) {
    throw new Error(`Could not resolve hostname: ${hostname}`);
  }
  for (const record of results) {
    if (isBlockedIp(record.address)) {
      throw new Error(
        `Blocked DNS resolution to private/loopback IP: ${record.address}`,
      );
    }
  }
}

async function fetchPublicHtml(
  initialUrl: string,
): Promise<{ finalUrl: string; html: string }> {
  let currentUrl = initialUrl;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const parsed = validateCrawlUrl(currentUrl);
    await assertPublicDns(parsed.hostname);

    const response = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent": "ResolvdBot/1.0 (+https://resolvd.app)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(`Redirect (${response.status}) missing Location header`);
      }
      currentUrl = new URL(location, parsed).toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (
      contentType &&
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml") &&
      !contentType.includes("text/plain")
    ) {
      throw new Error(`Unsupported content-type: ${contentType}`);
    }

    const html = await response.text();
    if (html.length > MAX_HTML_BYTES) {
      return {
        finalUrl: parsed.toString(),
        html: html.slice(0, MAX_HTML_BYTES),
      };
    }

    return { finalUrl: parsed.toString(), html };
  }

  throw new Error("Too many redirects");
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
}

function extractTitle(html: string, fallbackUrl: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (match?.[1]) {
    const cleaned = decodeHtmlEntities(match[1].replace(/\s+/g, " ").trim());
    if (cleaned) return cleaned.slice(0, 160);
  }
  return fallbackUrl;
}

function htmlToMarkdown(html: string): string {
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ");

  cleaned = cleaned
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n")
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|blockquote|tr)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(cleaned)
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractSameOriginLinks(
  html: string,
  baseUrl: string,
  rootOrigin: string,
): string[] {
  const links = new Set<string>();
  const hrefRegex = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    const rawHref = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (
      !rawHref ||
      rawHref.startsWith("#") ||
      rawHref.startsWith("mailto:") ||
      rawHref.startsWith("tel:") ||
      rawHref.startsWith("javascript:")
    ) {
      continue;
    }

    try {
      const resolved = new URL(rawHref, baseUrl);
      if (resolved.origin !== rootOrigin) continue;
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:") continue;
      if (
        /\.(png|jpe?g|gif|webp|svg|ico|css|js|woff2?|ttf|eot|zip|tar|gz|mp4|mp3)$/i.test(
          resolved.pathname,
        )
      ) {
        continue;
      }
      resolved.hash = "";
      links.add(resolved.toString());
    } catch {
      // Ignore malformed hrefs
    }
  }

  return Array.from(links).slice(0, 60);
}

export const crawlPage = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    sourceId: v.id("kbSources"),
    pageId: v.id("crawlPages"),
    url: v.string(),
    depth: v.number(),
    maxDepth: v.number(),
    maxPages: v.number(),
    rootOrigin: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ title: string; ragEntryId: string }> => {
    await ctx.runMutation(internal.crawler.markCrawlPageCrawling, {
      pageId: args.pageId,
    });

    const { finalUrl, html } = await fetchPublicHtml(args.url);
    const title = extractTitle(html, finalUrl);
    const markdown = htmlToMarkdown(html);

    if (!markdown) {
      throw new Error("No readable text content found on page.");
    }

    const ragResult = await rag.add(ctx, {
      namespace: workspaceNamespace(args.workspaceId),
      key: `website:${args.sourceId}:${finalUrl}`,
      title,
      text: `# ${title}\nSource: ${finalUrl}\n\n${markdown}`,
      filterValues: [
        { name: "sourceType", value: "website" },
        { name: "sourceId", value: args.sourceId },
      ],
      metadata: {
        sourceType: "website",
        sourceId: args.sourceId,
        title,
        url: finalUrl,
      },
    });

    if (args.depth < args.maxDepth) {
      const discovered = extractSameOriginLinks(
        html,
        finalUrl,
        args.rootOrigin,
      );
      if (discovered.length > 0) {
        await ctx.runMutation(internal.crawler.enqueueDiscoveredUrls, {
          workspaceId: args.workspaceId,
          sourceId: args.sourceId,
          urls: discovered,
          nextDepth: args.depth + 1,
          maxDepth: args.maxDepth,
          maxPages: args.maxPages,
          rootOrigin: args.rootOrigin,
        });
      }
    }

    return {
      title,
      ragEntryId: ragResult.entryId,
    };
  },
});
