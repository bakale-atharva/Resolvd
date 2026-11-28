import { register as registerAgent } from "@convex-dev/agent/test";
import { register as registerAggregate } from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = (
  import.meta as unknown as {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>;
  }
).glob("../**/*.ts");

function asOrgAdmin(userId: string, orgId: string) {
  return {
    tokenIdentifier: `https://clerk.example.com|${userId}`,
    subject: userId,
    name: "Admin User",
    email: `${userId}@example.com`,
    org_id: orgId,
    org_role: "org:admin",
  };
}

describe("Public Widget & Help Center", () => {
  it("returns public widget config and isolates published vs draft articles", async () => {
    const t = convexTest(schema, modules);
    registerAgent(t, "agent");

    const admin = t.withIdentity(asOrgAdmin("admin_1", "org_widget_1"));
    const workspaceId = await admin.mutation(api.workspaces.provisionWorkspace, {
      name: "Acme Support",
    });

    const config = await t.query(api.widget.getPublicWidgetConfig, {
      workspaceId,
    });
    expect(config).not.toBeNull();
    expect(config?.workspaceName).toBe("Acme Support");
    expect(config?.primaryColor).toBe("#14532d");

    // Create 1 published and 1 draft article
    await admin.mutation(api.articles.createArticle, {
      title: "Published Guide",
      category: "Getting Started",
      contentMarkdown: "How to set up your workspace.",
      isPopular: true,
      isPublished: true,
    });
    await admin.mutation(api.articles.createArticle, {
      title: "Internal Draft",
      category: "Internal",
      contentMarkdown: "Secret draft notes.",
      isPopular: false,
      isPublished: false,
    });

    const publicArticles = await t.query(api.widget.searchPublicArticles, {
      workspaceId,
    });
    expect(publicArticles).toHaveLength(1);
    expect(publicArticles[0].title).toBe("Published Guide");

    const publishedDetail = await t.query(api.widget.getPublicArticle, {
      workspaceId,
      slug: "published-guide",
    });
    expect(publishedDetail?.title).toBe("Published Guide");

    const draftDetail = await t.query(api.widget.getPublicArticle, {
      workspaceId,
      slug: "internal-draft",
    });
    expect(draftDetail).toBeNull();
  });

  it("starts/resumes visitor sessions, captures leads, and scopes messages to visitorSessionId", async () => {
    const t = convexTest(schema, modules);
    registerAgent(t, "agent");
    registerAggregate(t, "conversationsByUnread");
    registerAggregate(t, "conversationsByAssignee");
    registerAggregate(t, "leadsByStatus");

    const admin = t.withIdentity(asOrgAdmin("admin_2", "org_widget_2"));
    const workspaceId = await admin.mutation(api.workspaces.provisionWorkspace, {
      name: "Beta Co",
    });

    const session1 = await t.mutation(api.widget.startOrResumeVisitorSession, {
      workspaceId,
      visitorSessionId: "visitor_abc",
    });
    expect(session1.mode).toBe("ai");
    expect(session1.status).toBe("open");
    expect(session1.hasLeadInfo).toBe(false);

    // Resuming returns the same conversation and thread
    const resumed = await t.mutation(api.widget.startOrResumeVisitorSession, {
      workspaceId,
      visitorSessionId: "visitor_abc",
    });
    expect(resumed.conversationId).toEqual(session1.conversationId);
    expect(resumed.threadId).toBe(session1.threadId);

    // Lead capture rejects wrong visitorSessionId
    await expect(
      t.mutation(api.widget.submitLeadCapture, {
        workspaceId,
        conversationId: session1.conversationId,
        visitorSessionId: "wrong_visitor",
        name: "Intruder",
      }),
    ).rejects.toThrow(/Conversation not found/);

    // Lead capture succeeds for matching visitorSessionId
    const leadId = await t.mutation(api.widget.submitLeadCapture, {
      workspaceId,
      conversationId: session1.conversationId,
      visitorSessionId: "visitor_abc",
      name: "Alex Rivera",
      email: "alex@beta.co",
    });
    expect(leadId).toBeDefined();

    // Thread citations query rejects wrong visitorSessionId
    await expect(
      t.query(api.widget.getWidgetThreadCitations, {
        workspaceId,
        threadId: session1.threadId,
        visitorSessionId: "wrong_visitor",
      }),
    ).rejects.toThrow(/Conversation not found/);
  });
});
