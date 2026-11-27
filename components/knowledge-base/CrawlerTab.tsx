"use client";

import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

export function CrawlerTab() {
  const sources = useQuery(api.crawler.listWebsiteSources);
  const startWebsiteCrawl = useMutation(api.crawler.startWebsiteCrawl);
  const recrawlWebsiteSource = useMutation(api.crawler.recrawlWebsiteSource);
  const deleteWebsiteSource = useMutation(api.crawler.deleteWebsiteSource);

  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(15);
  const [maxDepth, setMaxDepth] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSourceId, setActiveSourceId] = useState<Id<"kbSources"> | null>(
    null,
  );

  const activePages = useQuery(
    api.crawler.listCrawlPages,
    activeSourceId ? { sourceId: activeSourceId } : "skip",
  );

  const activeSource = sources?.find((s) => s._id === activeSourceId) ?? null;

  const handleStartCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const sourceId = await startWebsiteCrawl({
        url,
        maxPages,
        maxDepth,
      });
      setUrl("");
      setActiveSourceId(sourceId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start website crawl",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Start Crawl Form */}
      <form
        onSubmit={handleStartCrawl}
        className="rounded-xl border border-border bg-card p-6 space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Crawl a public website
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Resolvd crawls same-origin pages, converts HTML to Markdown, and
              indexes each page into your workspace RAG namespace.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            SSRF Guarded
          </span>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-12">
          <div className="sm:col-span-6">
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Seed URL
            </label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.example.com"
              className="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Max Pages
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value) || 15)}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm tabular-nums text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Max Depth
            </label>
            <select
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value={0}>0 (Seed only)</option>
              <option value={1}>1 hop</option>
              <option value={2}>2 hops</option>
              <option value={3}>3 hops</option>
            </select>
          </div>

          <div className="flex items-end sm:col-span-2">
            <Button
              type="submit"
              disabled={submitting || !url.trim()}
              className="h-9 w-full"
            >
              {submitting && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Start Crawl
            </Button>
          </div>
        </div>
      </form>

      {/* Sources + Pages Drawer Grid */}
      <div
        className={cn(
          "grid gap-6",
          activeSource ? "lg:grid-cols-12" : "grid-cols-1",
        )}
      >
        <div
          className={cn(
            "rounded-xl border border-border bg-card",
            activeSource ? "lg:col-span-7" : "",
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h3 className="text-sm font-semibold text-foreground">
              Crawled Websites
            </h3>
            <span className="tabular-nums text-xs text-muted-foreground">
              {sources
                ? `${sources.length} source${sources.length === 1 ? "" : "s"}`
                : "—"}
            </span>
          </div>

          {sources === undefined ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Loading website sources...</span>
            </div>
          ) : sources.length === 0 ? (
            <div className="p-10 text-center">
              <Globe className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-semibold text-foreground">
                No websites crawled yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter a public documentation or help center URL above to begin.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sources.map((source) => {
                const total = source.pagesTotal ?? 1;
                const crawled = source.pagesCrawled ?? 0;
                const pct =
                  total > 0 ? Math.min(100, Math.round((crawled / total) * 100)) : 0;

                return (
                  <div key={source._id} className="px-6 py-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 shrink-0 text-primary" />
                          <span className="truncate text-sm font-semibold text-foreground">
                            {source.name}
                          </span>
                          {source.status === "ready" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                              <CheckCircle2 className="h-3 w-3" />
                              Ready
                            </span>
                          )}
                          {(source.status === "processing" ||
                            source.status === "pending") && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Crawling
                            </span>
                          )}
                          {source.status === "failed" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                              <AlertCircle className="h-3 w-3" />
                              Failed
                            </span>
                          )}
                        </div>
                        {source.url && (
                          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                            {source.url}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setActiveSourceId(
                              activeSourceId === source._id ? null : source._id,
                            )
                          }
                        >
                          {activeSourceId === source._id
                            ? "Hide Pages"
                            : "View Pages"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={source.status === "processing"}
                          onClick={() =>
                            void recrawlWebsiteSource({ sourceId: source._id })
                          }
                          aria-label={`Re-crawl ${source.name}`}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (activeSourceId === source._id) {
                              setActiveSourceId(null);
                            }
                            void deleteWebsiteSource({ sourceId: source._id });
                          }}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Delete ${source.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Crawl progress</span>
                        <span className="tabular-nums font-medium">
                          {crawled} / {total} pages ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Crawled Pages Drawer */}
        {activeSource && (
          <div className="rounded-xl border border-border bg-card lg:col-span-5">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-foreground">
                  Pages — {activeSource.name}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Individual URLs discovered & indexed
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSourceId(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="Close pages drawer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {activePages === undefined ? (
              <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Loading pages...</span>
              </div>
            ) : activePages.length === 0 ? (
              <div className="p-6 text-xs text-muted-foreground">
                No pages recorded yet.
              </div>
            ) : (
              <div className="max-h-[460px] divide-y divide-border overflow-y-auto">
                {activePages.map((page) => (
                  <div
                    key={page._id}
                    className="flex items-start justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground">
                        {page.title ?? page.url}
                      </p>
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate font-mono text-[11px] text-muted-foreground hover:text-primary"
                      >
                        <span className="truncate">{page.url}</span>
                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                      </a>
                      {page.errorMessage && (
                        <p className="mt-1 text-[11px] text-destructive">
                          {page.errorMessage}
                        </p>
                      )}
                    </div>

                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                        page.status === "ready"
                          ? "bg-accent text-accent-foreground"
                          : page.status === "failed"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {page.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
