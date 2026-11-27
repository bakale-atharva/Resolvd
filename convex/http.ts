import { httpRouter } from "convex/server";
import { Webhook } from "svix";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

type ClerkWebhookEvent = {
  type?: unknown;
  data?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizeWebhookRole(raw: unknown): "org:admin" | "org:member" {
  return raw === "org:admin" || raw === "admin" ? "org:admin" : "org:member";
}

http.route({
  path: "/clerk-webhooks",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return new Response("Missing CLERK_WEBHOOK_SECRET", { status: 500 });
    }

    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing svix headers", { status: 400 });
    }

    const payload = await req.text();
    let event: ClerkWebhookEvent;

    try {
      const wh = new Webhook(webhookSecret);
      event = wh.verify(payload, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as unknown as ClerkWebhookEvent;
    } catch {
      return new Response("Invalid webhook signature", { status: 400 });
    }

    const eventType = asString(event.type);
    const data = asRecord(event.data);
    if (!eventType || !data) {
      return new Response("Invalid webhook payload", { status: 400 });
    }

    if (
      eventType === "organization.created" ||
      eventType === "organization.updated"
    ) {
      const clerkOrgId = asString(data.id);
      const name = asString(data.name) ?? "Workspace";
      const slug = asString(data.slug) ?? clerkOrgId ?? "workspace";

      if (!clerkOrgId) {
        return new Response("Missing organization id", { status: 400 });
      }

      await ctx.runMutation(internal.workspaces.upsertWorkspaceFromWebhook, {
        clerkOrgId,
        name,
        slug,
      });
    } else if (
      eventType === "organizationMembership.created" ||
      eventType === "organizationMembership.updated"
    ) {
      const org = asRecord(data.organization);
      const publicUser = asRecord(data.public_user_data);

      const clerkOrgId = asString(org?.id);
      const clerkUserId = asString(publicUser?.user_id);

      if (!clerkOrgId || !clerkUserId) {
        return new Response("Missing membership identifiers", { status: 400 });
      }

      const firstName = asString(publicUser?.first_name) ?? "";
      const lastName = asString(publicUser?.last_name) ?? "";
      const fullName = `${firstName} ${lastName}`.trim();
      const email = asString(publicUser?.identifier) ?? "";
      const imageUrl = asString(publicUser?.image_url);

      await ctx.runMutation(internal.memberships.upsertMembershipFromWebhook, {
        clerkOrgId,
        orgName: asString(org?.name),
        orgSlug: asString(org?.slug),
        clerkUserId,
        email,
        name: fullName || email || "Team Member",
        imageUrl,
        role: normalizeWebhookRole(data.role),
      });
    } else if (eventType === "organizationMembership.deleted") {
      const org = asRecord(data.organization);
      const publicUser = asRecord(data.public_user_data);

      const clerkOrgId = asString(org?.id);
      const clerkUserId = asString(publicUser?.user_id);

      if (!clerkOrgId || !clerkUserId) {
        return new Response("Missing membership identifiers", { status: 400 });
      }

      await ctx.runMutation(internal.memberships.removeMembershipFromWebhook, {
        clerkOrgId,
        clerkUserId,
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
