import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireWorkspaceAdmin, requireWorkspaceMember } from "./lib/auth";
import { rag, workspaceNamespace } from "./rag";

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "article";
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireWorkspaceAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const listArticles = query({
  args: {
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    publishedOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceMember(ctx);
    const searchTerm = args.search?.trim();

    const rawArticles = searchTerm
      ? await ctx.db
          .query("articles")
          .withSearchIndex("search_articles", (q) => {
            const base = q
              .search("title", searchTerm)
              .eq("workspaceId", workspace._id);
            const withPublished =
              args.publishedOnly !== undefined
                ? base.eq("isPublished", args.publishedOnly)
                : base;
            return args.category
              ? withPublished.eq("category", args.category)
              : withPublished;
          })
          .take(100)
      : await ctx.db
          .query("articles")
          .withIndex("by_workspaceId_and_slug", (q) =>
            q.eq("workspaceId", workspace._id),
          )
          .take(100);

    const filtered = rawArticles.filter((article) => {
      if (args.publishedOnly !== undefined && article.isPublished !== args.publishedOnly) {
        return false;
      }
      if (args.category && article.category !== args.category) {
        return false;
      }
      return true;
    });

    filtered.sort((a, b) => b.updatedAt - a.updatedAt);

    return await Promise.all(
      filtered.map(async (article) => ({
        ...article,
        coverUrl: article.coverStorageId
          ? await ctx.storage.getUrl(article.coverStorageId)
          : null,
      })),
    );
  },
});

export const getArticleBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceMember(ctx);
    const article = await ctx.db
      .query("articles")
      .withIndex("by_workspaceId_and_slug", (q) =>
        q.eq("workspaceId", workspace._id).eq("slug", args.slug),
      )
      .unique();

    if (!article) return null;

    return {
      ...article,
      coverUrl: article.coverStorageId
        ? await ctx.storage.getUrl(article.coverStorageId)
        : null,
    };
  },
});

export const createArticle = mutation({
  args: {
    title: v.string(),
    slug: v.optional(v.string()),
    category: v.string(),
    contentMarkdown: v.string(),
    coverStorageId: v.optional(v.id("_storage")),
    isPopular: v.boolean(),
    isPublished: v.boolean(),
  },
  handler: async (ctx, args): Promise<Id<"articles">> => {
    const { workspace } = await requireWorkspaceAdmin(ctx);

    const title = args.title.trim();
    if (!title) {
      throw new ConvexError("Article title is required");
    }

    const category = args.category.trim() || "General";
    const slug = slugify(args.slug?.trim() ? args.slug : title);

    const existing = await ctx.db
      .query("articles")
      .withIndex("by_workspaceId_and_slug", (q) =>
        q.eq("workspaceId", workspace._id).eq("slug", slug),
      )
      .unique();

    if (existing) {
      throw new ConvexError(`An article with slug "${slug}" already exists`);
    }

    const now = Date.now();
    const articleId = await ctx.db.insert("articles", {
      workspaceId: workspace._id,
      title,
      slug,
      category,
      contentMarkdown: args.contentMarkdown,
      coverStorageId: args.coverStorageId,
      isPopular: args.isPopular,
      isPublished: args.isPublished,
      createdAt: now,
      updatedAt: now,
    });

    if (args.isPublished) {
      await ctx.scheduler.runAfter(0, internal.articles.syncArticleToRag, {
        articleId,
      });
    }

    return articleId;
  },
});

export const updateArticle = mutation({
  args: {
    articleId: v.id("articles"),
    title: v.string(),
    slug: v.optional(v.string()),
    category: v.string(),
    contentMarkdown: v.string(),
    coverStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    isPopular: v.boolean(),
    isPublished: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceAdmin(ctx);

    const article = await ctx.db.get(args.articleId);
    if (!article || article.workspaceId !== workspace._id) {
      throw new ConvexError("Article not found");
    }

    const title = args.title.trim();
    if (!title) {
      throw new ConvexError("Article title is required");
    }

    const nextSlug = slugify(args.slug?.trim() ? args.slug : title);
    if (nextSlug !== article.slug) {
      const conflict = await ctx.db
        .query("articles")
        .withIndex("by_workspaceId_and_slug", (q) =>
          q.eq("workspaceId", workspace._id).eq("slug", nextSlug),
        )
        .unique();
      if (conflict && conflict._id !== article._id) {
        throw new ConvexError(
          `An article with slug "${nextSlug}" already exists`,
        );
      }
    }

    if (
      args.coverStorageId === null &&
      article.coverStorageId
    ) {
      await ctx.storage.delete(article.coverStorageId);
    } else if (
      args.coverStorageId &&
      article.coverStorageId &&
      args.coverStorageId !== article.coverStorageId
    ) {
      await ctx.storage.delete(article.coverStorageId);
    }

    const nextCoverStorageId =
      args.coverStorageId === null
        ? undefined
        : args.coverStorageId ?? article.coverStorageId;

    await ctx.db.patch(article._id, {
      title,
      slug: nextSlug,
      category: args.category.trim() || "General",
      contentMarkdown: args.contentMarkdown,
      coverStorageId: nextCoverStorageId,
      isPopular: args.isPopular,
      isPublished: args.isPublished,
      updatedAt: Date.now(),
      ...(args.isPublished ? {} : { ragEntryId: undefined }),
    });

    if (args.isPublished) {
      await ctx.scheduler.runAfter(0, internal.articles.syncArticleToRag, {
        articleId: article._id,
      });
    } else if (article.ragEntryId) {
      await ctx.scheduler.runAfter(0, internal.rag.deleteRagEntry, {
        entryId: article.ragEntryId,
      });
    }
  },
});

export const deleteArticle = mutation({
  args: {
    articleId: v.id("articles"),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceAdmin(ctx);

    const article = await ctx.db.get(args.articleId);
    if (!article || article.workspaceId !== workspace._id) {
      throw new ConvexError("Article not found");
    }

    if (article.ragEntryId) {
      await ctx.scheduler.runAfter(0, internal.rag.deleteRagEntry, {
        entryId: article.ragEntryId,
      });
    }

    if (article.coverStorageId) {
      await ctx.storage.delete(article.coverStorageId);
    }

    await ctx.db.delete(article._id);
  },
});

export const getArticleForSync = internalQuery({
  args: { articleId: v.id("articles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.articleId);
  },
});

export const setArticleRagEntryId = internalMutation({
  args: {
    articleId: v.id("articles"),
    ragEntryId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.articleId);
    if (!existing) return;
    await ctx.db.patch(args.articleId, {
      ragEntryId: args.ragEntryId,
    });
  },
});

export const syncArticleToRag = internalAction({
  args: { articleId: v.id("articles") },
  handler: async (ctx, args) => {
    const article = await ctx.runQuery(internal.articles.getArticleForSync, {
      articleId: args.articleId,
    });
    if (!article || !article.isPublished) return;

    const text = `# ${article.title}\n\nCategory: ${article.category}\n\n${article.contentMarkdown}`.trim();
    if (!text) return;

    const result = await rag.add(ctx, {
      namespace: workspaceNamespace(article.workspaceId),
      key: `article:${article._id}`,
      title: article.title,
      text,
      filterValues: [
        { name: "sourceType", value: "article" },
        { name: "sourceId", value: article._id },
      ],
      metadata: {
        sourceType: "article",
        sourceId: article._id,
        title: article.title,
      },
    });

    await ctx.runMutation(internal.articles.setArticleRagEntryId, {
      articleId: article._id,
      ragEntryId: result.entryId,
    });
  },
});
