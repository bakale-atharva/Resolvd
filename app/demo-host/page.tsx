"use client";

import { useQuery } from "convex/react";
import { Check, Code2, Copy, ExternalLink, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ResolvdLogoMark } from "@/components/brand/ResolvdLogo";
import { Button, buttonVariants } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";

declare global {
  interface Window {
    __resolvdWidgetMounted?: boolean;
  }
}

export default function DemoHostPage() {
  const currentWorkspace = useQuery(api.workspaces.getCurrentWorkspace);
  const [workspaceIdInput, setWorkspaceIdInput] = useState<string | null>(null);
  const [mountedOverride, setMountedOverride] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const urlWorkspaceId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("workspaceId")?.trim() ||
        null
      : null;

  const mountedWorkspaceId =
    mountedOverride ??
    urlWorkspaceId ??
    currentWorkspace?.workspace?._id ??
    null;

  const inputValue = workspaceIdInput ?? mountedWorkspaceId ?? "";

  useEffect(() => {
    if (!mountedWorkspaceId || typeof document === "undefined") return;

    const existingRoot = document.getElementById("resolvd-widget-root");
    if (existingRoot) {
      existingRoot.remove();
    }
    const existingScript = document.getElementById("resolvd-demo-script");
    if (existingScript) {
      existingScript.remove();
    }
    window.__resolvdWidgetMounted = false;

    const script = document.createElement("script");
    script.id = "resolvd-demo-script";
    script.src = "/widget.js";
    script.setAttribute("data-workspace-id", mountedWorkspaceId);
    document.body.appendChild(script);

    return () => {
      document.getElementById("resolvd-widget-root")?.remove();
      document.getElementById("resolvd-demo-script")?.remove();
      window.__resolvdWidgetMounted = false;
    };
  }, [mountedWorkspaceId]);

  const snippet = mountedWorkspaceId
    ? `<script src="/widget.js" data-workspace-id="${mountedWorkspaceId}" defer></script>`
    : `<script src="/widget.js" data-workspace-id="YOUR_WORKSPACE_ID" defer></script>`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <ResolvdLogoMark className="h-6 w-6" />
            <span className="text-sm font-semibold tracking-tight">
              Resolvd Demo Host
            </span>
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Sandbox
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-semibold tracking-tight">
                Live Embeddable Widget Sandbox
              </h1>
              <p className="text-sm text-muted-foreground">
                This page simulates a third-party customer website loading{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  /widget.js
                </code>{" "}
                with your workspace ID. Use the launcher in the corner to test
                the Home view, streaming AI answers with RAG citations, lead
                capture gate, and Help Center.
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = inputValue.trim();
              if (trimmed) setMountedOverride(trimmed);
            }}
            className="mt-6 flex flex-col gap-3 sm:flex-row"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setWorkspaceIdInput(e.target.value)}
              placeholder="Paste Convex workspaceId..."
              className="h-9 flex-1 rounded-md border border-input bg-background px-3 font-mono text-xs focus:border-primary focus:outline-none"
            />
            <Button type="submit" size="sm">
              Mount Widget
            </Button>
            {mountedWorkspaceId && (
              <Link
                href={`/embed/${mountedWorkspaceId}`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Open Direct Iframe
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            )}
          </form>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Code2 className="h-4 w-4 text-primary" />
              One-line embed snippet
            </div>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-4 font-mono text-xs text-foreground">
            <code>{snippet}</code>
          </pre>
        </div>
      </main>
    </div>
  );
}
