"use client";

import {
  CreateOrganization,
  OrganizationList,
  useAuth,
  useOrganization,
} from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Doc } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";

const MODEL_OPTIONS = [
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini (OpenRouter)" },
  { value: "openai/gpt-4o", label: "GPT-4o (OpenRouter)" },
  {
    value: "anthropic/claude-3.5-sonnet",
    label: "Claude 3.5 Sonnet (OpenRouter)",
  },
  {
    value: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash (OpenRouter)",
  },
];

export default function DashboardPage() {
  const { isLoaded: authLoaded, orgRole } = useAuth();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const currentWorkspace = useQuery(api.workspaces.getCurrentWorkspace);
  const provisionWorkspace = useMutation(api.workspaces.provisionWorkspace);

  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  if (!authLoaded || !orgLoaded || currentWorkspace === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Loading workspace...</span>
        </div>
      </div>
    );
  }

  // State 1: User has no active Clerk Organization selected
  if (!organization) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Create or select an organization
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Each Resolvd workspace maps 1:1 to a Clerk Organization with
            isolated knowledge bases, chat widgets, and team permissions.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-base font-semibold text-foreground">
              Your organizations
            </h2>
            <OrganizationList
              hidePersonal
              afterSelectOrganizationUrl="/dashboard"
              afterCreateOrganizationUrl="/dashboard"
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-base font-semibold text-foreground">
              Create a new organization
            </h2>
            <CreateOrganization afterCreateOrganizationUrl="/dashboard" />
          </div>
        </div>
      </div>
    );
  }

  // State 2: Clerk Organization is active, but Convex workspace is not yet provisioned
  if (currentWorkspace === null) {
    const canProvision = orgRole === "org:admin";

    const handleProvision = async () => {
      setProvisioning(true);
      setProvisionError(null);
      try {
        await provisionWorkspace({
          name: organization.name,
          slug: organization.slug ?? undefined,
        });
      } catch (err) {
        setProvisionError(
          err instanceof Error ? err.message : "Failed to provision workspace.",
        );
      } finally {
        setProvisioning(false);
      }
    };

    return (
      <div className="mx-auto max-w-xl py-10">
        <div className="rounded-xl border border-border bg-card p-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">
            Provision {organization.name}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Initialize your isolated Convex workspace, default widget
            configuration, and role-based access controls for{" "}
            <span className="font-mono text-foreground">
              {organization.slug ?? organization.id}
            </span>
            .
          </p>

          {provisionError && (
            <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
              {provisionError}
            </div>
          )}

          {canProvision ? (
            <div className="mt-6">
              <Button
                onClick={handleProvision}
                disabled={provisioning}
                className="gap-2"
              >
                {provisioning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Provisioning workspace...
                  </>
                ) : (
                  <>
                    Provision workspace
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="mt-6 flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
              <span>
                Only an organization admin can provision this workspace. Ask
                your admin to open the dashboard once to initialize it.
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // State 3: Active, provisioned workspace
  const { workspace, role } = currentWorkspace;
  const isAdmin = role === "org:admin";

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {workspace.name}
            </h1>
            <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium capitalize text-accent-foreground">
              {workspace.planTier} plan
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Workspace slug:{" "}
            <span className="font-mono text-foreground">{workspace.slug}</span>{" "}
            · Status:{" "}
            <span className="capitalize text-foreground">
              {workspace.subscriptionStatus}
            </span>
          </p>
        </div>

        {isAdmin && (
          <Link href="/dashboard/team">
            <Button variant="outline" size="sm" className="gap-2">
              <Users className="h-4 w-4" />
              Manage team
            </Button>
          </Link>
        )}
      </div>

      {/* Operational summary row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">
            Active AI Model
          </div>
          <div className="mt-2 flex items-center gap-2 font-mono text-sm font-medium text-foreground">
            <Bot className="h-4 w-4 text-primary" />
            <span className="truncate">{workspace.aiModel}</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">
            Your Role
          </div>
          <div className="mt-2 text-sm font-semibold text-foreground">
            {isAdmin ? "Workspace Admin (org:admin)" : "Support Agent (org:member)"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">
            Tenant Isolation
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>Verified via Clerk JWT</span>
          </div>
        </div>
      </div>

      <WorkspaceSettingsForm
        key={`${workspace._id}-${workspace.updatedAt}`}
        workspace={workspace}
        isAdmin={isAdmin}
      />
    </div>
  );
}

function WorkspaceSettingsForm({
  workspace,
  isAdmin,
}: {
  workspace: Doc<"workspaces">;
  isAdmin: boolean;
}) {
  const updateSettings = useMutation(api.workspaces.updateWorkspaceSettings);
  const [name, setName] = useState(workspace.name);
  const [aiModel, setAiModel] = useState(workspace.aiModel);
  const [systemPrompt, setSystemPrompt] = useState(
    workspace.systemPrompt ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    setSaveError(null);
    try {
      await updateSettings({
        name,
        aiModel,
        systemPrompt: systemPrompt.trim() || undefined,
      });
      setSaveMessage("Workspace settings saved.");
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Unable to update settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Workspace configuration
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure your workspace identity and default AI assistant model.
          </p>
        </div>
        {!isAdmin && (
          <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Read-only (Admin required)
          </span>
        )}
      </div>

      <form onSubmit={handleSaveSettings} className="mt-6 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor="ws-name"
              className="block text-sm font-medium text-foreground"
            >
              Workspace name
            </label>
            <input
              id="ws-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isAdmin || saving}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="ws-model"
              className="block text-sm font-medium text-foreground"
            >
              AI model
            </label>
            <select
              id="ws-model"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              disabled={!isAdmin || saving}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="ws-prompt"
            className="block text-sm font-medium text-foreground"
          >
            Assistant instructions
          </label>
          <textarea
            id="ws-prompt"
            rows={3}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            disabled={!isAdmin || saving}
            placeholder="Answer concisely using only verified workspace documentation. Escalate billing disputes to a human agent."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        {saveMessage && (
          <p className="text-sm font-medium text-primary">{saveMessage}</p>
        )}
        {saveError && (
          <p className="text-sm font-medium text-destructive">{saveError}</p>
        )}

        {isAdmin && (
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
