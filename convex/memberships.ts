import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requireWorkspaceMember } from "./lib/auth";
import { roleValidator } from "./schema";

/**
 * Lists up to 100 members of the caller's active workspace.
 * Scoped strictly to the workspace derived from the caller's JWT.
 */
export const listWorkspaceMembers = query({
  args: {},
  handler: async (ctx) => {
    const { workspace } = await requireWorkspaceMember(ctx);

    const rows = await ctx.db
      .query("memberships")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspace._id))
      .take(100);

    return rows.map((row) => ({
      _id: row._id,
      clerkUserId: row.clerkUserId,
      email: row.email,
      name: row.name,
      imageUrl: row.imageUrl ?? null,
      role: row.role,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  },
});

/**
 * Internal mutation called by the Clerk webhook handler when an
 * `organizationMembership.created` or `organizationMembership.updated` event arrives.
 */
export const upsertMembershipFromWebhook = internalMutation({
  args: {
    clerkOrgId: v.string(),
    orgName: v.optional(v.string()),
    orgSlug: v.optional(v.string()),
    clerkUserId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    role: roleValidator,
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();

    if (!workspace) {
      const name = args.orgName?.trim() || "My Workspace";
      const slug =
        args.orgSlug?.trim().toLowerCase() || args.clerkOrgId.toLowerCase();
      const workspaceId = await ctx.db.insert("workspaces", {
        clerkOrgId: args.clerkOrgId,
        name,
        slug,
        planTier: "free",
        subscriptionStatus: "active",
        aiModel: "openrouter/free",
        createdAt: now,
        updatedAt: now,
      });
      workspace = await ctx.db.get(workspaceId);
      if (!workspace) return null;
    }

    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_workspaceId_and_clerkUserId", (q) =>
        q
          .eq("workspaceId", workspace._id)
          .eq("clerkUserId", args.clerkUserId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        imageUrl: args.imageUrl,
        role: args.role,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("memberships", {
      workspaceId: workspace._id,
      clerkUserId: args.clerkUserId,
      email: args.email,
      name: args.name,
      imageUrl: args.imageUrl,
      role: args.role,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Internal mutation called by the Clerk webhook handler when an
 * `organizationMembership.deleted` event arrives.
 */
export const removeMembershipFromWebhook = internalMutation({
  args: {
    clerkOrgId: v.string(),
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();

    if (!workspace) {
      return null;
    }

    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_workspaceId_and_clerkUserId", (q) =>
        q
          .eq("workspaceId", workspace._id)
          .eq("clerkUserId", args.clerkUserId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return null;
  },
});
