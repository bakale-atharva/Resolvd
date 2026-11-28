import {
  createThread,
  listUIMessages,
  saveMessage,
  syncStreams,
  vStreamArgs,
  vStreamUIMessagesReturnValue,
} from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  syncConversationInsert,
  syncConversationUpdate,
  syncLeadInsert,
  syncLeadUpdate,
} from "./lib/aggregates";

const citationValidator = v.object({
  title: v.string(),
  sourceType: v.union(
    v.literal("article"),
    v.literal("document"),
    v.literal("website"),
    v.literal("unknown"),
  ),
  sourceId: v.string(),
  url: v.optional(v.string()),
  slug: v.optional(v.string()),
});

async function assertVisitorConversation(
  ctx: QueryCtx | MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    threadId: string;
    visitorSessionId: string;
  },
) {
  const conversation = await ctx.db
    .query("conversations")
    .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
    .unique();

  if (
    !conversation ||
    conversation.workspaceId !== args.workspaceId ||
    conversation.visitorSessionId !== args.visitorSessionId
  ) {
    throw new ConvexError("Conversation not found");
  }

  return conversation;
}

export const getPublicWidgetConfig = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      return null;
    }

    const config = await ctx.db
      .query("widgetConfigs")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();

    const logoUrl = config?.logoStorageId
      ? await ctx.storage.getUrl(config.logoStorageId)
      : null;

    return {
      workspaceId: workspace._id,
      workspaceName: workspace.name,
      primaryColor: config?.primaryColor ?? "#14532d",
      backgroundColor: config?.backgroundColor ?? "#ffffff",
      textColor: config?.textColor ?? "#111827",
      borderRadius: config?.borderRadius ?? 16,
      marginBottom: config?.marginBottom ?? 20,
      marginSide: config?.marginSide ?? 20,
      position: config?.position ?? "bottom-right",
      title: config?.title ?? `${workspace.name} Support`,
      subtitle: config?.subtitle ?? "Ask us anything or browse help articles.",
      logoUrl,
      soundEnabled: config?.soundEnabled ?? true,
      proactiveEnabled: config?.proactiveEnabled ?? false,
      proactiveDelaySeconds: config?.proactiveDelaySeconds ?? 8,
      proactiveMessage:
        config?.proactiveMessage ??
        "Need a hand? Ask our team or AI assistant.",
      leadGateEnabled: config?.leadGateEnabled ?? false,
      leadGateFields: config?.leadGateFields ?? {
        name: true,
        email: true,
        phone: false,
      },
      faqs: config?.faqs ?? [],
      hideBranding: config?.hideBranding ?? false,
    };
  },
});

export const startOrResumeVisitorSession = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorSessionId: v.string(),
    visitorName: v.optional(v.string()),
    visitorEmail: v.optional(v.string()),
    visitorPhone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new ConvexError("Workspace not found");
    }

    const sessionId = args.visitorSessionId.trim();
    if (!sessionId) {
      throw new ConvexError("Visitor session ID is required");
    }

    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_workspaceId_and_visitorSessionId", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("visitorSessionId", sessionId),
      )
      .order("desc")
      .first();

    if (existing) {
      return {
        conversationId: existing._id,
        threadId: existing.threadId,
        status: existing.status,
        mode: existing.mode,
        visitorName: existing.visitorName ?? null,
        visitorEmail: existing.visitorEmail ?? null,
        visitorPhone: existing.visitorPhone ?? null,
        hasLeadInfo: Boolean(
          existing.visitorName || existing.visitorEmail || existing.visitorPhone,
        ),
      };
    }

    const now = Date.now();
    const threadId = await createThread(ctx, components.agent, {
      userId: sessionId,
      title: args.visitorName?.trim() || "Website Visitor",
    });

    let leadId: Id<"leads"> | undefined;
    const trimmedName = args.visitorName?.trim();
    const trimmedEmail = args.visitorEmail?.trim();
    const trimmedPhone = args.visitorPhone?.trim();

    const conversationId = await ctx.db.insert("conversations", {
      workspaceId: args.workspaceId,
      threadId,
      visitorSessionId: sessionId,
      ...(trimmedName ? { visitorName: trimmedName } : {}),
      ...(trimmedEmail ? { visitorEmail: trimmedEmail } : {}),
      ...(trimmedPhone ? { visitorPhone: trimmedPhone } : {}),
      status: "open",
      mode: "ai",
      unreadCount: 0,
      lastMessageAt: now,
      createdAt: now,
    });

    if (trimmedName || trimmedEmail || trimmedPhone) {
      leadId = await ctx.db.insert("leads", {
        workspaceId: args.workspaceId,
        conversationId,
        ...(trimmedName ? { name: trimmedName } : {}),
        ...(trimmedEmail ? { email: trimmedEmail } : {}),
        ...(trimmedPhone ? { phone: trimmedPhone } : {}),
        source: "widget_gate",
        status: "new",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(conversationId, { leadId });
      const leadDoc = await ctx.db.get(leadId);
      if (leadDoc) {
        await syncLeadInsert(ctx, leadDoc);
      }
    }

    const conversationDoc = await ctx.db.get(conversationId);
    if (conversationDoc) {
      await syncConversationInsert(ctx, conversationDoc);
    }

    return {
      conversationId,
      threadId,
      status: "open" as const,
      mode: "ai" as const,
      visitorName: trimmedName ?? null,
      visitorEmail: trimmedEmail ?? null,
      visitorPhone: trimmedPhone ?? null,
      hasLeadInfo: Boolean(trimmedName || trimmedEmail || trimmedPhone),
    };
  },
});

