import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { Agent } from "@convex-dev/agent";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { rag, workspaceNamespace, type RagSourceType } from "./rag";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
});

export interface SupportCitation {
  title: string;
  sourceType: RagSourceType | "unknown";
  sourceId: string;
  url?: string;
  slug?: string;
}

export function createSupportAgent(modelId: string, instructions?: string) {
  return new Agent(components.agent, {
    name: "Resolvd Support",
    languageModel: openrouter.chat(modelId || "openrouter/free"),
    instructions:
      instructions ??
      "You are Resolvd Support, a helpful, concise, and accurate customer support assistant.",
  });
}

function buildSystemInstructions(params: {
  workspaceName: string;
  customPrompt?: string;
  contextBlocks: string[];
}): string {
  const basePrompt =
    params.customPrompt?.trim() ||
    `You are the AI customer support assistant for ${params.workspaceName}. Be warm, clear, concise, and helpful.`;

  const groundingRules = [
    "Answer the customer's question using the Knowledge Base Context below when relevant.",
    "If the context does not contain enough information to answer confidently, say so honestly and offer to connect them with a human support teammate.",
    "Never invent pricing, policies, guarantees, or URLs that are not present in the context.",
    "Use clean Markdown formatting (short paragraphs, bullet points, or code spans) when helpful.",
  ].join("\n- ");

  if (params.contextBlocks.length === 0) {
    return `${basePrompt}\n\nGuidelines:\n- ${groundingRules}\n\nKnowledge Base Context:\n(No matching knowledge base articles or documents were found for this query.)`;
  }

  return `${basePrompt}\n\nGuidelines:\n- ${groundingRules}\n\nKnowledge Base Context:\n${params.contextBlocks.join("\n\n---\n\n")}`;
}

export const generateSupportReply = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    threadId: v.string(),
    promptMessageId: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(
      internal.widget.getAgentWorkspaceContext,
      {
        workspaceId: args.workspaceId,
        conversationId: args.conversationId,
      },
    );

    if (!context || context.mode !== "ai") {
      return null;
    }

    const searchResult = await rag.search(ctx, {
      namespace: workspaceNamespace(args.workspaceId),
      query: args.prompt,
      limit: 5,
    });

    const entriesById = new Map(
      searchResult.entries.map((entry) => [entry.entryId, entry]),
    );

    const seenCitationKeys = new Set<string>();
    const rawCitations: SupportCitation[] = [];
    const contextBlocks: string[] = [];

    searchResult.results.forEach((result, index) => {
      const entry = entriesById.get(result.entryId);
      const metadata = entry?.metadata;
      const title = metadata?.title ?? entry?.title ?? "Knowledge Base Source";
      const sourceType: SupportCitation["sourceType"] =
        metadata?.sourceType ?? "unknown";
      const sourceId = metadata?.sourceId ?? result.entryId;
      const url = metadata?.url;

      const text = result.content.map((c) => c.text).join("\n").trim();
      if (text) {
        contextBlocks.push(
          `[${index + 1}] ${title} (${sourceType}${url ? ` — ${url}` : ""})\n${text}`,
        );
      }

      const dedupeKey = `${sourceType}:${sourceId}`;
      if (!seenCitationKeys.has(dedupeKey)) {
        seenCitationKeys.add(dedupeKey);
        rawCitations.push({
          title,
          sourceType,
          sourceId,
          url,
        });
      }
    });

    const citations = await ctx.runQuery(
      internal.widget.enrichCitationsWithSlugs,
      {
        workspaceId: args.workspaceId,
        citations: rawCitations,
      },
    );

    const system = buildSystemInstructions({
      workspaceName: context.workspaceName,
      customPrompt: context.systemPrompt,
      contextBlocks,
    });

    const agent = createSupportAgent(context.aiModel, system);

    const streamResult = await agent.streamText(
      ctx,
      { threadId: args.threadId },
      {
        promptMessageId: args.promptMessageId,
        system,
      },
      {
        saveStreamDeltas: {
          chunking: "word",
          throttleMs: 100,
        },
      },
    );

    await streamResult.consumeStream();
    const fullText = await streamResult.text;

    await ctx.runMutation(internal.widget.recordAssistantReply, {
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      threadId: args.threadId,
      messageId: streamResult.messageId ?? `reply_${Date.now()}`,
      preview: fullText.trim().slice(0, 140) || "AI Assistant replied",
      citations,
    });

    return null;
  },
});
