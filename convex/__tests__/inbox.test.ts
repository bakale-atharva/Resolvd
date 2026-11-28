import { register as registerAgent } from "@convex-dev/agent/test";
import { register as registerAggregate } from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
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

describe("Shared Team Inbox (Phase 4A)", () => {
  it("tracks live aggregate counts and supports filtering, assignment, status, and human takeover", async () => {
    const t = createTestHarness();

    const admin = t.withIdentity(asOrgUser("user_admin", "org_inbox_1", "org:admin", "Alice Admin"));
    const member = t.withIdentity(asOrgUser("user_member", "org_inbox_1", "org:member", "Bob Agent"));

    const workspaceId = await admin.mutation(api.workspaces.provisionWorkspace, {
      name: "Inbox Corp",
    });

    await t.mutation(internal.memberships.upsertMembershipFromWebhook, {
      clerkOrgId: "org_inbox_1",
      clerkUserId: "user_member",
      email: "user_member@example.com",
      name: "Bob Agent",
      role: "org:member",
    });

    // Initial counts are zero
    const emptyCounts = await admin.query(api.inbox.getInboxCounts, {});
    expect(emptyCounts).toEqual({
      all: 0,
      unread: 0,
      unassigned: 0,
      mine: 0,
      newLeads: 0,
    });

    // Visitor 1 starts a session with lead info and sends a message
    const session1 = await t.mutation(api.widget.startOrResumeVisitorSession, {
      workspaceId,
      visitorSessionId: "visitor_1",
      visitorName: "Clara Visitor",
      visitorEmail: "clara@example.com",
    });
    await t.mutation(api.widget.sendVisitorMessage, {
      workspaceId,
      conversationId: session1.conversationId,
      visitorSessionId: "visitor_1",
      message: "Hello, I need help with billing.",
    });

    // Visitor 2 starts a session without lead info (no unread message yet)
    const session2 = await t.mutation(api.widget.startOrResumeVisitorSession, {
      workspaceId,
      visitorSessionId: "visitor_2",
    });

    const afterMessages = await admin.query(api.inbox.getInboxCounts, {});
    expect(afterMessages).toEqual({
      all: 2,
      unread: 1,
      unassigned: 2,
      mine: 0,
      newLeads: 1,
    });

    // Filter: unread
    const unreadPage = await admin.query(api.inbox.listConversations, {
      filter: "unread",
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(unreadPage.page).toHaveLength(1);
    expect(unreadPage.page[0]._id).toEqual(session1.conversationId);

    // Mark as read
    await member.mutation(api.inbox.markAsRead, {
      conversationId: session1.conversationId,
    });
    const afterRead = await member.query(api.inbox.getInboxCounts, {});
    expect(afterRead.unread).toBe(0);

    // Assign conversation 1 to Bob Agent (user_member)
    await admin.mutation(api.inbox.assignConversation, {
      conversationId: session1.conversationId,
      assignedToUserId: "user_member",
    });

    const memberCounts = await member.query(api.inbox.getInboxCounts, {});
    expect(memberCounts.unassigned).toBe(1);
    expect(memberCounts.mine).toBe(1);

    const minePage = await member.query(api.inbox.listConversations, {
      filter: "mine",
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(minePage.page).toHaveLength(1);
    expect(minePage.page[0]._id).toEqual(session1.conversationId);

    // Human takeover + agent reply on conversation 2 (auto-assigns to Bob)
    await member.mutation(api.inbox.toggleAiTakeover, {
      conversationId: session2.conversationId,
      mode: "human",
    });
    const reply = await member.mutation(api.inbox.sendAgentReply, {
      conversationId: session2.conversationId,
      body: "Hi there! Bob here, how can I help?",
    });
    expect(reply.messageId).toBeDefined();

    const detail2 = await member.query(api.inbox.getConversationDetail, {
      conversationId: session2.conversationId,
    });
    expect(detail2.conversation.mode).toBe("human");
    expect(detail2.conversation.assignedToUserId).toBe("user_member");
    expect(detail2.conversation.lastMessagePreview).toBe(
      "Hi there! Bob here, how can I help?",
    );

    // Close conversation 2 and filter by closed
    await member.mutation(api.inbox.updateConversationStatus, {
      conversationId: session2.conversationId,
      status: "closed",
    });
    const closedPage = await admin.query(api.inbox.listConversations, {
      status: "closed",
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(closedPage.page).toHaveLength(1);
    expect(closedPage.page[0]._id).toEqual(session2.conversationId);
  });

  it("enforces strict cross-tenant isolation on all inbox queries and mutations", async () => {
    const t = createTestHarness();

    const orgA = t.withIdentity(asOrgUser("admin_a", "org_a"));
    const orgB = t.withIdentity(asOrgUser("admin_b", "org_b"));

    const wsA = await orgA.mutation(api.workspaces.provisionWorkspace, {
      name: "Org A",
    });
    await orgB.mutation(api.workspaces.provisionWorkspace, {
      name: "Org B",
    });

    const sessionA = await t.mutation(api.widget.startOrResumeVisitorSession, {
      workspaceId: wsA,
      visitorSessionId: "visitor_org_a",
    });

    await expect(
      orgB.query(api.inbox.getConversationDetail, {
        conversationId: sessionA.conversationId,
      }),
    ).rejects.toThrow(/Conversation not found/);

    await expect(
      orgB.mutation(api.inbox.markAsRead, {
        conversationId: sessionA.conversationId,
      }),
    ).rejects.toThrow(/Conversation not found/);

    await expect(
      orgB.mutation(api.inbox.assignConversation, {
        conversationId: sessionA.conversationId,
        assignedToUserId: "admin_b",
      }),
    ).rejects.toThrow(/Conversation not found/);

    await expect(
      orgB.mutation(api.inbox.updateConversationStatus, {
        conversationId: sessionA.conversationId,
        status: "closed",
      }),
    ).rejects.toThrow(/Conversation not found/);

    await expect(
      orgB.mutation(api.inbox.toggleAiTakeover, {
        conversationId: sessionA.conversationId,
        mode: "human",
      }),
    ).rejects.toThrow(/Conversation not found/);

    await expect(
      orgB.mutation(api.inbox.sendAgentReply, {
        conversationId: sessionA.conversationId,
        body: "Unauthorized reply",
      }),
    ).rejects.toThrow(/Conversation not found/);
  });
});
