"use client";

import { useQuery } from "convex/react";
import { ArrowLeft, BookOpen, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { MarkdownPreview } from "@/components/knowledge-base/MarkdownPreview";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { PublicWidgetConfig } from "./WidgetHomeView";

interface WidgetHelpViewProps {
  workspaceId: Id<"workspaces">;
  config: PublicWidgetConfig;
  selectedSlug: string | null;
  onSelectSlug: (slug: string | null) => void;
}

export function WidgetHelpView({
  workspaceId,
  config,
  selectedSlug,
  onSelectSlug,
}: WidgetHelpViewProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const articles = useQuery(api.widget.searchPublicArticles, {
    workspaceId,
    searchQuery: searchQuery.trim() || undefined,
  });

  const activeArticle = useQuery(
    api.widget.getPublicArticle,
    selectedSlug ? { workspaceId, slug: selectedSlug } : "skip",
  );

  if (selectedSlug) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-white">
        <div className="flex items-center gap-2 border-b border-black/8 px-4 py-2.5">
          <button
            type="button"
            onClick={() => onSelectSlug(null)}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All articles
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeArticle === undefined ? (
            <div className="flex items-center justify-center py-12 text-xs text-neutral-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading article...
            </div>
          ) : activeArticle === null ? (
            <div className="py-10 text-center text-xs text-neutral-500">
              This article is no longer available.
            </div>
          ) : (
            <article className="space-y-3">
              <span
                className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: `${config.primaryColor}15`,
                  color: config.primaryColor,
                }}
              >
                {activeArticle.category}
              </span>
              <h2 className="text-base font-semibold tracking-tight text-neutral-900">
                {activeArticle.title}
              </h2>
              {activeArticle.coverUrl && (
                <img
                  src={activeArticle.coverUrl}
                  alt={activeArticle.title}
                  className="max-h-40 w-full rounded-lg border border-black/10 object-cover"
                />
              )}
              <div className="pt-1 text-xs leading-relaxed text-neutral-700">
                <MarkdownPreview content={activeArticle.contentMarkdown} />
              </div>
            </article>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-black/8 bg-white p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search help articles..."
            className="w-full rounded-lg border border-black/12 bg-neutral-50 py-2 pl-8 pr-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {articles === undefined ? (
          <div className="flex items-center justify-center py-12 text-xs text-neutral-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading help center...
          </div>
        ) : articles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/12 bg-white p-6 text-center">
            <BookOpen className="mx-auto h-6 w-6 text-neutral-400" />
            <p className="mt-2 text-xs font-medium text-neutral-700">
              {searchQuery.trim()
                ? "No matching articles found"
                : "No published articles yet"}
            </p>
            <p className="mt-1 text-[11px] text-neutral-500">
              Try a different search or ask our AI assistant in Chat.
            </p>
          </div>
        ) : (
          articles.map((article) => (
            <button
              key={article._id}
              type="button"
              onClick={() => onSelectSlug(article.slug)}
              className="w-full rounded-xl border border-black/8 bg-white p-3.5 text-left shadow-xs transition-colors hover:border-black/15 hover:bg-neutral-50/70"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                  {article.category}
                </span>
                {article.isPopular && (
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: config.primaryColor }}
                  >
                    Popular
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs font-semibold text-neutral-900">
                {article.title}
              </p>
              {article.excerpt && (
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-neutral-500">
                  {article.excerpt}
                </p>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
