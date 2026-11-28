"use client";

import {
  useSmoothText,
  useUIMessages,
  type UIMessage,
} from "@convex-dev/agent/react";
import usePresence from "@convex-dev/presence/react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  BookOpen,
  Bot,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  RotateCcw,
  Send,
  UserCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MarkdownPreview } from "@/components/knowledge-base/MarkdownPreview";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface RoomUserData {
  role?: "agent" | "visitor";
  name?: string;
  imageUrl?: string | null;
  isTyping?: boolean;
}

interface ViewerPresence {
  userId: string;
  name: string;
  imageUrl: string | null;
}

interface RoomPresenceSnapshot {
  viewers: ViewerPresence[];
  visitorOnline: boolean;
  visitorTyping: boolean;
}

function InboxPresenceBridge({
  conversationId,
  currentUserId,
  onSnapshot,
}: {
  conversationId: Id<"conversations">;
  currentUserId: string;
  onSnapshot: (snapshot: RoomPresenceSnapshot) => void;
}) {
  const presenceState = usePresence(
    api.presence,
    `conv:${conversationId}`,
    `agent:${currentUserId}`,
    10_000,
  );

  useEffect(() => {
    const entries = presenceState ?? [];
    const viewers: ViewerPresence[] = [];
    let visitorOnline = false;
    let visitorTyping = false;

    for (const entry of entries) {
      if (!entry.online) continue;
      const data = entry.data as RoomUserData | undefined;
      if (entry.userId.startsWith("agent:")) {
        viewers.push({
          userId: entry.userId,
          name: data?.name || "Team Member",
          imageUrl: data?.imageUrl ?? null,
        });
      } else if (entry.userId.startsWith("visitor:")) {
        visitorOnline = true;
        if (data?.isTyping) {
          visitorTyping = true;
        }
      }
    }

    onSnapshot({ viewers, visitorOnline, visitorTyping });
  }, [presenceState, onSnapshot]);

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

function AgentThreadBubble({
  message,
  citations,
}: {
  message: UIMessage;
  citations: {
    title: string;
    sourceType: "article" | "document" | "website" | "unknown";
    sourceId: string;
    url?: string;
    slug?: string;
  }[];
}) {
  const rawText = getMessageText(message);
  const [visibleText] = useSmoothText(rawText, {
    charsPerSec: 120,
    startStreaming: message.status === "streaming",
  });

  const displayText =
    message.status === "streaming" ? visibleText || rawText : rawText;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <span className="px-1 text-[11px] font-medium text-muted-foreground">
        {message.agentName || "Resolvd AI"}
      </span>
      <div className="max-w-[78%] rounded-2xl rounded-tr-sm border border-primary/20 bg-primary/8 px-4 py-2.5 text-sm leading-relaxed text-foreground">
        {displayText ? (
          <MarkdownPreview content={displayText} />
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Generating reply...
          </span>
        )}
      </div>

      {citations.length > 0 && (
        <div className="flex max-w-[78%] flex-wrap justify-end gap-1.5">
          {citations.map((c, idx) =>
            c.url ? (
              <a
                key={`${c.sourceId}-${idx}`}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3 text-primary" />
                <span className="max-w-[160px] truncate">{c.title}</span>
              </a>
            ) : (
              <span
                key={`${c.sourceId}-${idx}`}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] text-muted-foreground"
              >
                {c.sourceType === "article" ? (
                  <BookOpen className="h-3 w-3 text-primary" />
                ) : (
                  <FileText className="h-3 w-3" />
                )}
                <span className="max-w-[160px] truncate">{c.title}</span>
              </span>
            ),
          )}
        </div>
      )}
    </div>
  );
}

interface InboxThreadPaneProps {
  conversationId: Id<"conversations"> | null;
  currentUserId: string | null;
  onBackMobile: () => void;
}

