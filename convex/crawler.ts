import { Workpool } from "@convex-dev/workpool";
import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireWorkspaceAdmin, requireWorkspaceMember } from "./lib/auth";
import { validateCrawlUrl } from "./lib/ssrf";

const crawlPool = new Workpool(components.workpool, {
  maxParallelism: 3,
  retryActionsByDefault: false,
});

export const listWebsiteSources = query({
  args: {},
  handler: async (ctx) => {
    const { workspace } = await requireWorkspaceMember(ctx);
    return await ctx.db
      .query("kbSources")
      .withIndex("by_workspaceId_and_type", (q) =>
        q.eq("workspaceId", workspace._id).eq("type", "website"),
      )
      .order("desc")
      .take(50);
  },
});

export const listCrawlPages = query({
  args: {
    sourceId: v.id("kbSources"),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceMember(ctx);
    const source = await ctx.db.get(args.sourceId);
    if (
      !source ||
      source.workspaceId !== workspace._id ||
      source.type !== "website"
    ) {
      throw new ConvexError("Website source not found");
    }

    return await ctx.db
      .query("crawlPages")
      .withIndex("by_sourceId_and_status", (q) =>
        q.eq("sourceId", args.sourceId),
      )
      .take(200);
  },
});

export const startWebsiteCrawl = mutation({
  args: {
    url: v.string(),
    maxPages: v.optional(v.number()),
    maxDepth: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"kbSources">> => {
    const { workspace } = await requireWorkspaceAdmin(ctx);

    const parsed = validateCrawlUrl(args.url);
    const maxPages = Math.min(Math.max(Math.floor(args.maxPages ?? 15), 1), 50);
    const maxDepth = Math.min(Math.max(Math.floor(args.maxDepth ?? 2), 0), 3);
    const seedUrl = parsed.toString();
    const now = Date.now();

    const sourceId = await ctx.db.insert("kbSources", {
      workspaceId: workspace._id,
      type: "website",
      name: parsed.hostname,
      url: seedUrl,
      status: "processing",
      pagesTotal: 1,
      pagesCrawled: 0,
      createdAt: now,
      updatedAt: now,
    });

    const pageId = await ctx.db.insert("crawlPages", {
      workspaceId: workspace._id,
      sourceId,
      url: seedUrl,
      status: "queued",
      createdAt: now,
    });

    await crawlPool.enqueueAction(
      ctx,
      internal.crawlerNode.crawlPage,
      {
        workspaceId: workspace._id,
        sourceId,
        pageId,
        url: seedUrl,
        depth: 0,
        maxDepth,
        maxPages,
        rootOrigin: parsed.origin,
      },
      {
        onComplete: internal.crawler.onCrawlPageComplete,
        context: { sourceId, pageId },
      },
    );

    return sourceId;
  },
});

export const recrawlWebsiteSource = mutation({
  args: {
    sourceId: v.id("kbSources"),
    maxPages: v.optional(v.number()),
    maxDepth: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceAdmin(ctx);

    const source = await ctx.db.get(args.sourceId);
    if (
      !source ||
      source.workspaceId !== workspace._id ||
      source.type !== "website" ||
      !source.url
    ) {
      throw new ConvexError("Website source not found");
    }

    const parsed = validateCrawlUrl(source.url);
    const maxPages = Math.min(Math.max(Math.floor(args.maxPages ?? 15), 1), 50);
    const maxDepth = Math.min(Math.max(Math.floor(args.maxDepth ?? 2), 0), 3);

    const existingPages = await ctx.db
      .query("crawlPages")
      .withIndex("by_sourceId_and_status", (q) => q.eq("sourceId", source._id))
      .take(200);

    for (const page of existingPages) {
      if (page.ragEntryId) {
        await ctx.scheduler.runAfter(0, internal.rag.deleteRagEntry, {
          entryId: page.ragEntryId,
        });
      }
      await ctx.db.delete(page._id);
    }

    const now = Date.now();
    await ctx.db.patch(source._id, {
      status: "processing",
      errorMessage: undefined,
      pagesTotal: 1,
      pagesCrawled: 0,
      updatedAt: now,
    });

    const seedUrl = parsed.toString();
    const pageId = await ctx.db.insert("crawlPages", {
      workspaceId: workspace._id,
      sourceId: source._id,
      url: seedUrl,
      status: "queued",
      createdAt: now,
    });

    await crawlPool.enqueueAction(
      ctx,
      internal.crawlerNode.crawlPage,
      {
        workspaceId: workspace._id,
        sourceId: source._id,
        pageId,
        url: seedUrl,
        depth: 0,
        maxDepth,
        maxPages,
        rootOrigin: parsed.origin,
      },
      {
        onComplete: internal.crawler.onCrawlPageComplete,
        context: { sourceId: source._id, pageId },
      },
    );
  },
});

export const deleteWebsiteSource = mutation({
  args: {
    sourceId: v.id("kbSources"),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceAdmin(ctx);

    const source = await ctx.db.get(args.sourceId);
    if (
      !source ||
      source.workspaceId !== workspace._id ||
      source.type !== "website"
    ) {
      throw new ConvexError("Website source not found");
    }

    const pages = await ctx.db
      .query("crawlPages")
      .withIndex("by_sourceId_and_status", (q) => q.eq("sourceId", source._id))
      .take(200);

    for (const page of pages) {
      if (page.ragEntryId) {
        await ctx.scheduler.runAfter(0, internal.rag.deleteRagEntry, {
          entryId: page.ragEntryId,
        });
      }
      await ctx.db.delete(page._id);
    }

    await ctx.db.delete(source._id);
  },
});

export const markCrawlPageCrawling = internalMutation({
  args: {
    pageId: v.id("crawlPages"),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db.get(args.pageId);
    if (!page) return;
    await ctx.db.patch(args.pageId, { status: "crawling" });
  },
});

export const enqueueDiscoveredUrls = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    sourceId: v.id("kbSources"),
    urls: v.array(v.string()),
    nextDepth: v.number(),
    maxDepth: v.number(),
    maxPages: v.number(),
    rootOrigin: v.string(),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source || source.status !== "processing") return;

    const existingPages = await ctx.db
      .query("crawlPages")
      .withIndex("by_sourceId_and_status", (q) =>
        q.eq("sourceId", args.sourceId),
      )
      .take(200);

    if (existingPages.length >= args.maxPages) return;

    const existingUrlSet = new Set(existingPages.map((p) => p.url));
    let remainingSlots = args.maxPages - existingPages.length;
    let added = 0;

    for (const rawUrl of args.urls) {
      if (remainingSlots <= 0) break;

      let normalizedUrl: string;
      try {
        const parsed = validateCrawlUrl(rawUrl);
        if (parsed.origin !== args.rootOrigin) continue;
        normalizedUrl = parsed.toString();
      } catch {
        continue;
      }

      if (existingUrlSet.has(normalizedUrl)) continue;
      existingUrlSet.add(normalizedUrl);
      remainingSlots--;
      added++;

      const pageId = await ctx.db.insert("crawlPages", {
        workspaceId: args.workspaceId,
        sourceId: args.sourceId,
        url: normalizedUrl,
        status: "queued",
        createdAt: Date.now(),
      });

      await crawlPool.enqueueAction(
        ctx,
        internal.crawlerNode.crawlPage,
        {
          workspaceId: args.workspaceId,
          sourceId: args.sourceId,
          pageId,
          url: normalizedUrl,
          depth: args.nextDepth,
          maxDepth: args.maxDepth,
          maxPages: args.maxPages,
          rootOrigin: args.rootOrigin,
        },
        {
          onComplete: internal.crawler.onCrawlPageComplete,
          context: { sourceId: args.sourceId, pageId },
        },
      );
    }

    if (added > 0) {
      await ctx.db.patch(args.sourceId, {
        pagesTotal: existingPages.length + added,
        updatedAt: Date.now(),
      });
    }
  },
});

