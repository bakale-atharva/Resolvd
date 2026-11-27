"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { RetrievalMatch } from "@/convex/rag";
import { cn } from "@/lib/utils";

type SourceFilter = "all" | "article" | "document" | "website";

export function DocumentsTab() {
  const documents = useQuery(api.documents.listDocuments);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const createDocumentSource = useMutation(api.documents.createDocumentSource);
  const deleteDocumentSource = useMutation(api.documents.deleteDocumentSource);
  const testRetrieval = useAction(api.rag.testRetrieval);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [queryText, setQueryText] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [matches, setMatches] = useState<RetrievalMatch[] | null>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    setUploading(true);
    setUploadError(null);

    try {
      for (const file of fileList) {
        const lower = file.name.toLowerCase();
        if (
          !lower.endsWith(".md") &&
          !lower.endsWith(".txt") &&
          !lower.endsWith(".pdf")
        ) {
          throw new Error(
            `Unsupported file "${file.name}". Only .md, .txt, and .pdf files are supported.`,
          );
        }

        const postUrl = await generateUploadUrl();
        const mimeType =
          file.type ||
          (lower.endsWith(".pdf")
            ? "application/pdf"
            : lower.endsWith(".md")
              ? "text/markdown"
              : "text/plain");

        const res = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": mimeType },
          body: file,
        });

        if (!res.ok) {
          throw new Error(`Upload failed for "${file.name}"`);
        }

        const { storageId } = (await res.json()) as {
          storageId: Id<"_storage">;
        };

        await createDocumentSource({
          name: file.name,
          storageId,
          mimeType,
        });
      }
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Failed to upload document",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = queryText.trim();
    if (!trimmed) return;

    setSearching(true);
    setSearchError(null);

    try {
      const results = await testRetrieval({
        query: trimmed,
        limit: 6,
        ...(sourceFilter !== "all" ? { sourceType: sourceFilter } : {}),
      });
      setMatches(results);
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : "Retrieval search failed",
      );
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Left Column: Uploader & Document List */}
      <div className="space-y-6 lg:col-span-7">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length > 0) {
              void uploadFiles(e.dataTransfer.files);
            }
          }}
          className={cn(
            "rounded-xl border border-dashed p-8 text-center transition-colors",
            dragging
              ? "border-primary bg-accent/40"
              : "border-border bg-card hover:border-primary/50",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".md,.txt,.pdf,text/markdown,text/plain,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void uploadFiles(e.target.files);
            }}
          />

          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <UploadCloud className="h-5 w-5" />
            )}
          </div>

          <h2 className="mt-3 text-sm font-semibold text-foreground">
            Upload knowledge base documents
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Drag and drop <span className="font-mono">.md</span>,{" "}
            <span className="font-mono">.txt</span>, or{" "}
            <span className="font-mono">.pdf</span> files here, or browse from
            your computer.
          </p>

          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? "Uploading..." : "Select Files"}
            </Button>
          </div>
        </div>

        {uploadError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {uploadError}
          </div>
        )}

        {/* Uploaded Documents List */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-semibold text-foreground">
              Uploaded Documents
            </h3>
            <span className="tabular-nums text-xs text-muted-foreground">
              {documents ? `${documents.length} file${documents.length === 1 ? "" : "s"}` : "—"}
            </span>
          </div>

          {documents === undefined ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Loading documents...</span>
            </div>
          ) : documents.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No documents uploaded yet. Upload a Markdown, text, or PDF file to
              chunk and index it into RAG.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {documents.map((doc) => (
                <div
                  key={doc._id}
                  className="flex items-center justify-between gap-4 px-5 py-3.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {doc.name}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {doc.status === "ready" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                            <CheckCircle2 className="h-3 w-3" />
                            Ready
                          </span>
                        )}
                        {(doc.status === "processing" ||
                          doc.status === "pending") && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Processing
                          </span>
                        )}
                        {doc.status === "failed" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                            <AlertCircle className="h-3 w-3" />
                            Failed
                          </span>
                        )}
                        {doc.chunkCount !== undefined && (
                          <span className="tabular-nums">
                            {doc.chunkCount} chunk
                            {doc.chunkCount === 1 ? "" : "s"}
                          </span>
                        )}
                        {doc.errorMessage && (
                          <span className="truncate text-destructive">
                            {doc.errorMessage}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void deleteDocumentSource({ sourceId: doc._id })
                    }
                    className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Delete ${doc.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Inline Retrieval Playground */}
      <div className="lg:col-span-5">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Retrieval Playground
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Test semantic search across your workspace&apos;s indexed articles,
            documents, and crawled web pages.
          </p>

          <form onSubmit={handleSearch} className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Ask a customer question..."
                className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                {(["all", "article", "document", "website"] as const).map(
                  (filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setSourceFilter(filter)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                        sourceFilter === filter
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                      )}
                    >
                      {filter}
                    </button>
                  ),
                )}
              </div>

              <Button
                type="submit"
                size="sm"
                disabled={searching || !queryText.trim()}
              >
                {searching && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Test Query
              </Button>
            </div>
          </form>

          {searchError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {searchError}
            </div>
          )}

          {matches !== null && (
            <div className="space-y-2.5 border-t border-border pt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Matched chunks</span>
                <span className="tabular-nums font-medium">
                  {matches.length} result{matches.length === 1 ? "" : "s"}
                </span>
              </div>

              {matches.length === 0 ? (
                <p className="rounded-lg border border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                  No matching chunks found for this query.
                </p>
              ) : (
                <div className="max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
                  {matches.map((match, idx) => (
                    <div
                      key={`${match.entryId}-${idx}`}
                      className="rounded-lg border border-border bg-background p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-foreground">
                          {match.title}
                        </span>
                        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] font-medium tabular-nums text-accent-foreground">
                          {(match.score * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="rounded bg-secondary px-1.5 py-0.5 capitalize">
                          {match.sourceType}
                        </span>
                        {match.url && (
                          <span className="truncate font-mono">{match.url}</span>
                        )}
                      </div>
                      <p className="line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-foreground/85">
                        {match.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
