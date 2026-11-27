import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import { validateCrawlUrl } from "../lib/ssrf";
import schema from "../schema";

const modules = (
  import.meta as unknown as {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>;
  }
).glob("../**/*.ts");

function asOrgUser(params: {
  userId: string;
  orgId: string;
  orgRole: "org:admin" | "org:member";
  orgSlug?: string;
}) {
  return {
    tokenIdentifier: `https://clerk.example.com|${params.userId}`,
    subject: params.userId,
    name: "Test User",
    email: `${params.userId}@example.com`,
    org_id: params.orgId,
    org_role: params.orgRole,
    ...(params.orgSlug ? { org_slug: params.orgSlug } : {}),
  };
}

describe("Knowledge Base CRUD, RBAC & Tenant Isolation", () => {
  it("creates, updates, lists, and deletes articles with strict tenant isolation", async () => {
    const t = convexTest(schema, modules);

    const adminA = t.withIdentity(
      asOrgUser({ userId: "admin_a", orgId: "org_a", orgRole: "org:admin" }),
    );
    const adminB = t.withIdentity(
      asOrgUser({ userId: "admin_b", orgId: "org_b", orgRole: "org:admin" }),
    );
    const memberA = t.withIdentity(
      asOrgUser({ userId: "member_a", orgId: "org_a", orgRole: "org:member" }),
    );

    await adminA.mutation(api.workspaces.provisionWorkspace, { name: "Org A" });
    await adminB.mutation(api.workspaces.provisionWorkspace, { name: "Org B" });

    // Create article in Org A (unpublished to avoid scheduling external embedding action in test)
    const articleId = await adminA.mutation(api.articles.createArticle, {
      title: "Getting Started Guide",
      category: "Onboarding",
      contentMarkdown: "## Welcome\nHere is how to get started.",
      isPopular: true,
      isPublished: false,
    });

    // Org A admin and member can list & read by slug
    const listA = await adminA.query(api.articles.listArticles, {});
    expect(listA).toHaveLength(1);
    expect(listA[0].slug).toBe("getting-started-guide");

    const memberListA = await memberA.query(api.articles.listArticles, {});
    expect(memberListA).toHaveLength(1);

    const bySlugA = await memberA.query(api.articles.getArticleBySlug, {
      slug: "getting-started-guide",
    });
    expect(bySlugA?.title).toBe("Getting Started Guide");

    // Org B cannot see Org A's articles
    const listB = await adminB.query(api.articles.listArticles, {});
    expect(listB).toHaveLength(0);

    const bySlugB = await adminB.query(api.articles.getArticleBySlug, {
      slug: "getting-started-guide",
    });
    expect(bySlugB).toBeNull();

    // Org B cannot update or delete Org A's article
    await expect(
      adminB.mutation(api.articles.updateArticle, {
        articleId,
        title: "Hijacked",
        category: "Hacked",
        contentMarkdown: "Nope",
        isPopular: false,
        isPublished: false,
      }),
    ).rejects.toThrow(/not found/i);

    await expect(
      adminB.mutation(api.articles.deleteArticle, { articleId }),
    ).rejects.toThrow(/not found/i);

    // Org A member cannot create, update, or delete articles
    await expect(
      memberA.mutation(api.articles.createArticle, {
        title: "Unauthorized",
        category: "General",
        contentMarkdown: "Blocked",
        isPopular: false,
        isPublished: false,
      }),
    ).rejects.toThrow(/admin role required/i);

    await expect(
      memberA.mutation(api.articles.deleteArticle, { articleId }),
    ).rejects.toThrow(/admin role required/i);

    // Org A admin can update & delete
    await adminA.mutation(api.articles.updateArticle, {
      articleId,
      title: "Updated Getting Started",
      slug: "updated-start",
      category: "Onboarding",
      contentMarkdown: "Updated body",
      isPopular: false,
      isPublished: false,
    });

    const updated = await adminA.query(api.articles.getArticleBySlug, {
      slug: "updated-start",
    });
    expect(updated?.title).toBe("Updated Getting Started");

    await adminA.mutation(api.articles.deleteArticle, { articleId });
    const afterDelete = await adminA.query(api.articles.listArticles, {});
    expect(afterDelete).toHaveLength(0);
  });

  it("enforces admin role on website crawl and rejects SSRF URLs", async () => {
    const t = convexTest(schema, modules);

    const adminA = t.withIdentity(
      asOrgUser({ userId: "admin_a", orgId: "org_a", orgRole: "org:admin" }),
    );
    const memberA = t.withIdentity(
      asOrgUser({ userId: "member_a", orgId: "org_a", orgRole: "org:member" }),
    );

    await adminA.mutation(api.workspaces.provisionWorkspace, { name: "Org A" });

    // Member rejected from starting a crawl
    await expect(
      memberA.mutation(api.crawler.startWebsiteCrawl, {
        url: "https://docs.example.com",
      }),
    ).rejects.toThrow(/admin role required/i);

    // Admin rejected on SSRF URLs
    const ssrfUrls = [
      "http://localhost:3000",
      "http://127.0.0.1/admin",
      "http://169.254.169.254/latest/meta-data",
      "http://10.0.0.1/internal",
      "http://172.16.0.5/secret",
      "http://192.168.1.1",
      "http://[::1]:8080",
      "file:///etc/passwd",
      "ftp://example.com/file",
      "http://2130706433/",
    ];

    for (const badUrl of ssrfUrls) {
      expect(() => validateCrawlUrl(badUrl)).toThrow();
      await expect(
        adminA.mutation(api.crawler.startWebsiteCrawl, { url: badUrl }),
      ).rejects.toThrow();
    }

    // Valid public URL passes validateCrawlUrl
    const valid = validateCrawlUrl("https://docs.example.com/guides#intro");
    expect(valid.toString()).toBe("https://docs.example.com/guides");
  });
});
