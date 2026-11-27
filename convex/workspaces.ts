import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  requireIdentity,
  requireWorkspaceAdmin,
  requireWorkspaceMember,
} from "./lib/auth";

const DEFAULT_AI_MODEL = "openrouter/free";

export function isFreeOpenRouterModel(modelId: string): boolean {
  return modelId === "openrouter/free" || modelId.endsWith(":free");
}

async function insertDefaultWidgetConfig(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  workspaceName: string,
  now: number,
) {
  await ctx.db.insert("widgetConfigs", {
    workspaceId,
    primaryColor: "#14532d",
    backgroundColor: "#ffffff",
    textColor: "#111827",
    borderRadius: 16,
    marginBottom: 20,
    marginSide: 20,
    position: "bottom-right",
    title: `${workspaceName} Support`,
    subtitle: "Ask us anything or browse help articles.",
    soundEnabled: true,
    proactiveEnabled: false,
    proactiveDelaySeconds: 8,
    proactiveMessage: "Need a hand? Ask our team or AI assistant.",
    leadGateEnabled: false,
    leadGateFields: {
      name: true,
      email: true,
      phone: false,
    },
    faqs: [],
    hideBranding: false,
    updatedAt: now,
  });
}

function sanitizeSlug(input: string, fallback: string): string {
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Provisions a Convex workspace for the caller's active Clerk organization.
 * Idempotent: returns the existing workspace ID if already provisioned.
 */
export const provisionWorkspace = mutation({
  args: {
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireIdentity(ctx);
    if (!user.orgId) {
      throw new ConvexError("No active organization selected");
    }

    const clerkOrgId = user.orgId;
    const now = Date.now();

    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", clerkOrgId))
      .unique();

    let workspaceId: Id<"workspaces">;

    if (existing) {
      workspaceId = existing._id;
    } else {
      if (user.orgRole && user.orgRole !== "org:admin") {
        throw new ConvexError("Forbidden: admin role required to provision");
      }

      const name = args.name?.trim() || user.orgSlug || "My Workspace";
      const slug = sanitizeSlug(
        args.slug ?? user.orgSlug ?? name,
        clerkOrgId.toLowerCase(),
      );

      workspaceId = await ctx.db.insert("workspaces", {
        clerkOrgId,
        name,
        slug,
        planTier: "free",
        subscriptionStatus: "active",
        aiModel: DEFAULT_AI_MODEL,
        createdAt: now,
        updatedAt: now,
      });

      await insertDefaultWidgetConfig(ctx, workspaceId, name, now);
    }

    const existingMembership = await ctx.db
      .query("memberships")
      .withIndex("by_workspaceId_and_clerkUserId", (q) =>
        q.eq("workspaceId", workspaceId).eq("clerkUserId", user.subject),
      )
      .unique();

    if (!existingMembership) {
      await ctx.db.insert("memberships", {
        workspaceId,
        clerkUserId: user.subject,
        tokenIdentifier: user.tokenIdentifier,
        email: user.email,
        name: user.name,
        imageUrl: user.imageUrl,
        role: user.orgRole ?? "org:admin",
        createdAt: now,
        updatedAt: now,
      });
    }

    return workspaceId;
  },
});

/**
 * Returns the caller's active workspace, effective role, and synced membership
 * record, or `null` if no organization is active or not yet provisioned.
 */
export const getCurrentWorkspace = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireIdentity(ctx);
    if (!user.orgId) {
      return null;
    }

    const orgId = user.orgId;
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", orgId))
      .unique();

    if (!workspace) {
      return null;
    }

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_workspaceId_and_clerkUserId", (q) =>
        q.eq("workspaceId", workspace._id).eq("clerkUserId", user.subject),
      )
      .unique();

    const role = user.orgRole ?? membership?.role ?? null;
    if (!role) {
      return null;
    }

    return {
      workspace,
      role,
      membership,
    };
  },
});

/**
 * Updates workspace-level settings (name, AI model, system prompt).
 * Restricted to `org:admin`.
 */
export const updateWorkspaceSettings = mutation({
  args: {
    name: v.optional(v.string()),
    aiModel: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceAdmin(ctx);

    const patch: {
      name?: string;
      aiModel?: string;
      systemPrompt?: string;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      const trimmed = args.name.trim();
      if (!trimmed) {
        throw new ConvexError("Workspace name cannot be empty");
      }
      patch.name = trimmed;
    }

    if (args.aiModel !== undefined) {
      const trimmed = args.aiModel.trim();
      if (!trimmed) {
        throw new ConvexError("AI model cannot be empty");
      }
      if (!isFreeOpenRouterModel(trimmed)) {
        throw new ConvexError(
          "Only free OpenRouter models (openrouter/free or *:free) are allowed",
        );
      }
      patch.aiModel = trimmed;
    }

    if (args.systemPrompt !== undefined) {
      patch.systemPrompt = args.systemPrompt;
    }

    await ctx.db.patch(workspace._id, patch);
    return await ctx.db.get(workspace._id);
  },
});

/**
 * Returns the active workspace if the caller is a member. Useful for testing
 * strict tenant isolation across organizations.
 */
export const assertMemberAccess = query({
  args: {},
  handler: async (ctx) => {
    const { workspace, role } = await requireWorkspaceMember(ctx);
    return { workspaceId: workspace._id, role };
  },
});

/**
 * Internal webhook mutation to create or update a workspace from Clerk
 * `organization.created` / `organization.updated` events.
 */
export const upsertWorkspaceFromWebhook = internalMutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();

    const slug = sanitizeSlug(args.slug, args.clerkOrgId.toLowerCase());

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        slug,
        updatedAt: now,
      });
      return existing._id;
    }

    const workspaceId = await ctx.db.insert("workspaces", {
      clerkOrgId: args.clerkOrgId,
      name: args.name,
      slug,
      planTier: "free",
      subscriptionStatus: "active",
      aiModel: DEFAULT_AI_MODEL,
      createdAt: now,
      updatedAt: now,
    });

    await insertDefaultWidgetConfig(ctx, workspaceId, args.name, now);
    return workspaceId;
  },
});
