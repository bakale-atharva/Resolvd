import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireWorkspaceAdmin, requireWorkspaceMember } from "./lib/auth";

const ALLOWED_MIME_TYPES = new Set([
  "text/markdown",
  "text/x-markdown",
  "text/plain",
  "application/pdf",
]);

function isSupportedDocument(name: string, mimeType: string): boolean {
  const lowerName = name.toLowerCase();
  if (
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".pdf")
  ) {
    return true;
  }
  return ALLOWED_MIME_TYPES.has(mimeType.toLowerCase());
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireWorkspaceAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const listDocuments = query({
  args: {},
  handler: async (ctx) => {
    const { workspace } = await requireWorkspaceMember(ctx);
    return await ctx.db
      .query("kbSources")
      .withIndex("by_workspaceId_and_type", (q) =>
        q.eq("workspaceId", workspace._id).eq("type", "document"),
      )
      .order("desc")
      .take(100);
  },
});

export const createDocumentSource = mutation({
  args: {
    name: v.string(),
    storageId: v.id("_storage"),
    mimeType: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"kbSources">> => {
    const { workspace } = await requireWorkspaceAdmin(ctx);

    const name = args.name.trim();
    if (!name) {
      throw new ConvexError("Document name is required");
    }

    if (!isSupportedDocument(name, args.mimeType)) {
      throw new ConvexError(
        "Unsupported file type. Please upload .md, .txt, or .pdf files.",
      );
    }

    const now = Date.now();
    const sourceId = await ctx.db.insert("kbSources", {
      workspaceId: workspace._id,
      type: "document",
      name,
      storageId: args.storageId,
      mimeType: args.mimeType,
      status: "processing",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.documentsNode.ingestDocument, {
      sourceId,
    });

    return sourceId;
  },
});

export const deleteDocumentSource = mutation({
  args: {
    sourceId: v.id("kbSources"),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceAdmin(ctx);

    const source = await ctx.db.get(args.sourceId);
    if (
      !source ||
      source.workspaceId !== workspace._id ||
      source.type !== "document"
    ) {
      throw new ConvexError("Document not found");
    }

    if (source.ragEntryId) {
      await ctx.scheduler.runAfter(0, internal.rag.deleteRagEntry, {
        entryId: source.ragEntryId,
      });
    }

    if (source.storageId) {
      await ctx.storage.delete(source.storageId);
    }

    await ctx.db.delete(source._id);
  },
});

export const getDocumentForIngestion = internalQuery({
  args: { sourceId: v.id("kbSources") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sourceId);
  },
});

export const updateDocumentIngestionStatus = internalMutation({
  args: {
    sourceId: v.id("kbSources"),
    status: v.union(v.literal("ready"), v.literal("failed")),
    ragEntryId: v.optional(v.string()),
    chunkCount: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) return;

    await ctx.db.patch(args.sourceId, {
      status: args.status,
      ...(args.ragEntryId !== undefined ? { ragEntryId: args.ragEntryId } : {}),
      ...(args.chunkCount !== undefined ? { chunkCount: args.chunkCount } : {}),
      ...(args.errorMessage !== undefined
        ? { errorMessage: args.errorMessage }
        : {}),
      updatedAt: Date.now(),
    });
  },
});
