import {
  listUIMessages,
  saveMessage,
  syncStreams,
  vStreamArgs,
  vStreamUIMessagesReturnValue,
} from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  conversationsByAssignee,
  conversationsByUnread,
  leadsByStatus,
  syncConversationUpdate,
  UNASSIGNED_KEY,
} from "./lib/aggregates";
import { requireWorkspaceMember } from "./lib/auth";

const inboxFilterValidator = v.union(
  v.literal("all"),
  v.literal("unread"),
  v.literal("unassigned"),
  v.literal("mine"),
);

const conversationStatusValidator = v.union(
  v.literal("open"),
  v.literal("closed"),
);

const conversationModeValidator = v.union(
  v.literal("ai"),
  v.literal("human"),
);

async function requireWorkspaceConversation(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  conversationId: Id<"conversations">,
): Promise<Doc<"conversations">> {
  const conversation = await ctx.db.get(conversationId);
  if (!conversation || conversation.workspaceId !== workspaceId) {
    throw new ConvexError("Conversation not found");
  }
  return conversation;
}

/**
 * Returns O(log n) live filter counts for the active workspace using
 * `@convex-dev/aggregate`.
 */
export const getInboxCounts = query({
  args: {},
  handler: async (ctx) => {
    const { user, workspace } = await requireWorkspaceMember(ctx);

    const [all, unread, unassigned, mine, newLeads] = await Promise.all([
      conversationsByUnread.count(ctx, { namespace: workspace._id }),
      conversationsByUnread.count(ctx, {
        namespace: workspace._id,
        bounds: { prefix: [1] },
      }),
      conversationsByAssignee.count(ctx, {
        namespace: workspace._id,
        bounds: { prefix: [UNASSIGNED_KEY] },
      }),
      conversationsByAssignee.count(ctx, {
        namespace: workspace._id,
        bounds: { prefix: [user.subject] },
      }),
      leadsByStatus.count(ctx, {
        namespace: workspace._id,
        bounds: { prefix: ["new"] },
      }),
    ]);

    return {
      all,
      unread,
      unassigned,
      mine,
      newLeads,
    };
  },
});

/**
 * Paginated list of workspace conversations ordered by `lastMessageAt` desc,
 * supporting filter tabs (`all`, `unread`, `unassigned`, `mine`) and optional
 * status (`open` | `closed`).
 */
export const listConversations = query({
  args: {
    filter: v.optional(inboxFilterValidator),
    status: v.optional(conversationStatusValidator),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { user, workspace } = await requireWorkspaceMember(ctx);
    const filter = args.filter ?? "all";

    const baseQuery = args.status
      ? ctx.db
          .query("conversations")
          .withIndex("by_workspaceId_and_status_and_lastMessageAt", (q) =>
            q.eq("workspaceId", workspace._id).eq("status", args.status!),
          )
          .order("desc")
      : ctx.db
          .query("conversations")
          .withIndex("by_workspaceId_and_lastMessageAt", (q) =>
            q.eq("workspaceId", workspace._id),
          )
          .order("desc");

    const filteredQuery =
      filter === "unread"
        ? baseQuery.filter((q) => q.gt(q.field("unreadCount"), 0))
        : filter === "unassigned"
          ? baseQuery.filter((q) => q.eq(q.field("assignedToUserId"), undefined))
          : filter === "mine"
            ? baseQuery.filter((q) =>
                q.eq(q.field("assignedToUserId"), user.subject),
              )
            : baseQuery;

    const result = await filteredQuery.paginate(args.paginationOpts);

    const assigneeIds = Array.from(
      new Set(
        result.page
          .map((c) => c.assignedToUserId)
          .filter((id): id is string => typeof id === "string"),
      ),
    );

    const assigneeMap = new Map<
      string,
      { clerkUserId: string; name: string; email: string; imageUrl: string | null }
    >();

    await Promise.all(
      assigneeIds.map(async (clerkUserId) => {
        const membership = await ctx.db
          .query("memberships")
          .withIndex("by_workspaceId_and_clerkUserId", (q) =>
            q.eq("workspaceId", workspace._id).eq("clerkUserId", clerkUserId),
          )
          .unique();
        if (membership) {
          assigneeMap.set(clerkUserId, {
            clerkUserId: membership.clerkUserId,
            name: membership.name,
            email: membership.email,
            imageUrl: membership.imageUrl ?? null,
          });
        }
      }),
    );

    return {
      ...result,
      page: result.page.map((conv) => ({
        ...conv,
        assignee: conv.assignedToUserId
          ? (assigneeMap.get(conv.assignedToUserId) ?? null)
          : null,
      })),
    };
  },
});

/**
 * Fetches full conversation metadata, linked lead, assignee, and thread
 * citations for the active workspace.
 */
export const getConversationDetail = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceMember(ctx);
    const conversation = await requireWorkspaceConversation(
      ctx,
      workspace._id,
      args.conversationId,
    );

    const [lead, assigneeMembership, citations] = await Promise.all([
      conversation.leadId ? ctx.db.get(conversation.leadId) : Promise.resolve(null),
      conversation.assignedToUserId
        ? ctx.db
            .query("memberships")
            .withIndex("by_workspaceId_and_clerkUserId", (q) =>
              q
                .eq("workspaceId", workspace._id)
                .eq("clerkUserId", conversation.assignedToUserId!),
            )
            .unique()
        : Promise.resolve(null),
      ctx.db
        .query("messageCitations")
        .withIndex("by_threadId", (q) => q.eq("threadId", conversation.threadId))
        .take(50),
    ]);

    return {
      conversation,
      lead: lead && lead.workspaceId === workspace._id ? lead : null,
      assignee: assigneeMembership
        ? {
            clerkUserId: assigneeMembership.clerkUserId,
            name: assigneeMembership.name,
            email: assigneeMembership.email,
            imageUrl: assigneeMembership.imageUrl ?? null,
          }
        : null,
      citations,
    };
  },
});

