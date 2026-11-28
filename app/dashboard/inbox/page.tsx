"use client";

import { useUser } from "@clerk/nextjs";
import { usePaginatedQuery, useQuery } from "convex/react";
import { useState } from "react";
import {
  InboxConversationList,
  type InboxFilter,
  type InboxStatusFilter,
} from "@/components/inbox/InboxConversationList";
import { InboxThreadPane } from "@/components/inbox/InboxThreadPane";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

export default function InboxPage() {
  const { user } = useUser();
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [statusFilter, setStatusFilter] = useState<InboxStatusFilter>("all");
  const [selectedId, setSelectedId] = useState<Id<"conversations"> | null>(
    null,
  );
  const [mobileShowThread, setMobileShowThread] = useState(false);

  const counts = useQuery(api.inbox.getInboxCounts);
  const { results, status, loadMore } = usePaginatedQuery(
    api.inbox.listConversations,
    {
      filter,
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    },
    { initialNumItems: 25 },
  );

  const activeConversationId =
    selectedId ?? (results.length > 0 ? results[0]._id : null);

  function handleSelectConversation(id: Id<"conversations">) {
    setSelectedId(id);
    setMobileShowThread(true);
  }

  return (
    <div className="h-[calc(100vh-8.5rem)] min-h-[560px] overflow-hidden rounded-xl border border-border bg-card grid grid-cols-1 lg:grid-cols-[340px_1fr]">
      <div
        className={cn(
          "h-full overflow-hidden",
          mobileShowThread ? "hidden lg:block" : "block",
        )}
      >
        <InboxConversationList
          filter={filter}
          onFilterChange={setFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          counts={counts}
          conversations={results}
          paginationStatus={status}
          onLoadMore={() => loadMore(25)}
          selectedId={activeConversationId}
          onSelect={handleSelectConversation}
        />
      </div>

      <div
        className={cn(
          "h-full overflow-hidden",
          mobileShowThread ? "block" : "hidden lg:block",
        )}
      >
        <InboxThreadPane
          conversationId={activeConversationId}
          currentUserId={user?.id ?? null}
          onBackMobile={() => setMobileShowThread(false)}
        />
      </div>
    </div>
  );
}
