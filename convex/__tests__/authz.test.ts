import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = (
  import.meta as unknown as {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>;
  }
).glob("../**/*.ts");

function asOrgUser(params: {
  userId: string;
  orgId?: string;
  orgRole?: "org:admin" | "org:member";
  orgSlug?: string;
  name?: string;
  email?: string;
}) {
  return {
    tokenIdentifier: `https://clerk.example.com|${params.userId}`,
    subject: params.userId,
    name: params.name ?? "Test User",
    email: params.email ?? `${params.userId}@example.com`,
    ...(params.orgId ? { org_id: params.orgId } : {}),
    ...(params.orgRole ? { org_role: params.orgRole } : {}),
    ...(params.orgSlug ? { org_slug: params.orgSlug } : {}),
  };
}

describe("Multi-tenancy & RBAC authorization", () => {
  it("rejects unauthenticated callers", async () => {
    const t = convexTest(schema, modules);

    await expect(t.query(api.workspaces.getCurrentWorkspace, {})).rejects.toThrow(
      /Unauthenticated/,
    );
    await expect(
      t.mutation(api.workspaces.provisionWorkspace, { name: "No Auth" }),
    ).rejects.toThrow(/Unauthenticated/);
  });

  it("returns null for getCurrentWorkspace when user has no active organization", async () => {
    const t = convexTest(schema, modules);
    const authed = t.withIdentity(asOrgUser({ userId: "user_no_org" }));

    const result = await authed.query(api.workspaces.getCurrentWorkspace, {});
    expect(result).toBeNull();
  });

  it("isolates workspaces between Org A and Org B", async () => {
    const t = convexTest(schema, modules);

    const adminA = t.withIdentity(
      asOrgUser({
        userId: "user_a1",
        orgId: "org_a",
        orgRole: "org:admin",
        orgSlug: "acme-a",
      }),
    );
    const adminB = t.withIdentity(
      asOrgUser({
        userId: "user_b1",
        orgId: "org_b",
        orgRole: "org:admin",
        orgSlug: "beta-b",
      }),
    );

    const wsAId = await adminA.mutation(api.workspaces.provisionWorkspace, {
      name: "Acme A",
    });
    const wsBId = await adminB.mutation(api.workspaces.provisionWorkspace, {
      name: "Beta B",
    });

    expect(wsAId).not.toEqual(wsBId);

    // Provisioning again is idempotent
    const wsAIdAgain = await adminA.mutation(
      api.workspaces.provisionWorkspace,
      { name: "Acme A Renamed" },
    );
    expect(wsAIdAgain).toEqual(wsAId);

    const currentA = await adminA.query(api.workspaces.getCurrentWorkspace, {});
    const currentB = await adminB.query(api.workspaces.getCurrentWorkspace, {});

    expect(currentA?.workspace._id).toEqual(wsAId);
    expect(currentA?.workspace.name).toBe("Acme A");
    expect(currentB?.workspace._id).toEqual(wsBId);
    expect(currentB?.workspace.name).toBe("Beta B");

    // Updating Org A does not affect Org B
    await adminA.mutation(api.workspaces.updateWorkspaceSettings, {
      name: "Acme A Updated",
      aiModel: "anthropic/claude-3.5-sonnet",
    });

    const refreshedB = await adminB.query(
      api.workspaces.getCurrentWorkspace,
      {},
    );
    expect(refreshedB?.workspace.name).toBe("Beta B");
    expect(refreshedB?.workspace.aiModel).toBe("openai/gpt-4o-mini");
  });

  it("rejects org:member from admin-only mutations while allowing member reads", async () => {
    const t = convexTest(schema, modules);

    const admin = t.withIdentity(
      asOrgUser({
        userId: "user_admin",
        orgId: "org_rbac",
        orgRole: "org:admin",
        orgSlug: "rbac-org",
      }),
    );
    await admin.mutation(api.workspaces.provisionWorkspace, {
      name: "RBAC Org",
    });

    const member = t.withIdentity(
      asOrgUser({
        userId: "user_member",
        orgId: "org_rbac",
        orgRole: "org:member",
        orgSlug: "rbac-org",
      }),
    );

    // Member can read current workspace and assertMemberAccess
    const ws = await member.query(api.workspaces.getCurrentWorkspace, {});
    expect(ws?.role).toBe("org:member");
    expect(ws?.workspace.name).toBe("RBAC Org");

    const access = await member.query(api.workspaces.assertMemberAccess, {});
    expect(access.role).toBe("org:member");

    // Member is rejected from admin-only updateWorkspaceSettings
    await expect(
      member.mutation(api.workspaces.updateWorkspaceSettings, {
        name: "Hacked Name",
      }),
    ).rejects.toThrow(/Forbidden: admin role required/);
  });

  it("rejects org:member from provisioning a new workspace", async () => {
    const t = convexTest(schema, modules);
    const member = t.withIdentity(
      asOrgUser({
        userId: "user_member_only",
        orgId: "org_unprovisioned",
        orgRole: "org:member",
      }),
    );

    await expect(
      member.mutation(api.workspaces.provisionWorkspace, {
        name: "Unauthorized Org",
      }),
    ).rejects.toThrow(/Forbidden: admin role required/);
  });
});
