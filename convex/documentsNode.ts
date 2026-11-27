"use node";

import { defaultChunker } from "@convex-dev/rag";
import { v } from "convex/values";
import { extractText } from "unpdf";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { rag, workspaceNamespace } from "./rag";

export const ingestDocument = internalAction({
  args: {
    sourceId: v.id("kbSources"),
  },
  handler: async (ctx, args) => {
    const source = await ctx.runQuery(
      internal.documents.getDocumentForIngestion,
      { sourceId: args.sourceId },
    );

    if (!source || !source.storageId) {
      return;
    }

    try {
      const blob = await ctx.storage.get(source.storageId);
      if (!blob) {
        throw new Error("Uploaded file could not be found in storage.");
      }

      const isPdf =
        source.mimeType === "application/pdf" ||
        source.name.toLowerCase().endsWith(".pdf");

      let extractedText = "";
      if (isPdf) {
        const buffer = await blob.arrayBuffer();
        const result = await extractText(new Uint8Array(buffer), {
          mergePages: true,
        });
        extractedText = result.text.trim();
      } else {
        extractedText = (await blob.text()).trim();
      }

      if (!extractedText) {
        throw new Error(
          "No readable text could be extracted from this document.",
        );
      }

      const chunks = defaultChunker(extractedText);
      const result = await rag.add(ctx, {
        namespace: workspaceNamespace(source.workspaceId),
        key: `document:${source._id}`,
        title: source.name,
        text: extractedText,
        filterValues: [
          { name: "sourceType", value: "document" },
          { name: "sourceId", value: source._id },
        ],
        metadata: {
          sourceType: "document",
          sourceId: source._id,
          title: source.name,
        },
      });

      await ctx.runMutation(internal.documents.updateDocumentIngestionStatus, {
        sourceId: source._id,
        status: "ready",
        ragEntryId: result.entryId,
        chunkCount: chunks.length,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Document ingestion failed.";
      await ctx.runMutation(internal.documents.updateDocumentIngestionStatus, {
        sourceId: source._id,
        status: "failed",
        errorMessage: message.slice(0, 500),
      });
    }
  },
});
