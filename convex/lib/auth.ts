import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

export type WorkspaceRole = "org:admin" | "org:member";

export interface AuthenticatedUser {
  tokenIdentifier: string;
  subject: string;
  email: string;
  name: string;
  imageUrl?: string;
  orgId?: string;
  orgRole?: WorkspaceRole;
  orgSlug?: string;
}

export interface WorkspaceMemberContext {
  user: AuthenticatedUser;
  workspace: Doc<"workspaces">;
  role: WorkspaceRole;
  membership: Doc<"memberships"> | null;
}

type ClerkOrgClaim = {
  id?: unknown;
  rol?: unknown;
  slg?: unknown;
};

function normalizeRole(rawRole: unknown): WorkspaceRole | undefined {
  if (typeof rawRole !== "string") return undefined;
  if (rawRole === "org:admin" || rawRole === "admin") return "org:admin";
  if (
    rawRole === "org:member" ||
    rawRole === "member" ||
    rawRole === "basic_member"
  ) {
    return "org:member";
  }
  return undefined;
}

function readStringClaim(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Requires an authenticated Convex user identity and extracts normalized Clerk
 * user and organization claims from the JWT.
 */
export async function requireIdentity(
  ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<AuthenticatedUser> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Unauthenticated");
  }

  const raw = identity as unknown as Record<string, unknown>;
  const nestedOrg =
    typeof raw.o === "object" && raw.o !== null
      ? (raw.o as ClerkOrgClaim)
      : undefined;

  const orgId =
    readStringClaim(raw, "org_id") ??
    (typeof nestedOrg?.id === "string" ? nestedOrg.id : undefined);

  const orgRole =
    normalizeRole(raw.org_role) ?? normalizeRole(nestedOrg?.rol);

  const orgSlug =
    readStringClaim(raw, "org_slug") ??
    (typeof nestedOrg?.slg === "string" ? nestedOrg.slg : undefined);

  return {
    tokenIdentifier: identity.tokenIdentifier,
    subject: identity.subject,
    email: identity.email ?? "",
    name: identity.name ?? identity.email ?? "Team Member",
    imageUrl: identity.pictureUrl,
    orgId,
    orgRole,
    orgSlug,
  };
}

/**
 * Ensures the caller is authenticated, has an active Clerk organization in
 * their JWT, and that the organization is provisioned as a Convex workspace.
 */
export async function requireWorkspaceMember(
  ctx: QueryCtx | MutationCtx,
): Promise<WorkspaceMemberContext> {
  const user = await requireIdentity(ctx);
  if (!user.orgId) {
    throw new ConvexError("No active organization selected");
  }

  const orgId = user.orgId;
  const workspace = await ctx.db
    .query("workspaces")
    .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", orgId))
    .unique();

  if (!workspace) {
    throw new ConvexError("Workspace not provisioned");
  }

  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_workspaceId_and_clerkUserId", (q) =>
      q.eq("workspaceId", workspace._id).eq("clerkUserId", user.subject),
    )
    .unique();

  const role = user.orgRole ?? membership?.role;
  if (!role) {
    throw new ConvexError("Forbidden: workspace membership required");
  }

  return {
    user,
    workspace,
    role,
    membership,
  };
}

/**
 * Ensures the caller is an `org:admin` of the active provisioned workspace.
 */
export async function requireWorkspaceAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<WorkspaceMemberContext> {
  const memberCtx = await requireWorkspaceMember(ctx);
  if (memberCtx.role !== "org:admin") {
    throw new ConvexError("Forbidden: admin role required");
  }
  return memberCtx;
}
