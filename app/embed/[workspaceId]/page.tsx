import { Suspense } from "react";
import { EmbedWidget } from "@/components/widget/EmbedWidget";
import type { Id } from "@/convex/_generated/dataModel";

async function EmbedWidgetLoader({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <EmbedWidget workspaceId={workspaceId as Id<"workspaces">} />;
}

export default function EmbedWidgetPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh w-full items-center justify-center bg-neutral-50 text-xs text-neutral-500">
          Loading support widget...
        </div>
      }
    >
      <EmbedWidgetLoader params={params} />
    </Suspense>
  );
}
