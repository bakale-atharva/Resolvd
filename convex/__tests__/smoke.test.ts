import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../schema";

const modules = (
  import.meta as unknown as {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>;
  }
).glob("../**/*.ts");

describe("Resolvd schema smoke test", () => {
  it("initializes convex-test with schema", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run(async (ctx) => {
      return await ctx.db.insert("workspaces", {
        clerkOrgId: "org_smoke_123",
        name: "Acme Smoke",
        slug: "acme-smoke",
        planTier: "free",
        subscriptionStatus: "active",
        aiModel: "openai/gpt-4o-mini",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
    expect(id).toBeTruthy();
  });
});
