import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export const UNASSIGNED_KEY = "__unassigned__";

export const conversationsByUnread = new TableAggregate<{
  Namespace: Id<"workspaces">;
  Key: [number, "open" | "closed", number];
  DataModel: DataModel;
  TableName: "conversations";
}>(components.conversationsByUnread, {
  namespace: (doc) => doc.workspaceId,
  sortKey: (doc) => [doc.unreadCount > 0 ? 1 : 0, doc.status, doc.lastMessageAt],
});

export const conversationsByAssignee = new TableAggregate<{
  Namespace: Id<"workspaces">;
  Key: [string, "open" | "closed", number];
  DataModel: DataModel;
  TableName: "conversations";
}>(components.conversationsByAssignee, {
  namespace: (doc) => doc.workspaceId,
  sortKey: (doc) => [
    doc.assignedToUserId ?? UNASSIGNED_KEY,
    doc.status,
    doc.lastMessageAt,
  ],
});

export const leadsByStatus = new TableAggregate<{
  Namespace: Id<"workspaces">;
  Key: ["new" | "contacted" | "closed", number];
  DataModel: DataModel;
  TableName: "leads";
}>(components.leadsByStatus, {
  namespace: (doc) => doc.workspaceId,
  sortKey: (doc) => [doc.status, doc.createdAt],
});

export async function syncConversationInsert(
  ctx: MutationCtx,
  doc: Doc<"conversations">,
) {
  await Promise.all([
    conversationsByUnread.insertIfDoesNotExist(ctx, doc),
    conversationsByAssignee.insertIfDoesNotExist(ctx, doc),
  ]);
}

export async function syncConversationUpdate(
  ctx: MutationCtx,
  oldDoc: Doc<"conversations">,
  newDoc: Doc<"conversations">,
) {
  await Promise.all([
    conversationsByUnread.replaceOrInsert(ctx, oldDoc, newDoc),
    conversationsByAssignee.replaceOrInsert(ctx, oldDoc, newDoc),
  ]);
}

export async function syncLeadInsert(ctx: MutationCtx, doc: Doc<"leads">) {
  await leadsByStatus.insertIfDoesNotExist(ctx, doc);
}

export async function syncLeadUpdate(
  ctx: MutationCtx,
  oldDoc: Doc<"leads">,
  newDoc: Doc<"leads">,
) {
  await leadsByStatus.replaceOrInsert(ctx, oldDoc, newDoc);
}
