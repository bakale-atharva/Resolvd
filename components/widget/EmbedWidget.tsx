"use client";

import { useMutation, useQuery } from "convex/react";
import { BookOpen, Home, Loader2, MessageSquare, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { ResolvdLogoMark } from "@/components/brand/ResolvdLogo";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { WidgetChatView } from "./WidgetChatView";
import { WidgetHelpView } from "./WidgetHelpView";
import { WidgetHomeView } from "./WidgetHomeView";

type WidgetTab = "home" | "chat" | "help";

function getOrCreateVisitorSessionId(workspaceId: string): string {
  if (typeof window === "undefined") return "";
  const key = `resolvd_visitor_${workspaceId}`;
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `vis_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(key, generated);
    return generated;
  } catch {
    return `vis_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

const noopSubscribe = () => () => {};
function getIsEmbeddedSnapshot(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function EmbedWidget({ workspaceId }: { workspaceId: Id<"workspaces"> }) {
  const [activeTab, setActiveTab] = useState<WidgetTab>("home");
  const [selectedArticleSlug, setSelectedArticleSlug] = useState<string | null>(
    null,
  );
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [visitorSessionId] = useState(() =>
    getOrCreateVisitorSessionId(workspaceId),
  );
  const isEmbedded = useSyncExternalStore(
    noopSubscribe,
    getIsEmbeddedSnapshot,
    () => false,
  );

  const [sessionState, setSessionState] = useState<{
    conversationId: Id<"conversations">;
    threadId: string;
    mode: "ai" | "human";
    hasLeadInfo: boolean;
  } | null>(null);

  const config = useQuery(api.widget.getPublicWidgetConfig, { workspaceId });
  const articles = useQuery(
    api.widget.searchPublicArticles,
    config ? { workspaceId } : "skip",
  );
  const liveStatus = useQuery(
    api.widget.getWidgetConversationStatus,
    sessionState
      ? {
          workspaceId,
          conversationId: sessionState.conversationId,
          visitorSessionId,
        }
      : "skip",
  );
  const startOrResume = useMutation(api.widget.startOrResumeVisitorSession);

  useEffect(() => {
    if (!config || typeof window === "undefined") return;
    window.parent?.postMessage(
      {
        type: "resolvd:config",
        config: {
          primaryColor: config.primaryColor,
          position: config.position,
          marginBottom: config.marginBottom,
          marginSide: config.marginSide,
          borderRadius: config.borderRadius,
          soundEnabled: config.soundEnabled,
          proactiveEnabled: config.proactiveEnabled,
          proactiveDelaySeconds: config.proactiveDelaySeconds,
          proactiveMessage: config.proactiveMessage,
          title: config.title,
        },
      },
      "*",
    );
  }, [config]);

  useEffect(() => {
    if (!config || !visitorSessionId || sessionState) return;
    let cancelled = false;

    void startOrResume({
      workspaceId,
      visitorSessionId,
    }).then((res) => {
      if (cancelled) return;
      setSessionState({
        conversationId: res.conversationId,
        threadId: res.threadId,
        mode: res.mode,
        hasLeadInfo: res.hasLeadInfo,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [config, visitorSessionId, sessionState, startOrResume, workspaceId]);

  const handleStartChat = useCallback((initialPrompt?: string) => {
    if (initialPrompt) {
      setPendingPrompt(initialPrompt);
    }
    setActiveTab("chat");
  }, []);

  const handleOpenArticle = useCallback((slug: string) => {
    setSelectedArticleSlug(slug);
    setActiveTab("help");
  }, []);

  const handleConsumePendingPrompt = useCallback(() => {
    setPendingPrompt(null);
  }, []);

  if (config === undefined) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-neutral-50 text-xs text-neutral-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading support widget...
      </div>
    );
  }

  if (config === null) {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center bg-neutral-50 p-6 text-center">
        <p className="text-sm font-semibold text-neutral-900">
          Widget unavailable
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          This support workspace could not be found.
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex h-dvh w-full flex-col overflow-hidden"
      style={{
        backgroundColor: config.backgroundColor,
        color: config.textColor,
      }}
    >
      {/* Header */}
      <header
        className="flex shrink-0 items-center justify-between gap-3 px-4 py-3.5 text-white"
        style={{ backgroundColor: config.primaryColor }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {config.logoUrl ? (
            <img
              src={config.logoUrl}
              alt={config.workspaceName}
              className="h-8 w-8 shrink-0 rounded-lg bg-white/15 object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <ResolvdLogoMark className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold leading-tight">
              {config.title}
            </h1>
            <p className="truncate text-[11px] text-white/80">
              {config.subtitle}
            </p>
          </div>
        </div>

        {isEmbedded && (
          <button
            type="button"
            aria-label="Close support widget"
            onClick={() =>
              window.parent?.postMessage({ type: "resolvd:close" }, "*")
            }
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex min-h-0 flex-1 flex-col bg-neutral-50/70">
        {activeTab === "home" && (
          <WidgetHomeView
            config={config}
            articles={articles}
            onStartChat={handleStartChat}
            onOpenArticle={handleOpenArticle}
            onOpenHelp={() => {
              setSelectedArticleSlug(null);
              setActiveTab("help");
            }}
          />
        )}

        {activeTab === "chat" && (
          <WidgetChatView
            workspaceId={workspaceId}
            config={config}
            visitorSessionId={visitorSessionId}
            conversationId={sessionState?.conversationId ?? null}
            threadId={sessionState?.threadId ?? null}
            mode={liveStatus?.mode ?? sessionState?.mode ?? "ai"}
            assignedAgentName={liveStatus?.assignedAgentName ?? null}
            hasLeadInfo={
              liveStatus?.hasLeadInfo ?? sessionState?.hasLeadInfo ?? false
            }
            onLeadSubmitted={() =>
              setSessionState((prev) =>
                prev ? { ...prev, hasLeadInfo: true } : prev,
              )
            }
            onOpenArticle={handleOpenArticle}
            pendingPrompt={pendingPrompt}
            onConsumePendingPrompt={handleConsumePendingPrompt}
          />
        )}

        {activeTab === "help" && (
          <WidgetHelpView
            workspaceId={workspaceId}
            config={config}
            selectedSlug={selectedArticleSlug}
            onSelectSlug={setSelectedArticleSlug}
          />
        )}
      </main>

      {/* Bottom Tab Navigation */}
      <nav className="shrink-0 border-t border-black/8 bg-white">
        <div className="grid grid-cols-3">
          {(
            [
              { id: "home", label: "Home", icon: Home },
              { id: "chat", label: "Chat", icon: MessageSquare },
              { id: "help", label: "Help", icon: BookOpen },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === "help" && activeTab === "help") {
                    setSelectedArticleSlug(null);
                  }
                  setActiveTab(item.id);
                }}
                className="flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors"
                style={{
                  color: isActive ? config.primaryColor : "#737373",
                }}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {!config.hideBranding && (
          <div className="border-t border-black/5 py-1 text-center text-[10px] text-neutral-400">
            Powered by <span className="font-medium text-neutral-500">Resolvd</span>
          </div>
        )}
      </nav>
    </div>
  );
}