export const onCrawlPageComplete = crawlPool.defineOnComplete({
  context: v.object({
    sourceId: v.id("kbSources"),
    pageId: v.id("crawlPages"),
  }),
  handler: async (ctx, { context, result }) => {
    const page = await ctx.db.get(context.pageId);
    const source = await ctx.db.get(context.sourceId);
    if (!page || !source) return;

    if (result.kind === "success") {
      const returnValue = result.returnValue as
        | { title?: string; ragEntryId?: string }
        | undefined;
      await ctx.db.patch(context.pageId, {
        status: "ready",
        title: returnValue?.title,
        ragEntryId: returnValue?.ragEntryId,
        errorMessage: undefined,
      });
    } else if (result.kind === "failed") {
      await ctx.db.patch(context.pageId, {
        status: "failed",
        errorMessage: result.error.slice(0, 400),
      });
    } else {
      await ctx.db.patch(context.pageId, {
        status: "failed",
        errorMessage: "Crawl canceled",
      });
    }

    const allPages = await ctx.db
      .query("crawlPages")
      .withIndex("by_sourceId_and_status", (q) =>
        q.eq("sourceId", context.sourceId),
      )
      .take(200);

    const finishedCount = allPages.filter(
      (p) => p.status === "ready" || p.status === "failed",
    ).length;
    const readyCount = allPages.filter((p) => p.status === "ready").length;
    const pendingCount = allPages.length - finishedCount;

    await ctx.db.patch(context.sourceId, {
      pagesTotal: allPages.length,
      pagesCrawled: finishedCount,
      updatedAt: Date.now(),
      ...(pendingCount === 0
        ? {
            status: readyCount > 0 ? "ready" : "failed",
            errorMessage:
              readyCount === 0
                ? "All crawled pages failed to index."
                : undefined,
          }
        : {}),
    });
  },
});
