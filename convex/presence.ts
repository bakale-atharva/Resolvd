import { Presence } from "@convex-dev/presence";
import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireWorkspaceMember } from "./lib/auth";

export const presence = new Presence(components.presence);

const ROOM_PREFIX = "conv:";
const AGENT_PREFIX = "agent:";
const VISITOR_PREFIX = "visitor:";

export function conversationRoomId(conversationId: Id<"conversations">): string {
  return `${ROOM_PREFIX}${conversationId}`;
}

function parseConversationIdFromRoom(roomId: string): Id<"conversations"> {
  if (!roomId.startsWith(ROOM_PREFIX)) {
    throw new ConvexError("Invalid presence room");
  }
  const rawId = roomId.slice(ROOM_PREFIX.length);
  if (!rawId) {
    throw new ConvexError("Invalid presence room");
  }
  return rawId as Id<"conversations">;
}

async function authorizeRoomHeartbeat(
  ctx: MutationCtx,
  roomId: string,
  userId: string,
) {
  const conversationId = parseConversationIdFromRoom(roomId);
  const conversation = await ctx.db.get(conversationId);
  if (!conversation) {
    throw new ConvexError("Conversation not found");
  }

  if (userId.startsWith(AGENT_PREFIX)) {
    const { user, workspace } = await requireWorkspaceMember(ctx);
    if (conversation.workspaceId !== workspace._id) {
      throw new ConvexError("Conversation not found");
    }
    const expectedUserId = `${AGENT_PREFIX}${user.subject}`;
    if (userId !== expectedUserId) {
      throw new ConvexError("Forbidden: presence userId mismatch");
    }
    return {
      conversation,
      seedData: {
        role: "agent" as const,
        name: user.name,
        imageUrl: user.imageUrl ?? null,
        isTyping: false,
        updatedAt: Date.now(),
      },
    };
  }

  if (userId.startsWith(VISITOR_PREFIX)) {
    const visitorSessionId = userId.slice(VISITOR_PREFIX.length);
    if (!visitorSessionId || conversation.visitorSessionId !== visitorSessionId) {
      throw new ConvexError("Conversation not found");
    }
    return {
      conversation,
      seedData: {
        role: "visitor" as const,
        name: conversation.visitorName ?? "Visitor",
        imageUrl: null,
        isTyping: false,
        updatedAt: Date.now(),
      },
    };
  }

  throw new ConvexError("Invalid presence userId");
}

/**
 * Presence heartbeat compatible with `@convex-dev/presence/react`'s `usePresence`.
 * Authorizes both authenticated workspace agents (`agent:<clerkUserId>`) and
 * public widget visitors (`visitor:<visitorSessionId>`).
 */
export const heartbeat = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    interval: v.number(),
  },
  handler: async (ctx, { roomId, userId, sessionId, interval }) => {
    const { seedData } = await authorizeRoomHeartbeat(ctx, roomId, userId);
    const result = await presence.heartbeat(
      ctx,
      roomId,
      userId,
      sessionId,
      interval,
    );

    // Ensure room user metadata has role/name initialized without clobbering
    // an active typing state if already set.
    const existing = await presence.list(ctx, result.roomToken, 50);
    const current = existing.find((entry) => entry.userId === userId);
    if (!current?.data) {
      await presence.updateRoomUser(ctx, roomId, userId, seedData);
    }

    return result;
  },
});

/**
 * Lists presence state for all users in a room via its opaque `roomToken`.
 */
export const list = query({
  args: {
    roomToken: v.string(),
  },
  handler: async (ctx, { roomToken }) => {
    return await presence.list(ctx, roomToken);
  },
});

/**
 * Gracefully disconnects a presence session on tab unload (`sendBeacon`).
 */
export const disconnect = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, { sessionToken }) => {
    return await presence.disconnect(ctx, sessionToken);
  },
});

/**
 * Updates typing indicator state for an authenticated workspace agent in a
 * conversation room.
 */
export const setAgentTyping = mutation({
  args: {
    conversationId: v.id("conversations"),
    isTyping: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { user, workspace } = await requireWorkspaceMember(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.workspaceId !== workspace._id) {
      throw new ConvexError("Conversation not found");
    }

    await presence.updateRoomUser(
      ctx,
      conversationRoomId(args.conversationId),
      `${AGENT_PREFIX}${user.subject}`,
      {
        role: "agent",
        name: user.name,
        imageUrl: user.imageUrl ?? null,
        isTyping: args.isTyping,
        updatedAt: Date.now(),
      },
    );

    return null;
  },
});

/**
 * Updates typing indicator state for a public widget visitor in their
 * conversation room.
 */
export const setVisitorTyping = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    visitorSessionId: v.string(),
    isTyping: v.boolean(),
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

    await presence.updateRoomUser(
      ctx,
      conversationRoomId(args.conversationId),
      `${VISITOR_PREFIX}${args.visitorSessionId}`,
      {
        role: "visitor",
        name: conversation.visitorName ?? "Visitor",
        imageUrl: null,
        isTyping: args.isTyping,
        updatedAt: Date.now(),
      },
    );

    return null;
  },
});