export const getWidgetConversationStatus = query({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    visitorSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (
      !conversation ||
      conversation.workspaceId !== args.workspaceId ||
      conversation.visitorSessionId !== args.visitorSessionId
    ) {
      return null;
    }

    let assignedAgentName: string | null = null;
    if (conversation.assignedToUserId) {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_workspaceId_and_clerkUserId", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("clerkUserId", conversation.assignedToUserId!),
        )
        .unique();
      assignedAgentName = membership?.name ?? null;
    }

    return {
      mode: conversation.mode,
      status: conversation.status,
      assignedAgentName,
      hasLeadInfo: Boolean(
        conversation.visitorName ||
          conversation.visitorEmail ||
          conversation.visitorPhone,
      ),
    };
  },
});

export const submitLeadCapture = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    visitorSessionId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (
      !conversation ||
      conversation.workspaceId !== args.workspaceId ||
      conversation.visitorSessionId !== args.visitorSessionId
    ) {
      throw new ConvexError("Conversation not found");
    }

    const name = args.name?.trim() || undefined;
    const email = args.email?.trim() || undefined;
    const phone = args.phone?.trim() || undefined;

    if (!name && !email && !phone) {
      throw new ConvexError("Please provide at least one contact field");
    }

    const now = Date.now();

    await ctx.db.patch(conversation._id, {
      ...(name ? { visitorName: name } : {}),
      ...(email ? { visitorEmail: email } : {}),
      ...(phone ? { visitorPhone: phone } : {}),
    });

    if (conversation.leadId) {
      const oldLead = await ctx.db.get(conversation.leadId);
      await ctx.db.patch(conversation.leadId, {
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        updatedAt: now,
      });
      const newLead = await ctx.db.get(conversation.leadId);
      if (oldLead && newLead) {
        await syncLeadUpdate(ctx, oldLead, newLead);
      }
      return conversation.leadId;
    }

    const leadId = await ctx.db.insert("leads", {
      workspaceId: args.workspaceId,
      conversationId: conversation._id,
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      source: "widget_gate",
      status: "new",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(conversation._id, { leadId });
    const leadDoc = await ctx.db.get(leadId);
    if (leadDoc) {
      await syncLeadInsert(ctx, leadDoc);
    }
    return leadId;
  },
});

export const sendVisitorMessage = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    visitorSessionId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const trimmed = args.message.trim();
    if (!trimmed) {
      throw new ConvexError("Message cannot be empty");
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (
      !conversation ||
      conversation.workspaceId !== args.workspaceId ||
      conversation.visitorSessionId !== args.visitorSessionId
    ) {
      throw new ConvexError("Conversation not found");
    }

    const now = Date.now();
    await ctx.db.patch(conversation._id, {
      status: "open",
      unreadCount: conversation.unreadCount + 1,
      lastMessagePreview: trimmed.slice(0, 140),
      lastMessageAt: now,
    });
    const updatedConversation = await ctx.db.get(conversation._id);
    if (updatedConversation) {
      await syncConversationUpdate(ctx, conversation, updatedConversation);
    }

    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId: conversation.threadId,
      prompt: trimmed,
    });

    if (conversation.mode === "ai") {
      await ctx.scheduler.runAfter(0, internal.agent.generateSupportReply, {
        workspaceId: args.workspaceId,
        conversationId: conversation._id,
        threadId: conversation.threadId,
        promptMessageId: messageId,
        prompt: trimmed,
      });
    }

    return { messageId };
  },
});