/**
 * Lists `@convex-dev/agent` UI messages + active streams for an inbox thread.
 */
export const listInboxMessages = query({
  args: {
    conversationId: v.id("conversations"),
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  returns: vStreamUIMessagesReturnValue,
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceMember(ctx);
    const conversation = await requireWorkspaceConversation(
      ctx,
      workspace._id,
      args.conversationId,
    );
    if (conversation.threadId !== args.threadId) {
      throw new ConvexError("Conversation not found");
    }

    const paginated = await listUIMessages(ctx, components.agent, {
      threadId: conversation.threadId,
      paginationOpts: args.paginationOpts,
    });
    const streams = await syncStreams(ctx, components.agent, {
      threadId: conversation.threadId,
      streamArgs: args.streamArgs,
    });

    return { ...paginated, streams };
  },
});

/**
 * Marks a conversation as read (`unreadCount: 0`) and updates aggregates.
 */
export const markAsRead = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceMember(ctx);
    const conversation = await requireWorkspaceConversation(
      ctx,
      workspace._id,
      args.conversationId,
    );

    if (conversation.unreadCount === 0) {
      return null;
    }

    await ctx.db.patch(conversation._id, { unreadCount: 0 });
    const updated = await ctx.db.get(conversation._id);
    if (updated) {
      await syncConversationUpdate(ctx, conversation, updated);
    }

    return null;
  },
});

/**
 * Assigns or unassigns a conversation to a workspace team member.
 */
export const assignConversation = mutation({
  args: {
    conversationId: v.id("conversations"),
    assignedToUserId: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const { user, workspace } = await requireWorkspaceMember(ctx);
    const conversation = await requireWorkspaceConversation(
      ctx,
      workspace._id,
      args.conversationId,
    );

    if (args.assignedToUserId !== null && args.assignedToUserId !== user.subject) {
      const targetMember = await ctx.db
        .query("memberships")
        .withIndex("by_workspaceId_and_clerkUserId", (q) =>
          q
            .eq("workspaceId", workspace._id)
            .eq("clerkUserId", args.assignedToUserId!),
        )
        .unique();

      if (!targetMember) {
        throw new ConvexError("Assignee is not a member of this workspace");
      }
    }

    await ctx.db.patch(conversation._id, {
      assignedToUserId: args.assignedToUserId ?? undefined,
    });
    const updated = await ctx.db.get(conversation._id);
    if (updated) {
      await syncConversationUpdate(ctx, conversation, updated);
    }

    return null;
  },
});

/**
 * Updates a conversation's status (`open` | `closed`) and syncs aggregates.
 */
export const updateConversationStatus = mutation({
  args: {
    conversationId: v.id("conversations"),
    status: conversationStatusValidator,
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceMember(ctx);
    const conversation = await requireWorkspaceConversation(
      ctx,
      workspace._id,
      args.conversationId,
    );

    if (conversation.status === args.status) {
      return null;
    }

    await ctx.db.patch(conversation._id, { status: args.status });
    const updated = await ctx.db.get(conversation._id);
    if (updated) {
      await syncConversationUpdate(ctx, conversation, updated);
    }

    return null;
  },
});

/**
 * Toggles AI vs Human takeover mode (`ai` | `human`). When switching to
 * `human` on an unassigned conversation, auto-assigns to the acting member.
 */
export const toggleAiTakeover = mutation({
  args: {
    conversationId: v.id("conversations"),
    mode: conversationModeValidator,
  },
  handler: async (ctx, args) => {
    const { user, workspace } = await requireWorkspaceMember(ctx);
    const conversation = await requireWorkspaceConversation(
      ctx,
      workspace._id,
      args.conversationId,
    );

    const shouldAutoAssign =
      args.mode === "human" && !conversation.assignedToUserId;

    await ctx.db.patch(conversation._id, {
      mode: args.mode,
      ...(shouldAutoAssign ? { assignedToUserId: user.subject } : {}),
    });
    const updated = await ctx.db.get(conversation._id);
    if (updated) {
      await syncConversationUpdate(ctx, conversation, updated);
    }

    return null;
  },
});

/**
 * Sends a human agent reply directly into the `@convex-dev/agent` thread,
 * switches the conversation to `human` mode, clears `unreadCount`, and
 * updates `lastMessagePreview` / `lastMessageAt`.
 */
export const sendAgentReply = mutation({
  args: {
    conversationId: v.id("conversations"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, workspace } = await requireWorkspaceMember(ctx);
    const conversation = await requireWorkspaceConversation(
      ctx,
      workspace._id,
      args.conversationId,
    );

    const trimmed = args.body.trim();
    if (!trimmed) {
      throw new ConvexError("Message cannot be empty");
    }

    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId: conversation.threadId,
      agentName: user.name,
      message: {
        role: "assistant",
        content: trimmed,
      },
    });

    const now = Date.now();
    await ctx.db.patch(conversation._id, {
      status: "open",
      mode: "human",
      unreadCount: 0,
      lastMessagePreview: trimmed.slice(0, 140),
      lastMessageAt: now,
      ...(!conversation.assignedToUserId
        ? { assignedToUserId: user.subject }
        : {}),
    });

    const updated = await ctx.db.get(conversation._id);
    if (updated) {
      await syncConversationUpdate(ctx, conversation, updated);
    }

    return { messageId };
  },
});
