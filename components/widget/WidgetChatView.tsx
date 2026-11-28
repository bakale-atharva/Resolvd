"use client";

import { useSmoothText, useUIMessages, type UIMessage } from "@convex-dev/agent/react";
import usePresence from "@convex-dev/presence/react";
import { useMutation, useQuery } from "convex/react";
import {
  BookOpen,
  ExternalLink,
  FileText,
  Loader2,
  Send,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MarkdownPreview } from "@/components/knowledge-base/MarkdownPreview";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { PublicWidgetConfig } from "./WidgetHomeView";

interface Citation {
  title: string;
  sourceType: "article" | "document" | "website" | "unknown";
  sourceId: string;
  url?: string;
  slug?: string;
}

interface WidgetChatViewProps {
  workspaceId: Id<"workspaces">;
  config: PublicWidgetConfig;
  visitorSessionId: string;
  conversationId: Id<"conversations"> | null;
  threadId: string | null;
  mode: "ai" | "human";
  assignedAgentName: string | null;
  hasLeadInfo: boolean;
  onLeadSubmitted: () => void;
  onOpenArticle: (slug: string) => void;
  pendingPrompt: string | null;
  onConsumePendingPrompt: () => void;
}

interface RoomUserData {
  role?: "agent" | "visitor";
  name?: string;
  isTyping?: boolean;
}

function WidgetPresenceBridge({
  conversationId,
  visitorSessionId,
  onAgentTypingChange,
}: {
  conversationId: Id<"conversations">;
  visitorSessionId: string;
  onAgentTypingChange: (agentName: string | null) => void;
}) {
  const presenceState = usePresence(
    api.presence,
    `conv:${conversationId}`,
    `visitor:${visitorSessionId}`,
    10_000,
  );

  useEffect(() => {
    const typingAgent = (presenceState ?? []).find((entry) => {
      if (!entry.online || !entry.userId.startsWith("agent:")) return false;
      const data = entry.data as RoomUserData | undefined;
      return Boolean(data?.isTyping);
    });

    if (typingAgent) {
      const data = typingAgent.data as RoomUserData | undefined;
      onAgentTypingChange(data?.name || "Agent");
    } else {
      onAgentTypingChange(null);
    }
  }, [presenceState, onAgentTypingChange]);

  return null;
}

