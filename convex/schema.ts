import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const planTierValidator = v.union(
  v.literal("free"),
  v.literal("pro"),
  v.literal("scale"),
);

export const roleValidator = v.union(
  v.literal("org:admin"),
  v.literal("org:member"),
);

export default defineSchema({
  workspaces: defineTable({
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    planTier: planTierValidator,
    subscriptionStatus: v.union(
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("trialing"),
    ),
    aiModel: v.string(),
    systemPrompt: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerkOrgId", ["clerkOrgId"])
    .index("by_slug", ["slug"]),

  memberships: defineTable({
    workspaceId: v.id("workspaces"),
    clerkUserId: v.string(),
    tokenIdentifier: v.optional(v.string()),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    role: roleValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_workspaceId_and_clerkUserId", ["workspaceId", "clerkUserId"]),

  widgetConfigs: defineTable({
    workspaceId: v.id("workspaces"),
    primaryColor: v.string(),
    backgroundColor: v.string(),
    textColor: v.string(),
    borderRadius: v.number(),
    marginBottom: v.number(),
    marginSide: v.number(),
    position: v.union(v.literal("bottom-right"), v.literal("bottom-left")),
    title: v.string(),
    subtitle: v.string(),
    logoStorageId: v.optional(v.id("_storage")),
    soundEnabled: v.boolean(),
    proactiveEnabled: v.boolean(),
    proactiveDelaySeconds: v.number(),
    proactiveMessage: v.string(),
    leadGateEnabled: v.boolean(),
    leadGateFields: v.object({
      name: v.boolean(),
      email: v.boolean(),
      phone: v.boolean(),
    }),
    faqs: v.array(
      v.object({
        question: v.string(),
        answer: v.optional(v.string()),
      }),
    ),
    hideBranding: v.boolean(),
    updatedAt: v.number(),
  }).index("by_workspaceId", ["workspaceId"]),

  conversations: defineTable({
    workspaceId: v.id("workspaces"),
    threadId: v.string(),
    visitorSessionId: v.string(),
    visitorName: v.optional(v.string()),
    visitorEmail: v.optional(v.string()),
    visitorPhone: v.optional(v.string()),
    leadId: v.optional(v.id("leads")),
    status: v.union(v.literal("open"), v.literal("closed")),
    mode: v.union(v.literal("ai"), v.literal("human")),
    assignedToUserId: v.optional(v.string()),
    unreadCount: v.number(),
    lastMessagePreview: v.optional(v.string()),
    lastMessageAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_workspaceId_and_lastMessageAt", ["workspaceId", "lastMessageAt"])
    .index("by_workspaceId_and_status_and_lastMessageAt", [
      "workspaceId",
      "status",
      "lastMessageAt",
    ])
    .index("by_workspaceId_and_assignedToUserId", [
      "workspaceId",
      "assignedToUserId",
    ])
    .index("by_workspaceId_and_visitorSessionId", [
      "workspaceId",
      "visitorSessionId",
    ])
    .index("by_threadId", ["threadId"]),

  leads: defineTable({
    workspaceId: v.id("workspaces"),
    conversationId: v.optional(v.id("conversations")),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    source: v.union(
      v.literal("widget_gate"),
      v.literal("chat"),
      v.literal("proactive"),
    ),
    status: v.union(
      v.literal("new"),
      v.literal("contacted"),
      v.literal("closed"),
    ),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"])
    .index("by_workspaceId_and_status_and_createdAt", [
      "workspaceId",
      "status",
      "createdAt",
    ])
    .index("by_workspaceId_and_email", ["workspaceId", "email"])
    .searchIndex("search_leads", {
      searchField: "email",
      filterFields: ["workspaceId", "status", "source"],
    }),

  articles: defineTable({
    workspaceId: v.id("workspaces"),
    title: v.string(),
    slug: v.string(),
    category: v.string(),
    contentMarkdown: v.string(),
    coverStorageId: v.optional(v.id("_storage")),
    isPopular: v.boolean(),
    isPublished: v.boolean(),
    ragEntryId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId_and_slug", ["workspaceId", "slug"])
    .index("by_workspaceId_and_isPublished", ["workspaceId", "isPublished"])
    .searchIndex("search_articles", {
      searchField: "title",
      filterFields: ["workspaceId", "isPublished", "category"],
    }),

  kbSources: defineTable({
    workspaceId: v.id("workspaces"),
    type: v.union(v.literal("document"), v.literal("website")),
    name: v.string(),
    url: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    mimeType: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    errorMessage: v.optional(v.string()),
    pagesTotal: v.optional(v.number()),
    pagesCrawled: v.optional(v.number()),
    chunkCount: v.optional(v.number()),
    ragEntryId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId_and_type", ["workspaceId", "type"])
    .index("by_workspaceId_and_status", ["workspaceId", "status"]),

  crawlPages: defineTable({
    workspaceId: v.id("workspaces"),
    sourceId: v.id("kbSources"),
    url: v.string(),
    title: v.optional(v.string()),
    status: v.union(
      v.literal("queued"),
      v.literal("crawling"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    errorMessage: v.optional(v.string()),
    ragEntryId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_sourceId_and_status", ["sourceId", "status"])
    .index("by_workspaceId_and_url", ["workspaceId", "url"]),

  usageMeters: defineTable({
    workspaceId: v.id("workspaces"),
    period: v.string(), // YYYY-MM
    aiMessages: v.number(),
    kbDocuments: v.number(),
    crawlPages: v.number(),
    updatedAt: v.number(),
  }).index("by_workspaceId_and_period", ["workspaceId", "period"]),

  messageCitations: defineTable({
    workspaceId: v.id("workspaces"),
    threadId: v.string(),
    messageId: v.string(),
    citations: v.array(
      v.object({
        title: v.string(),
        sourceType: v.union(
          v.literal("article"),
          v.literal("document"),
          v.literal("website"),
          v.literal("unknown"),
        ),
        sourceId: v.string(),
        url: v.optional(v.string()),
        slug: v.optional(v.string()),
      }),
    ),
    createdAt: v.number(),
  }).index("by_threadId", ["threadId"]),
});
