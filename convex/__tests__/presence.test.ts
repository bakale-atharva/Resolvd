import { register as registerAgent } from "@convex-dev/agent/test";
import { register as registerAggregate } from "@convex-dev/aggregate/test";
import { register as registerPresence } from "@convex-dev/presence/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = (
  import.meta as unknown as {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>;
  }
).glob("../**/*.ts");

function createTestHarness() {
  const t = convexTest(schema, modules);
  registerAgent(t, "agent");
  registerAggregate(t, "conversationsByUnread");
  registerAggregate(t, "conversationsByAssignee");
  registerAggregate(t, "leadsByStatus");
  registerPresence(t, "presence");
  return t;
}

function asOrgUser(
  userId: string,
  orgId: string,
  role: "org:admin" | "org:member" = "org:admin",
  name = "Team Member",
) {
  return {
    tokenIdentifier: `https://clerk.example.com|${userId}`,
    subject: userId,
    name,
    email: `${userId}@example.com`,
    org_id: orgId,
    org_role: role,
  };
}

describe("Live Presence & Typing Indicators (Phase 4B)", () => {
  it("tracks room presence and bidirectional typing indicators for agent and visitor", async () => {
    const t = createTestHarness();
    const agent = t.withIdentity(
      asOrgUser("agent_1", "org_pres_1", "org:admin", "Maya Support"),
    );

    const workspaceId = await agent.mutation(api.workspaces.provisionWorkspace, {
      name: "Presence Co",
    });

    const session = await t.mutation(api.widget.startOrResumeVisitorSession, {
      workspaceId,
      visitorSessionId: "vis_pres_1",
      visitorName: "Sam Visitor",
    });

    const roomId = `conv:${session.conversationId}`;

    // Both visitor and agent send heartbeats
    const visitorHb = await t.mutation(api.presence.heartbeat, {
      roomId,
      userId: "visitor:vis_pres_1",
      sessionId: "tab_vis_1",
      interval: 10_000,
    });
    await agent.mutation(api.presence.heartbeat, {
      roomId,
      userId: "agent:agent_1",
      sessionId: "tab_agent_1",
      interval: 10_000,
    });

    // Agent starts typing
    await agent.mutation(api.presence.setAgentTyping, {
      conversationId: session.conversationId,
      isTyping: true,
    });

    // Visitor starts typing
    await t.mutation(api.presence.setVisitorTyping, {
      workspaceId,
      conversationId: session.conversationId,
      visitorSessionId: "vis_pres_1",
      isTyping: true,
    });

    const roomUsers = await t.query(api.presence.list, {
      roomToken: visitorHb.roomToken,
    });

    expect(roomUsers).toHaveLength(2);
    const agentEntry = roomUsers.find((u) => u.userId === "agent:agent_1");
    const visitorEntry = roomUsers.find(
      (u) => u.userId === "visitor:vis_pres_1",
    );

    expect(agentEntry?.online).toBe(true);
    expect(agentEntry?.data).toMatchObject({
      role: "agent",
      name: "Maya Support",
      isTyping: true,
    });

    expect(visitorEntry?.online).toBe(true);
    expect(visitorEntry?.data).toMatchObject({
      role: "visitor",
      name: "Sam Visitor",
      isTyping: true,
    });

    // Agent stops typing
    await agent.mutation(api.presence.setAgentTyping, {
      conversationId: session.conversationId,
      isTyping: false,
    });

    const updatedUsers = await t.query(api.presence.list, {
      roomToken: visitorHb.roomToken,
    });
    const updatedAgent = updatedUsers.find((u) => u.userId === "agent:agent_1");
    expect(updatedAgent?.data).toMatchObject({ isTyping: false });
  });

  it("blocks cross-tenant and spoofed presence heartbeats and typing updates", async () => {
    const t = createTestHarness();
    const orgA = t.withIdentity(asOrgUser("admin_a", "org_pres_a"));
    const orgB = t.withIdentity(asOrgUser("admin_b", "org_pres_b"));

    const wsA = await orgA.mutation(api.workspaces.provisionWorkspace, {
      name: "Org A",
    });
    await orgB.mutation(api.workspaces.provisionWorkspace, {
      name: "Org B",
    });

    const sessionA = await t.mutation(api.widget.startOrResumeVisitorSession, {
      workspaceId: wsA,
      visitorSessionId: "vis_a",
    });

    const roomA = `conv:${sessionA.conversationId}`;

    // Org B cannot heartbeat into Org A's room
    await expect(
      orgB.mutation(api.presence.heartbeat, {
        roomId: roomA,
        userId: "agent:admin_b",
        sessionId: "tab_b",
        interval: 10_000,
      }),
    ).rejects.toThrow(/Conversation not found/);

    // Org B cannot set typing in Org A's conversation
    await expect(
      orgB.mutation(api.presence.setAgentTyping, {
        conversationId: sessionA.conversationId,
        isTyping: true,
      }),
    ).rejects.toThrow(/Conversation not found/);

    // Wrong visitorSessionId cannot heartbeat or set typing
    await expect(
      t.mutation(api.presence.heartbeat, {
        roomId: roomA,
        userId: "visitor:wrong_vis",
        sessionId: "tab_wrong",
        interval: 10_000,
      }),
    ).rejects.toThrow(/Conversation not found/);

    await expect(
      t.mutation(api.presence.setVisitorTyping, {
        workspaceId: wsA,
        conversationId: sessionA.conversationId,
        visitorSessionId: "wrong_vis",
        isTyping: true,
      }),
    ).rejects.toThrow(/Conversation not found/);
  });
});
