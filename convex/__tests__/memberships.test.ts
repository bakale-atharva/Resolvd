import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";

const modules = (
  import.meta as unknown as {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>;
  }
).glob("../**/*.ts");

describe("Membership webhook sync & tenant isolation", () => {
  it("syncs organization and membership lifecycle via internal webhook mutations", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internal.workspaces.upsertWorkspaceFromWebhook, {
      clerkOrgId: "org_sync_1",
      name: "Sync Corp",
      slug: "sync-corp",
    });

    await t.mutation(internal.memberships.upsertMembershipFromWebhook, {
      clerkOrgId: "org_sync_1",
      clerkUserId: "user_1",
      email: "alice@synccorp.com",
      name: "Alice Admin",
      role: "org:admin",
    });

    await t.mutation(internal.memberships.upsertMembershipFromWebhook, {
      clerkOrgId: "org_sync_1",
      clerkUserId: "user_2",
      email: "bob@synccorp.com",
      name: "Bob Member",
      role: "org:member",
    });

    const alice = t.withIdentity({
      tokenIdentifier: "https://clerk.example.com|user_1",
      subject: "user_1",
      org_id: "org_sync_1",
      org_role: "org:admin",
    });

    const members = await alice.query(
      api.memberships.listWorkspaceMembers,
      {},
    );
    expect(members).toHaveLength(2);
    expect(members.map((m) => m.email).sort()).toEqual([
      "alice@synccorp.com",
      "bob@synccorp.com",
    ]);

    // Update role via webhook
    await t.mutation(internal.memberships.upsertMembershipFromWebhook, {
      clerkOrgId: "org_sync_1",
      clerkUserId: "user_2",
      email: "bob@synccorp.com",
      name: "Bob Promoted",
      role: "org:admin",
    });

    const afterPromote = await alice.query(
      api.memberships.listWorkspaceMembers,
      {},
    );
    const bob = afterPromote.find((m) => m.clerkUserId === "user_2");
    expect(bob?.role).toBe("org:admin");
    expect(bob?.name).toBe("Bob Promoted");

    // Delete membership via webhook
    await t.mutation(internal.memberships.removeMembershipFromWebhook, {
      clerkOrgId: "org_sync_1",
      clerkUserId: "user_2",
    });

    const afterDelete = await alice.query(
      api.memberships.listWorkspaceMembers,
      {},
    );
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0]?.clerkUserId).toBe("user_1");
  });

  it("prevents Org B from listing Org A members", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internal.workspaces.upsertWorkspaceFromWebhook, {
      clerkOrgId: "org_alpha",
      name: "Alpha",
      slug: "alpha",
    });
    await t.mutation(internal.workspaces.upsertWorkspaceFromWebhook, {
      clerkOrgId: "org_beta",
      name: "Beta",
      slug: "beta",
    });

    await t.mutation(internal.memberships.upsertMembershipFromWebhook, {
      clerkOrgId: "org_alpha",
      clerkUserId: "user_alpha",
      email: "alpha@example.com",
      name: "Alpha User",
      role: "org:admin",
    });
    await t.mutation(internal.memberships.upsertMembershipFromWebhook, {
      clerkOrgId: "org_beta",
      clerkUserId: "user_beta",
      email: "beta@example.com",
      name: "Beta User",
      role: "org:admin",
    });

    const betaUser = t.withIdentity({
      tokenIdentifier: "https://clerk.example.com|user_beta",
      subject: "user_beta",
      org_id: "org_beta",
      org_role: "org:admin",
    });

    const betaMembers = await betaUser.query(
      api.memberships.listWorkspaceMembers,
      {},
    );
    expect(betaMembers).toHaveLength(1);
    expect(betaMembers[0]?.email).toBe("beta@example.com");
  });
});
