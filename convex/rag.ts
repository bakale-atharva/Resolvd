import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { RAG, type EntryId } from "@convex-dev/rag";
import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction, internalQuery } from "./_generated/server";
import { requireWorkspaceAdmin } from "./lib/auth";

export type RagSourceType = "article" | "document" | "website";

type RagFilterSchemas = {
  sourceType: RagSourceType;
  sourceId: string;
};

type RagEntryMetadata = {
  sourceType: RagSourceType;
  sourceId: string;
  title: string;
  url?: string;
};

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
});

export const rag = new RAG<RagFilterSchemas, RagEntryMetadata>(components.rag, {
  textEmbeddingModel: openrouter.textEmbeddingModel(
    "nvidia/nemotron-3.5-embed-1b:free",
  ),
  embeddingDimension: 2048,
  filterNames: ["sourceType", "sourceId"],
});

export function workspaceNamespace(workspaceId: Id<"workspaces">): string {
  return `ws_${workspaceId}`;
}

export const getAdminWorkspaceContext = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { workspace, user } = await requireWorkspaceAdmin(ctx);
    return {
      workspaceId: workspace._id,
      clerkOrgId: workspace.clerkOrgId,
      userId: user.subject,
    };
  },
});

export const deleteRagEntry = internalAction({
  args: {
    entryId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      await rag.delete(ctx, { entryId: args.entryId as EntryId });
    } catch {
      // Entry may already be deleted or replaced; ignore idempotently.
    }
  },
});

export interface RetrievalMatch {
  entryId: string;
  title: string;
  sourceType: RagSourceType | "unknown";
  sourceId: string;
  url?: string;
  score: number;
  text: string;
}

export const testRetrieval = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    sourceType: v.optional(
      v.union(
        v.literal("article"),
        v.literal("document"),
        v.literal("website"),
      ),
    ),
  },
  handler: async (ctx, args): Promise<RetrievalMatch[]> => {
    const { workspaceId } = await ctx.runQuery(
      internal.rag.getAdminWorkspaceContext,
      {},
    );

    const trimmed = args.query.trim();
    if (!trimmed) {
      throw new ConvexError("Search query cannot be empty");
    }

    const limit = Math.min(Math.max(args.limit ?? 5, 1), 20);
    const searchResult = await rag.search(ctx, {
      namespace: workspaceNamespace(workspaceId),
      query: trimmed,
      limit,
      ...(args.sourceType
        ? {
            filters: [{ name: "sourceType", value: args.sourceType }],
          }
        : {}),
    });

    const entriesById = new Map(
      searchResult.entries.map((entry) => [entry.entryId, entry]),
    );

    return searchResult.results.map((result) => {
      const entry = entriesById.get(result.entryId);
      const metadata = entry?.metadata;
      return {
        entryId: result.entryId,
        title: metadata?.title ?? entry?.title ?? "Untitled source",
        sourceType: metadata?.sourceType ?? "unknown",
        sourceId: metadata?.sourceId ?? "",
        url: metadata?.url,
        score: result.score,
        text: result.content.map((c) => c.text).join("\n\n"),
      };
    });
  },
});
