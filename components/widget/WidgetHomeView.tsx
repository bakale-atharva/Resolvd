"use client";

import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";

export interface PublicWidgetConfig {
  workspaceId: Id<"workspaces">;
  workspaceName: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderRadius: number;
  marginBottom: number;
  marginSide: number;
  position: "bottom-right" | "bottom-left";
  title: string;
  subtitle: string;
  logoUrl: string | null;
  soundEnabled: boolean;
  proactiveEnabled: boolean;
  proactiveDelaySeconds: number;
  proactiveMessage: string;
  leadGateEnabled: boolean;
  leadGateFields: {
    name: boolean;
    email: boolean;
    phone: boolean;
  };
  faqs: Array<{ question: string; answer?: string }>;
  hideBranding: boolean;
}

export interface PublicArticleSummary {
  _id: Id<"articles">;
  title: string;
  slug: string;
  category: string;
  isPopular: boolean;
  excerpt: string;
  updatedAt: number;
}

interface WidgetHomeViewProps {
  config: PublicWidgetConfig;
  articles: PublicArticleSummary[] | undefined;
  onStartChat: (initialPrompt?: string) => void;
  onOpenArticle: (slug: string) => void;
  onOpenHelp: () => void;
}

export function WidgetHomeView({
  config,
  articles,
  onStartChat,
  onOpenArticle,
  onOpenHelp,
}: WidgetHomeViewProps) {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const popularArticles = (articles ?? [])
    .filter((a) => a.isPopular)
    .slice(0, 3);
  const featuredArticles =
    popularArticles.length > 0
      ? popularArticles
      : (articles ?? []).slice(0, 3);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      {/* Start Conversation Card */}
      <div className="rounded-xl border border-black/10 bg-white p-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: config.primaryColor }}
          >
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-neutral-900">
              Need help right now?
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">
              {config.proactiveMessage ||
                "Ask our AI assistant for instant answers or reach our support team."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onStartChat()}
          className="mt-3.5 flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-xs font-medium text-white transition-opacity hover:opacity-95"
          style={{ backgroundColor: config.primaryColor }}
        >
          <span className="flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5" />
            Start a conversation
          </span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Quick FAQs */}
      {config.faqs.length > 0 && (
        <div className="rounded-xl border border-black/10 bg-white p-3.5 shadow-xs">
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Quick questions
          </p>
          <div className="space-y-1.5">
            {config.faqs.map((faq, index) => {
              const isOpen = expandedFaq === index;
              return (
                <div
                  key={`${faq.question}-${index}`}
                  className="rounded-lg border border-black/8 bg-neutral-50/70"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!faq.answer) {
                        onStartChat(faq.question);
                        return;
                      }
                      setExpandedFaq(isOpen ? null : index);
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-neutral-800 hover:bg-neutral-100/70"
                  >
                    <span>{faq.question}</span>
                    {faq.answer ? (
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                    )}
                  </button>
                  {isOpen && faq.answer && (
                    <div className="border-t border-black/6 px-3 py-2 text-xs leading-relaxed text-neutral-600">
                      <p>{faq.answer}</p>
                      <button
                        type="button"
                        onClick={() => onStartChat(faq.question)}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium hover:underline"
                        style={{ color: config.primaryColor }}
                      >
                        Ask follow-up in chat
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Featured Help Articles */}
      {featuredArticles.length > 0 && (
        <div className="rounded-xl border border-black/10 bg-white p-3.5 shadow-xs">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Help articles
            </p>
            <button
              type="button"
              onClick={onOpenHelp}
              className="text-[11px] font-medium hover:underline"
              style={{ color: config.primaryColor }}
            >
              Browse all
            </button>
          </div>
          <div className="space-y-1.5">
            {featuredArticles.map((article) => (
              <button
                key={article._id}
                type="button"
                onClick={() => onOpenArticle(article.slug)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-black/6 px-3 py-2 text-left transition-colors hover:bg-neutral-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-neutral-800">
                    {article.title}
                  </p>
                  <p className="truncate text-[11px] text-neutral-500">
                    {article.category}
                  </p>
                </div>
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