export function InboxThreadPane({
  conversationId,
  currentUserId,
  onBackMobile,
}: InboxThreadPaneProps) {
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [presenceSnapshot, setPresenceSnapshot] =
    useState<RoomPresenceSnapshot>({
      viewers: [],
      visitorOnline: false,
      visitorTyping: false,
    });

  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const detail = useQuery(
    api.inbox.getConversationDetail,
    conversationId ? { conversationId } : "skip",
  );
  const members = useQuery(api.memberships.listWorkspaceMembers);

  const messagesResult = useUIMessages(
    api.inbox.listInboxMessages,
    conversationId && detail?.conversation.threadId
      ? { conversationId, threadId: detail.conversation.threadId }
      : "skip",
    { initialNumItems: 40, stream: true },
  );

  const markAsRead = useMutation(api.inbox.markAsRead);
  const assignConversation = useMutation(api.inbox.assignConversation);
  const updateStatus = useMutation(api.inbox.updateConversationStatus);
  const toggleAiTakeover = useMutation(api.inbox.toggleAiTakeover);
  const sendAgentReply = useMutation(api.inbox.sendAgentReply);
  const setAgentTyping = useMutation(api.presence.setAgentTyping);

  const citationsByMessageId = useMemo(() => {
    const map = new Map<
      string,
      NonNullable<typeof detail>["citations"][number]["citations"]
    >();
    for (const doc of detail?.citations ?? []) {
      map.set(doc.messageId, doc.citations);
    }
    return map;
  }, [detail?.citations]);

  const messages = useMemo(
    () => messagesResult.results ?? [],
    [messagesResult.results],
  );

  // Auto-mark as read when viewing an unread conversation
  useEffect(() => {
    if (conversationId && detail && detail.conversation.unreadCount > 0) {
      void markAsRead({ conversationId });
    }
  }, [conversationId, detail, markAsRead]);

  // Scroll to bottom on new messages or visitor typing
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, presenceSnapshot.visitorTyping]);

  // Clear typing on unmount or conversation switch
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current && conversationId) {
        isTypingRef.current = false;
        void setAgentTyping({ conversationId, isTyping: false });
      }
    };
  }, [conversationId, setAgentTyping]);

  function notifyAgentTyping(nextText: string) {
    if (!conversationId) return;
    const hasText = nextText.trim().length > 0;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (!hasText) {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        void setAgentTyping({ conversationId, isTyping: false });
      }
      return;
    }

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      void setAgentTyping({ conversationId, isTyping: true });
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        void setAgentTyping({ conversationId, isTyping: false });
      }
    }, 3000);
  }

  async function handleSend() {
    const trimmed = replyText.trim();
    if (!trimmed || !conversationId || isSending) return;

    setReplyText("");
    notifyAgentTyping("");
    setSendError(null);
    setIsSending(true);
    try {
      await sendAgentReply({ conversationId, body: trimmed });
    } catch (err) {
      setReplyText(trimmed);
      setSendError(
        err instanceof Error ? err.message : "Failed to send reply",
      );
    } finally {
      setIsSending(false);
    }
  }

  if (!conversationId) {
    return (
      <section className="hidden h-full flex-col items-center justify-center bg-background/50 p-8 text-center lg:flex">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
          <MessageSquare className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-sm font-semibold text-foreground">
          Select a conversation
        </h2>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Choose a thread on the left to inspect messages, see live visitor
          presence, or take over from the AI assistant.
        </p>
      </section>
    );
  }

  if (detail === undefined) {
    return (
      <section className="flex h-full items-center justify-center bg-background/50 text-xs text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading thread...
      </section>
    );
  }

  const { conversation } = detail;
  const visitorDisplay =
    conversation.visitorName ||
    conversation.visitorEmail ||
    "Website Visitor";

  return (
    <section className="flex h-full flex-col bg-background/40">
      {currentUserId && (
        <InboxPresenceBridge
          conversationId={conversationId}
          currentUserId={currentUserId}
          onSnapshot={setPresenceSnapshot}
        />
      )}

      {/* Thread Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBackMobile}
            aria-label="Back to conversations"
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-foreground">
                {visitorDisplay}
              </h2>
              {presenceSnapshot.visitorOnline && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Online
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {conversation.visitorEmail && (
                <span className="inline-flex items-center gap-1 truncate">
                  <Mail className="h-3 w-3" />
                  {conversation.visitorEmail}
                </span>
              )}
              {conversation.visitorPhone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {conversation.visitorPhone}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Live Presence Avatars */}
          {presenceSnapshot.viewers.length > 0 && (
            <div
              className="flex items-center -space-x-1.5 pr-1"
              title={presenceSnapshot.viewers.map((v) => v.name).join(", ")}
            >
              {presenceSnapshot.viewers.slice(0, 4).map((viewer) => (
                <div
                  key={viewer.userId}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-card bg-accent text-[10px] font-semibold text-accent-foreground"
                  title={`${viewer.name} viewing`}
                >
                  {viewer.name
                    .split(" ")
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
              ))}
            </div>
          )}

          {/* Assignee Dropdown */}
          <select
            aria-label="Assign conversation"
            value={conversation.assignedToUserId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              void assignConversation({
                conversationId,
                assignedToUserId: val ? val : null,
              });
            }}
            className="h-8 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Unassigned</option>
            {(members ?? []).map((m) => (
              <option key={m.clerkUserId} value={m.clerkUserId}>
                {m.name}
              </option>
            ))}
          </select>

          {/* Open / Closed Toggle */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              void updateStatus({
                conversationId,
                status: conversation.status === "open" ? "closed" : "open",
              })
            }
            className="h-8 gap-1.5 text-xs"
          >
            {conversation.status === "open" ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Close
              </>
            ) : (
              <>
                <RotateCcw className="h-3.5 w-3.5" />
                Reopen
              </>
            )}
          </Button>

          {/* Take Over / Hand Back to AI */}
          <Button
            type="button"
            variant={conversation.mode === "ai" ? "default" : "outline"}
            size="sm"
            onClick={() =>
              void toggleAiTakeover({
                conversationId,
                mode: conversation.mode === "ai" ? "human" : "ai",
              })
            }
            className="h-8 gap-1.5 text-xs"
          >
            {conversation.mode === "ai" ? (
              <>
                <UserCheck className="h-3.5 w-3.5" />
                Take Over
              </>
            ) : (
              <>
                <Bot className="h-3.5 w-3.5" />
                Hand Back to AI
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
            No messages in this thread yet.
          </div>
        ) : (
          messages.map((message) => {
            if (message.role === "user") {
              return (
                <div key={message.id} className="flex flex-col items-start gap-1">
                  <span className="px-1 text-[11px] font-medium text-muted-foreground">
                    {visitorDisplay}
                  </span>
                  <div className="max-w-[78%] rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-sm leading-relaxed text-foreground">
                    {getMessageText(message)}
                  </div>
                </div>
              );
            }

            if (message.role === "assistant") {
              return (
                <AgentThreadBubble
                  key={message.id}
                  message={message}
                  citations={citationsByMessageId.get(message.id) ?? []}
                />
              );
            }

            return null;
          })
        )}

        {presenceSnapshot.visitorTyping && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              {visitorDisplay} is typing…
            </span>
          </div>
        )}
        <div ref={scrollEndRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-card p-4">
        {sendError && (
          <p className="mb-2 text-xs text-destructive">{sendError}</p>
        )}
        <div className="flex items-end gap-2.5">
          <textarea
            rows={2}
            value={replyText}
            onChange={(e) => {
              const val = e.target.value;
              setReplyText(val);
              notifyAgentTyping(val);
            }}
            onBlur={() => notifyAgentTyping("")}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Write a reply to the customer..."
            className="min-h-[60px] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            type="button"
            onClick={() => void handleSend()}
            disabled={!replyText.trim() || isSending}
            className="h-10 gap-1.5 px-4"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Sending a reply automatically switches this conversation to Human
          mode · Press{" "}
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
            ⌘Enter
          </kbd>{" "}
          to send
        </p>
      </div>
    </section>
  );
}
