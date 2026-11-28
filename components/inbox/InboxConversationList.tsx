"use client";

import { Bot, Inbox, Loader2, UserCheck } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

export type InboxFilter = "all" | "unread" | "unassigned" | "mine";
export type InboxStatusFilter = "all" | "open" | "closed";

export interface InboxConversationItem {
  _id: Id<"conversations">;
  visitorName?: string;
  visitorEmail?: string;
  status: "open" | "closed";
  mode: "ai" | "human";
  assignedToUserId?: string;
  unreadCount: number;
  lastMessagePreview?: string;
  lastMessageAt: number;
  assignee: {
    clerkUserId: string;
    name: string;
    email: string;
    imageUrl: string | null;
  } | null;
}

export interface InboxCounts {
  all: number;
  unread: number;
  unassigned: number;
  mine: number;
  newLeads: number;
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

interface InboxConversationListProps {
  filter: InboxFilter;
  onFilterChange: (filter: InboxFilter) => void;
  statusFilter: InboxStatusFilter;
  onStatusFilterChange: (status: InboxStatusFilter) => void;
  counts: InboxCounts | undefined;
  conversations: InboxConversationItem[];
  paginationStatus:
    | "LoadingFirstPage"
    | "CanLoadMore"
    | "LoadingMore"
    | "Exhausted";
  onLoadMore: () => void;
  selectedId: Id<"conversations"> | null;
  onSelect: (id: Id<"conversations">) => void;
}

const FILTER_TABS: { key: InboxFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "unassigned", label: "Unassigned" },
  { key: "mine", label: "Mine" },
];

export function InboxConversationList({
  filter,
  onFilterChange,
  statusFilter,
  onStatusFilterChange,
  counts,
  conversations,
  paginationStatus,
  onLoadMore,
  selectedId,
  onSelect,
}: InboxConversationListProps) {
  return (
    <aside className="flex h-full flex-col border-r border-border bg-card">
      {/* Header & Filter Tabs */}
      <div className="border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            Team Inbox
          </h1>
          <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5 text-xs">
            {(["all", "open", "closed"] as InboxStatusFilter[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onStatusFilterChange(s)}
                className={cn(
                  "rounded px-2 py-0.5 capitalize transition-colors",
                  statusFilter === s
                    ? "bg-background font-medium text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {FILTER_TABS.map((tab) => {
            const count = counts?.[tab.key] ?? 0;
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onFilterChange(tab.key)}
                className={cn(
                  "flex items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="truncate">{tab.label}</span>
                <span
                  className={cn(
                    "tabular-nums rounded-full px-1.5 py-0.2 text-[10px] font-semibold",
                    active
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {paginationStatus === "LoadingFirstPage" ? (
          <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading conversations...
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted/50 text-muted-foreground">
              <Inbox className="h-4 w-4" />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">
              No conversations here
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Visitor messages from your embedded widget will appear here in
              real time.
            </p>
          </div>
        ) : (
          <>
            {conversations.map((conv) => {
              const isSelected = conv._id === selectedId;
              const displayName =
                conv.visitorName || conv.visitorEmail || "Website Visitor";

              return (
                <button
                  key={conv._id}
                  type="button"
                  onClick={() => onSelect(conv._id)}
                  className={cn(
                    "flex w-full flex-col gap-1.5 px-4 py-3.5 text-left transition-colors",
                    isSelected
                      ? "bg-accent/70"
                      : "hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          conv.unreadCount > 0
                            ? "bg-primary"
                            : "bg-transparent",
                        )}
                        aria-label={
                          conv.unreadCount > 0 ? "Unread" : undefined
                        }
                      />
                      <span
                        className={cn(
                          "truncate text-sm",
                          conv.unreadCount > 0
                            ? "font-semibold text-foreground"
                            : "font-medium text-foreground/90",
                        )}
                      >
                        {displayName}
                      </span>
                    </div>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {formatRelativeTime(conv.lastMessageAt)}
                    </span>
                  </div>

                  <p className="line-clamp-1 pl-4 text-xs text-muted-foreground">
                    {conv.lastMessagePreview || "Started a new conversation"}
                  </p>

                  <div className="flex items-center justify-between gap-2 pl-4 pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                          conv.mode === "human"
                            ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
                            : "bg-secondary text-secondary-foreground",
                        )}
                      >
                        {conv.mode === "human" ? (
                          <UserCheck className="h-2.5 w-2.5" />
                        ) : (
                          <Bot className="h-2.5 w-2.5" />
                        )}
                        {conv.mode === "human" ? "Human" : "AI"}
                      </span>

                      {conv.status === "closed" && (
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Closed
                        </span>
                      )}

                      {conv.assignee && (
                        <span className="max-w-[110px] truncate text-[11px] text-muted-foreground">
                          · {conv.assignee.name}
                        </span>
                      )}
                    </div>

                    {conv.unreadCount > 0 && (
                      <span className="tabular-nums rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {paginationStatus === "CanLoadMore" && (
              <div className="p-3 text-center">
                <button
                  type="button"
                  onClick={onLoadMore}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Load more conversations
                </button>
              </div>
            )}

            {paginationStatus === "LoadingMore" && (
              <div className="flex items-center justify-center p-3 text-xs text-muted-foreground">
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Loading...
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