export const listWidgetMessages = query({
  args: {
    workspaceId: v.id("workspaces"),
    threadId: v.string(),
    visitorSessionId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  returns: vStreamUIMessagesReturnValue,
  handler: async (ctx, args) => {
    await assertVisitorConversation(ctx, {
      workspaceId: args.workspaceId,
      threadId: args.threadId,
      visitorSessionId: args.visitorSessionId,
    });

    const paginated = await listUIMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
    });
    const streams = await syncStreams(ctx, components.agent, {
      threadId: args.threadId,
      streamArgs: args.streamArgs,
    });

    return { ...paginated, streams };
  },
});

export const getWidgetThreadCitations = query({
  args: {
    workspaceId: v.id("workspaces"),
    threadId: v.string(),
    visitorSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    await assertVisitorConversation(ctx, {
      workspaceId: args.workspaceId,
      threadId: args.threadId,
      visitorSessionId: args.visitorSessionId,
    });

    return await ctx.db
      .query("messageCitations")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .take(50);
  },
});

export const searchPublicArticles = query({
  args: {
    workspaceId: v.id("workspaces"),
    searchQuery: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const trimmedQuery = args.searchQuery?.trim();
    const category = args.category?.trim();

    const rows = trimmedQuery
      ? await ctx.db
          .query("articles")
          .withSearchIndex("search_articles", (q) => {
            const base = q
              .search("title", trimmedQuery)
              .eq("workspaceId", args.workspaceId)
              .eq("isPublished", true);
            return category ? base.eq("category", category) : base;
          })
          .take(25)
      : await ctx.db
          .query("articles")
          .withIndex("by_workspaceId_and_isPublished", (q) =>
            q.eq("workspaceId", args.workspaceId).eq("isPublished", true),
          )
          .take(50);

    const filtered = category
      ? rows.filter((a) => a.category === category)
      : rows;

    return filtered.map((article) => ({
      _id: article._id,
      title: article.title,
      slug: article.slug,
      category: article.category,
      isPopular: article.isPopular,
      excerpt: article.contentMarkdown
        .replace(/[#*_`>\[\]]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 140),
      updatedAt: article.updatedAt,
    }));
  },
});

export const getPublicArticle = query({
  args: {
    workspaceId: v.id("workspaces"),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const article = await ctx.db
      .query("articles")
      .withIndex("by_workspaceId_and_slug", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("slug", args.slug),
      )
      .unique();

    if (!article || !article.isPublished) {
      return null;
    }

    const coverUrl = article.coverStorageId
      ? await ctx.storage.getUrl(article.coverStorageId)
      : null;

    return {
      _id: article._id,
      title: article.title,
      slug: article.slug,
      category: article.category,
      contentMarkdown: article.contentMarkdown,
      coverUrl,
      isPopular: article.isPopular,
      updatedAt: article.updatedAt,
    };
  },
});

export const getAgentWorkspaceContext = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    const conversation = await ctx.db.get(args.conversationId);
    if (
      !workspace ||
      !conversation ||
      conversation.workspaceId !== args.workspaceId
    ) {
      return null;
    }

    return {
      workspaceName: workspace.name,
      aiModel: workspace.aiModel,
      systemPrompt: workspace.systemPrompt,
      mode: conversation.mode,
    };
  },
});

export const enrichCitationsWithSlugs = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    citations: v.array(citationValidator),
  },
  handler: async (ctx, args) => {
    const enriched = await Promise.all(
      args.citations.map(async (citation) => {
        if (citation.sourceType !== "article") {
          return citation;
        }
        try {
          const article = await ctx.db.get(
            citation.sourceId as Id<"articles">,
          );
          if (
            article &&
            article.workspaceId === args.workspaceId &&
            article.isPublished
          ) {
            return { ...citation, slug: article.slug };
          }
        } catch {
          // Ignore malformed IDs
        }
        return citation;
      }),
    );
    return enriched;
  },
});

export const recordAssistantReply = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    threadId: v.string(),
    messageId: v.string(),
    preview: v.string(),
    citations: v.array(citationValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const oldConversation = await ctx.db.get(args.conversationId);
    await ctx.db.patch(args.conversationId, {
      lastMessagePreview: args.preview,
      lastMessageAt: now,
    });
    const newConversation = await ctx.db.get(args.conversationId);
    if (oldConversation && newConversation) {
      await syncConversationUpdate(ctx, oldConversation, newConversation);
    }

    if (args.citations.length > 0) {
      await ctx.db.insert("messageCitations", {
        workspaceId: args.workspaceId,
        threadId: args.threadId,
        messageId: args.messageId,
        citations: args.citations,
        createdAt: now,
      });
    }

    return null;
  },
});