function getMessageText(message: UIMessage): string {
  if (typeof message.text === "string" && message.text.length > 0) {
    return message.text;
  }
  return (message.parts ?? [])
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function AssistantMessageBubble({
  message,
  citations,
  primaryColor,
  onOpenArticle,
}: {
  message: UIMessage;
  citations: Citation[];
  primaryColor: string;
  onOpenArticle: (slug: string) => void;
}) {
  const rawText = getMessageText(message);
  const [visibleText] = useSmoothText(rawText, {
    charsPerSec: 120,
    startStreaming: message.status === "streaming",
  });

  const displayText =
    message.status === "streaming" ? visibleText || rawText : rawText;

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="max-w-[88%] rounded-2xl rounded-tl-sm border border-black/8 bg-white px-3.5 py-2.5 text-xs leading-relaxed text-neutral-800 shadow-xs">
        {displayText ? (
          <MarkdownPreview content={displayText} />
        ) : (
          <span className="inline-flex items-center gap-1.5 text-neutral-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            Thinking...
          </span>
        )}
      </div>

      {citations.length > 0 && (
        <div className="flex max-w-[90%] flex-wrap gap-1.5 pl-0.5">
          {citations.map((citation, idx) => {
            if (citation.sourceType === "article" && citation.slug) {
              return (
                <button
                  key={`${citation.sourceId}-${idx}`}
                  type="button"
                  onClick={() => onOpenArticle(citation.slug!)}
                  className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
                  style={{ borderColor: `${primaryColor}33` }}
                >
                  <BookOpen
                    className="h-3 w-3 shrink-0"
                    style={{ color: primaryColor }}
                  />
                  <span className="max-w-[170px] truncate">
                    {citation.title}
                  </span>
                </button>
              );
            }

            if (citation.url) {
              return (
                <a
                  key={`${citation.sourceId}-${idx}`}
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
                >
                  <ExternalLink
                    className="h-3 w-3 shrink-0"
                    style={{ color: primaryColor }}
                  />
                  <span className="max-w-[170px] truncate">
                    {citation.title}
                  </span>
                </a>
              );
            }

            return (
              <span
                key={`${citation.sourceId}-${idx}`}
                className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600"
              >
                <FileText className="h-3 w-3 shrink-0 text-neutral-400" />
                <span className="max-w-[170px] truncate">{citation.title}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function WidgetChatView({
  workspaceId,
  config,
  visitorSessionId,
  conversationId,
  threadId,
  mode,
  assignedAgentName,
  hasLeadInfo,
  onLeadSubmitted,
  onOpenArticle,
  pendingPrompt,
  onConsumePendingPrompt,
}: WidgetChatViewProps) {
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [typingAgentName, setTypingAgentName] = useState<string | null>(null);

  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);

  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVisitorTypingRef = useRef(false);

  const sendVisitorMessage = useMutation(api.widget.sendVisitorMessage);
  const submitLeadCapture = useMutation(api.widget.submitLeadCapture);
  const setVisitorTyping = useMutation(api.presence.setVisitorTyping);

  const messagesResult = useUIMessages(
    api.widget.listWidgetMessages,
    threadId
      ? {
          workspaceId,
          threadId,
          visitorSessionId,
        }
      : "skip",
    { initialNumItems: 30, stream: true },
  );

  const citationDocs = useQuery(
    api.widget.getWidgetThreadCitations,
    threadId
      ? {
          workspaceId,
          threadId,
          visitorSessionId,
        }
      : "skip",
  );

  const citationsByMessageId = useMemo(() => {
    const map = new Map<string, Citation[]>();
    for (const doc of citationDocs ?? []) {
      map.set(doc.messageId, doc.citations);
    }
    return map;
  }, [citationDocs]);

  const messages = useMemo(
    () => messagesResult.results ?? [],
    [messagesResult.results],
  );

  const lastMessageText = messages[messages.length - 1]?.text;

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, lastMessageText, typingAgentName]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isVisitorTypingRef.current && conversationId) {
        isVisitorTypingRef.current = false;
        void setVisitorTyping({
          workspaceId,
          conversationId,
          visitorSessionId,
          isTyping: false,
        });
      }
    };
  }, [conversationId, setVisitorTyping, visitorSessionId, workspaceId]);

  function notifyVisitorTyping(nextText: string) {
    if (!conversationId) return;
    const hasText = nextText.trim().length > 0;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (!hasText) {
      if (isVisitorTypingRef.current) {
        isVisitorTypingRef.current = false;
        void setVisitorTyping({
          workspaceId,
          conversationId,
          visitorSessionId,
          isTyping: false,
        });
      }
      return;
    }

    if (!isVisitorTypingRef.current) {
      isVisitorTypingRef.current = true;
      void setVisitorTyping({
        workspaceId,
        conversationId,
        visitorSessionId,
        isTyping: true,
      });
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (isVisitorTypingRef.current) {
        isVisitorTypingRef.current = false;
        void setVisitorTyping({
          workspaceId,
          conversationId,
          visitorSessionId,
          isTyping: false,
        });
      }
    }, 3000);
  }

  useEffect(() => {
    if (!pendingPrompt || !conversationId || !threadId) {
      return;
    }
    if (config.leadGateEnabled && !hasLeadInfo) {
      return;
    }

    const promptToSend = pendingPrompt;
    onConsumePendingPrompt();
    void Promise.resolve().then(async () => {
      setIsSending(true);
      setSendError(null);
      try {
        await sendVisitorMessage({
          workspaceId,
          conversationId,
          visitorSessionId,
          message: promptToSend,
        });
      } catch (err) {
        setSendError(
          err instanceof Error ? err.message : "Failed to send message",
        );
      } finally {
        setIsSending(false);
      }
    });
  }, [
    pendingPrompt,
    conversationId,
    threadId,
    config.leadGateEnabled,
    hasLeadInfo,
    onConsumePendingPrompt,
    sendVisitorMessage,
    workspaceId,
    visitorSessionId,
  ]);

  const showLeadGate = config.leadGateEnabled && !hasLeadInfo;

  async function handleLeadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!conversationId) return;

    setLeadError(null);
    setLeadSubmitting(true);
    try {
      await submitLeadCapture({
        workspaceId,
        conversationId,
        visitorSessionId,
        ...(config.leadGateFields.name && leadName.trim()
          ? { name: leadName.trim() }
          : {}),
        ...(config.leadGateFields.email && leadEmail.trim()
          ? { email: leadEmail.trim() }
          : {}),
        ...(config.leadGateFields.phone && leadPhone.trim()
          ? { phone: leadPhone.trim() }
          : {}),
      });
      onLeadSubmitted();
    } catch (err) {
      setLeadError(
        err instanceof Error ? err.message : "Unable to save contact details",
      );
    } finally {
      setLeadSubmitting(false);
    }
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !conversationId || isSending) return;

    setInput("");
    notifyVisitorTyping("");
    setSendError(null);
    setIsSending(true);
    try {
      await sendVisitorMessage({
        workspaceId,
        conversationId,
        visitorSessionId,
        message: trimmed,
      });
    } catch (err) {
      setInput(trimmed);
      setSendError(
        err instanceof Error ? err.message : "Failed to send message",
      );
    } finally {
      setIsSending(false);
    }
  }

  if (showLeadGate) {
    return (
      <div className="flex flex-1 flex-col justify-center p-5">
        <div className="rounded-xl border border-black/10 bg-white p-4 shadow-xs">
          <h3 className="text-sm font-semibold text-neutral-900">
            Introduce yourself
          </h3>
          <p className="mt-1 text-xs text-neutral-500">
            Share your details so our team can follow up if needed.
          </p>

          <form onSubmit={handleLeadSubmit} className="mt-4 space-y-3">
            {config.leadGateFields.name && (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-neutral-700">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full rounded-lg border border-black/12 bg-neutral-50 px-3 py-2 text-xs text-neutral-900 focus:border-neutral-400 focus:bg-white focus:outline-none"
                />
              </div>
            )}

            {config.leadGateFields.email && (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-neutral-700">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                  placeholder="alex@company.com"
                  className="w-full rounded-lg border border-black/12 bg-neutral-50 px-3 py-2 text-xs text-neutral-900 focus:border-neutral-400 focus:bg-white focus:outline-none"
                />
              </div>
            )}

            {config.leadGateFields.phone && (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-neutral-700">
                  Phone
                </label>
                <input
                  type="tel"
                  required
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  placeholder="+1 (555) 234-5678"
                  className="w-full rounded-lg border border-black/12 bg-neutral-50 px-3 py-2 text-xs text-neutral-900 focus:border-neutral-400 focus:bg-white focus:outline-none"
                />
              </div>
            )}

            {leadError && (
              <p className="text-[11px] text-red-600">{leadError}</p>
            )}

            <button
              type="submit"
              disabled={leadSubmitting || !conversationId}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-medium text-white transition-opacity hover:opacity-95 disabled:opacity-60"
              style={{ backgroundColor: config.primaryColor }}
            >
              {leadSubmitting && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Continue to chat
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {conversationId && (
        <WidgetPresenceBridge
          conversationId={conversationId}
          visitorSessionId={visitorSessionId}
          onAgentTypingChange={setTypingAgentName}
        />
      )}

      {/* Mode indicator banner */}
      <div className="flex items-center justify-between border-b border-black/6 bg-white/80 px-4 py-2 text-[11px] text-neutral-600">
        {mode === "human" ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
            <UserCheck className="h-3.5 w-3.5" />
            {assignedAgentName
              ? `Connected with ${assignedAgentName}`
              : "Connected with a support teammate"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-medium text-neutral-700">
            <Sparkles
              className="h-3.5 w-3.5"
              style={{ color: config.primaryColor }}
            />
            AI Assistant · Instant answers
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-black/8 bg-white p-4 text-xs leading-relaxed text-neutral-600 shadow-xs">
            Hi there! Ask me anything about{" "}
            <span className="font-medium text-neutral-900">
              {config.workspaceName}
            </span>
            . I&apos;ll search our help center and docs to get you an answer.
          </div>
        ) : (
          messages.map((message) => {
            if (message.role === "user") {
              return (
                <div key={message.id} className="flex justify-end">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-tr-sm px-3.5 py-2 text-xs leading-relaxed text-white shadow-xs"
                    style={{ backgroundColor: config.primaryColor }}
                  >
                    {getMessageText(message)}
                  </div>
                </div>
              );
            }

            if (message.role === "assistant") {
              return (
                <AssistantMessageBubble
                  key={message.id}
                  message={message}
                  citations={citationsByMessageId.get(message.id) ?? []}
                  primaryColor={config.primaryColor}
                  onOpenArticle={onOpenArticle}
                />
              );
            }

            return null;
          })
        )}

        {typingAgentName && (
          <div className="flex items-center gap-2 pl-1 text-[11px] text-neutral-500">
            <span className="inline-flex items-center gap-1 rounded-full border border-black/8 bg-white px-2.5 py-1 shadow-xs">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {typingAgentName === "Agent"
                ? "Agent is typing…"
                : `${typingAgentName} is typing…`}
            </span>
          </div>
        )}
        <div ref={scrollEndRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="border-t border-black/8 bg-white p-3"
      >
        {sendError && (
          <p className="mb-1.5 text-[11px] text-red-600">{sendError}</p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => {
              const val = e.target.value;
              setInput(val);
              notifyVisitorTyping(val);
            }}
            onBlur={() => notifyVisitorTyping("")}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Write a message..."
            className="max-h-24 min-h-[38px] flex-1 resize-none rounded-lg border border-black/12 bg-neutral-50 px-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || !conversationId || isSending}
            aria-label="Send message"
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg text-white transition-opacity hover:opacity-95 disabled:opacity-45"
            style={{ backgroundColor: config.primaryColor }}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
